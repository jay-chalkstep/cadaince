/**
 * Fix script for videos that have transcripts but missing video_url
 *
 * Usage:
 *   cd apps/web && npx tsx ../../scripts/fix-missing-video-urls.ts
 *
 * Requires environment variables:
 *   - MUX_TOKEN_ID
 *   - MUX_TOKEN_SECRET
 *   - SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import Mux from "@mux/mux-node";
import { createClient } from "@supabase/supabase-js";

async function main() {
  // Initialize Mux client
  const mux = new Mux({
    tokenId: process.env.MUX_TOKEN_ID,
    tokenSecret: process.env.MUX_TOKEN_SECRET,
  });

  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Find video updates with no video_url (regardless of transcript status)
  const { data: updates, error } = await supabase
    .from("updates")
    .select("id, video_asset_id")
    .eq("format", "video")
    .not("video_asset_id", "is", null)
    .is("video_url", null);

  if (error) {
    console.error("Error fetching updates:", error);
    process.exit(1);
  }

  console.log(`Found ${updates?.length || 0} updates with missing video URLs`);

  for (const update of updates || []) {
    console.log(`\nProcessing update ${update.id}...`);
    console.log(`  Asset ID: ${update.video_asset_id}`);

    try {
      // Get asset details from Mux
      const asset = await mux.video.assets.retrieve(update.video_asset_id);
      const playbackId = asset.playback_ids?.[0]?.id;

      if (!playbackId) {
        console.log(`  No playback ID found, skipping`);
        continue;
      }

      console.log(`  Playback ID: ${playbackId}`);

      // Construct URLs
      const videoUrl = `https://stream.mux.com/${playbackId}.m3u8`;
      const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.png?width=640`;
      const durationSeconds = Math.round(asset.duration || 0);

      console.log(`  Video URL: ${videoUrl}`);
      console.log(`  Duration: ${durationSeconds}s`);

      // Update the database
      const { error: updateError } = await supabase
        .from("updates")
        .update({
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          duration_seconds: durationSeconds,
        })
        .eq("id", update.id);

      if (updateError) {
        console.error(`  Error updating: ${updateError.message}`);
      } else {
        console.log(`  Updated successfully!`);
      }
    } catch (err) {
      console.error(`  Error fetching from Mux:`, err);
    }
  }

  console.log("\nDone!");
}

main();
