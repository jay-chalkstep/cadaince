import { createAdminClient } from "@/lib/supabase/server";
import { getThumbnailUrl, getPlaybackUrl } from "@/lib/mux/client";
import { transcribeFromUrlWithTimestamps } from "@/lib/deepgram/client";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import crypto from "crypto";

// Verify Mux webhook signature
function verifyMuxSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const [timestamp, v1Signature] = signature.split(",").reduce(
    (acc, part) => {
      const [key, value] = part.split("=");
      if (key === "t") acc[0] = value;
      if (key === "v1") acc[1] = value;
      return acc;
    },
    ["", ""]
  );

  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  return v1Signature === expectedSignature;
}

// POST /api/webhooks/mux - Handle Mux webhooks
export async function POST(req: Request) {
  console.log("Mux webhook endpoint hit");

  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("mux-signature");

  console.log("Mux webhook - has signature:", !!signature, "has secret:", !!process.env.MUX_WEBHOOK_SECRET);

  // Verify signature if webhook secret is configured
  const webhookSecret = process.env.MUX_WEBHOOK_SECRET;
  if (webhookSecret && signature) {
    const isValid = verifyMuxSignature(body, signature, webhookSecret);
    if (!isValid) {
      console.error("Invalid Mux webhook signature - rejecting request");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    console.log("Mux webhook signature verified");
  }

  const event = JSON.parse(body);
  const { type, data } = event;

  console.log("Mux webhook received:", type, "asset:", data?.id || data?.asset_id);

  const supabase = createAdminClient();

  switch (type) {
    case "video.asset.ready": {
      // Video has finished processing
      const { id: assetId, playback_ids, duration } = data;
      const playbackId = playback_ids?.[0]?.id;

      if (!playbackId) {
        console.error("No playback ID found for asset:", assetId);
        return NextResponse.json({ received: true });
      }

      // Find the update with this asset ID
      const { data: update } = await supabase
        .from("updates")
        .select("id, video_asset_id")
        .eq("video_asset_id", assetId)
        .single();

      if (update) {
        const videoUrl = getPlaybackUrl(playbackId);
        const thumbnailUrl = getThumbnailUrl(playbackId, { width: 640 });

        // Update the record with video URLs
        await supabase
          .from("updates")
          .update({
            video_url: videoUrl,
            thumbnail_url: thumbnailUrl,
            duration_seconds: Math.round(duration || 0),
          })
          .eq("id", update.id);

        console.log("Video ready, URLs saved. Transcription will run when static_renditions.ready fires.");
      }
      break;
    }

    case "video.asset.errored": {
      console.error("Mux asset error:", data);
      break;
    }

    case "video.upload.asset_created": {
      // Upload completed, asset created - update the record with the real asset ID
      const { asset_id, id: uploadId } = data;
      console.log("Upload completed, asset ID:", asset_id, "Upload ID:", uploadId);

      // The database stores upload_id in video_asset_id column
      // Update it to the actual asset_id so video.asset.ready can find it
      const { error } = await supabase
        .from("updates")
        .update({ video_asset_id: asset_id })
        .eq("video_asset_id", uploadId);

      if (error) {
        console.error("Failed to update video_asset_id:", error);
      } else {
        console.log("Updated video_asset_id from", uploadId, "to", asset_id);
      }
      break;
    }

    case "video.asset.static_renditions.ready": {
      // Static MP4 renditions are ready - now we can transcribe
      const { id: assetId, upload_id: uploadId, playback_ids } = data;
      const playbackId = playback_ids?.[0]?.id;

      console.log("Static renditions ready for asset:", assetId, "upload:", uploadId);

      if (!playbackId) {
        console.error("No playback ID found for static renditions:", assetId);
        return NextResponse.json({ received: true });
      }

      // Find the update - try asset_id first, then fall back to upload_id
      let update = await supabase
        .from("updates")
        .select("id, video_asset_id")
        .eq("video_asset_id", assetId)
        .single();

      if (!update.data && uploadId) {
        console.log("Asset ID not found, trying upload_id:", uploadId);
        update = await supabase
          .from("updates")
          .select("id, video_asset_id")
          .eq("video_asset_id", uploadId)
          .single();
      }

      if (update.data) {
        // Trigger transcription if Deepgram is configured
        if (process.env.DEEPGRAM_API_KEY) {
          console.log("Starting Deepgram transcription for update:", update.data.id);
          try {
            // Get MP4 URL for transcription - use capped-1080p since that's what we requested
            const mp4Url = `https://stream.mux.com/${playbackId}/capped-1080p.mp4`;
            console.log("Transcribing from URL:", mp4Url);

            const transcriptData = await transcribeFromUrlWithTimestamps(mp4Url);

            if (transcriptData) {
              console.log(
                "Transcription complete:",
                transcriptData.words.length,
                "words"
              );
              await supabase
                .from("updates")
                .update({
                  transcript: transcriptData.text,
                  transcript_data: transcriptData,
                })
                .eq("id", update.data.id);
              console.log("Transcript saved to database for update:", update.data.id);
            } else {
              console.warn("Transcription returned null for update:", update.data.id);
            }
          } catch (error) {
            console.error("Error transcribing video:", error);
          }
        } else {
          console.log("DEEPGRAM_API_KEY not configured, skipping transcription");
        }
      } else {
        console.error("No update found for asset:", assetId, "or upload:", uploadId);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
