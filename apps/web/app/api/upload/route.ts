import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";

// Lazy-initialized OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

// POST /api/upload - Upload video to Supabase Storage and transcribe with Whisper
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
    const formData = await req.formData();
    const file = formData.get("video") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No video file provided" }, { status: 400 });
    }

    // Validate file size (50MB max)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 50MB." },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ["video/mp4", "video/webm", "video/quicktime"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Supported formats: MP4, WebM, MOV" },
        { status: 400 }
      );
    }

    // Determine file extension from MIME type
    const extensionMap: Record<string, string> = {
      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/quicktime": "mov",
    };
    const extension = extensionMap[file.type] || "mp4";

    // Generate unique filename: userId/timestamp.ext
    const timestamp = Date.now();
    const filename = `${userId}/${timestamp}.${extension}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("update-videos")
      .upload(filename, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload video" },
        { status: 500 }
      );
    }

    // Get public URL for the video
    const { data: urlData } = supabase.storage
      .from("update-videos")
      .getPublicUrl(filename);

    const videoUrl = urlData.publicUrl;

    // Transcribe with OpenAI Whisper
    let transcript = "";
    let transcriptData = null;

    const openai = getOpenAIClient();
    if (openai) {
      try {
        // Create a File object from the buffer for Whisper API
        const audioFile = new File([buffer], `video.${extension}`, {
          type: file.type,
        });

        // Whisper API accepts video files directly - it extracts the audio
        const transcription = await openai.audio.transcriptions.create({
          file: audioFile,
          model: "whisper-1",
          response_format: "verbose_json",
          timestamp_granularities: ["word"],
        });

        transcript = transcription.text || "";

        // Build structured transcript with word-level timestamps
        if (transcription.words && transcription.words.length > 0) {
          transcriptData = {
            text: transcript,
            words: transcription.words.map((w) => ({
              word: w.word,
              start: w.start,
              end: w.end,
            })),
          };
        } else {
          // Fallback: structured transcript without word timing
          transcriptData = {
            text: transcript,
            words: [],
          };
        }
      } catch (whisperError) {
        // Log error but don't fail the upload - video is still usable without transcript
        console.error("Whisper transcription error:", whisperError);
        // Continue with empty transcript
      }
    }

    // Estimate duration from file size (rough approximation: ~1MB per 10 seconds at 2.5Mbps)
    // The actual duration will be determined when the video plays
    // For now we'll return null and let the frontend calculate it
    const estimatedDuration = null;

    return NextResponse.json({
      video_url: videoUrl,
      transcript,
      transcript_data: transcriptData,
      duration_seconds: estimatedDuration,
      // Include filename for potential cleanup
      filename,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process video" },
      { status: 500 }
    );
  }
}
