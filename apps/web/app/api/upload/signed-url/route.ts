import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/upload/signed-url - Get a signed URL for direct upload to Supabase Storage
// This bypasses Vercel's 4.5MB body size limit
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const body = await req.json();
    const { contentType } = body;

    // Validate content type - support video and image (for thumbnails) MIME types
    const isVideoType = contentType?.startsWith("video/");
    const isImageType = contentType?.startsWith("image/");

    if (!isVideoType && !isImageType) {
      console.error("Invalid content type received:", contentType);
      return NextResponse.json(
        { error: "Invalid file type. Please upload a video or image file." },
        { status: 400 }
      );
    }

    // Determine file extension from MIME type
    const extensionMap: Record<string, string> = {
      // Video types
      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/quicktime": "mov",
      "video/x-m4v": "m4v",
      "video/x-quicktime": "mov",
      "video/3gpp": "3gp",
      "video/3gpp2": "3g2",
      "video/mpeg": "mpeg",
      "video/ogg": "ogv",
      // Image types (for thumbnails)
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const extension = extensionMap[contentType] || (isImageType ? "jpg" : "mp4");

    // Generate unique filename: clerkUserId/timestamp.ext
    const timestamp = Date.now();
    const storagePath = `${userId}/${timestamp}.${extension}`;

    // Create signed upload URL (valid for 1 hour)
    const { data, error } = await supabase.storage
      .from("update-videos")
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error("Failed to create signed URL:", error);
      return NextResponse.json(
        { error: "Failed to create upload URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      storagePath,
      token: data.token,
    });
  } catch (error) {
    console.error("Signed URL error:", error);
    return NextResponse.json(
      { error: "Failed to create upload URL" },
      { status: 500 }
    );
  }
}
