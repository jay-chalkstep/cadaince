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

// POST /api/upload - Transcribe a video that was uploaded directly to Supabase Storage
// The client uploads directly to storage (to avoid Vercel's 4.5MB body limit),
// then calls this endpoint with the storage path to get the transcript
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
    const { storagePath } = body;

    if (!storagePath) {
      return NextResponse.json({ error: "No storage path provided" }, { status: 400 });
    }

    // Get public URL for the video
    const { data: urlData } = supabase.storage
      .from("update-videos")
      .getPublicUrl(storagePath);

    const videoUrl = urlData.publicUrl;

    // Transcribe with OpenAI Whisper
    let transcript = "";
    let transcriptData = null;

    const openai = getOpenAIClient();
    if (openai) {
      try {
        // Download the video from storage for transcription
        const { data: videoData, error: downloadError } = await supabase.storage
          .from("update-videos")
          .download(storagePath);

        if (downloadError) {
          console.error("Failed to download video for transcription:", downloadError);
        } else if (videoData) {
          // Determine file extension from path
          const extension = storagePath.split(".").pop() || "webm";

          // Create a File object from the blob for Whisper API
          const audioFile = new File([videoData], `video.${extension}`, {
            type: videoData.type || `video/${extension}`,
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
        }
      } catch (whisperError) {
        // Log error but don't fail - video is still usable without transcript
        console.error("Whisper transcription error:", whisperError);
      }
    }

    return NextResponse.json({
      video_url: videoUrl,
      transcript,
      transcript_data: transcriptData,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process video" },
      { status: 500 }
    );
  }
}
