import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getMuxClient } from "@/lib/mux/client";
import { NextResponse } from "next/server";

// POST /api/upload - Create a direct upload URL for Mux
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mux = getMuxClient();
  if (!mux) {
    return NextResponse.json(
      { error: "Video upload not configured. Please set MUX_TOKEN_ID and MUX_TOKEN_SECRET." },
      { status: 503 }
    );
  }

  const supabase = createAdminClient();

  // Verify user exists
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  try {
    // Create a direct upload in Mux
    // Enable static MP4 renditions for Deepgram transcription
    const upload = await mux.video.uploads.create({
      cors_origin: process.env.NEXT_PUBLIC_APP_URL || "*",
      new_asset_settings: {
        playback_policy: ["public"],
        mp4_support: "capped-1080p", // Enable MP4 downloads for transcription
      },
    });

    return NextResponse.json({
      uploadId: upload.id,
      uploadUrl: upload.url,
    });
  } catch (error) {
    console.error("Error creating Mux upload:", error);
    return NextResponse.json(
      { error: "Failed to create upload URL" },
      { status: 500 }
    );
  }
}
