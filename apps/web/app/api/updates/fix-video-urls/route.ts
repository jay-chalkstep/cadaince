import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getMuxClient, getPlaybackUrl, getThumbnailUrl } from "@/lib/mux/client";
import { NextResponse } from "next/server";

// POST /api/updates/fix-video-urls - Fix stuck video updates (admin only)
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const mux = getMuxClient();
  if (!mux) {
    return NextResponse.json(
      { error: "Mux credentials not configured" },
      { status: 500 }
    );
  }

  // Find video updates with missing video_url
  const { data: stuckUpdates, error } = await supabase
    .from("updates")
    .select("id, video_asset_id")
    .eq("format", "video")
    .not("video_asset_id", "is", null)
    .is("video_url", null);

  if (error) {
    console.error("Error fetching stuck updates:", error);
    return NextResponse.json(
      { error: "Failed to fetch stuck updates" },
      { status: 500 }
    );
  }

  const results = [];

  for (const update of stuckUpdates || []) {
    try {
      // Look up asset in Mux
      const asset = await mux.video.assets.retrieve(update.video_asset_id);

      if (!asset.playback_ids?.[0]?.id) {
        results.push({
          id: update.id,
          status: "skipped",
          reason: "No playback ID found",
        });
        continue;
      }

      const playbackId = asset.playback_ids[0].id;
      const videoUrl = getPlaybackUrl(playbackId);
      const thumbnailUrl = getThumbnailUrl(playbackId, { width: 640 });
      const duration = Math.round(asset.duration || 0);

      // Update the database
      const { error: updateError } = await supabase
        .from("updates")
        .update({
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          duration_seconds: duration,
        })
        .eq("id", update.id);

      if (updateError) {
        results.push({
          id: update.id,
          status: "error",
          reason: updateError.message,
        });
      } else {
        results.push({
          id: update.id,
          status: "fixed",
          playbackId,
        });
      }
    } catch (err) {
      results.push({
        id: update.id,
        status: "error",
        reason: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const fixed = results.filter((r) => r.status === "fixed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;

  return NextResponse.json({
    total: stuckUpdates?.length || 0,
    fixed,
    skipped,
    errors,
    results,
  });
}
