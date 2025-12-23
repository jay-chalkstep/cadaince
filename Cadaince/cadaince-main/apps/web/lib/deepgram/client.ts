import { createClient, DeepgramClient } from "@deepgram/sdk";

// Lazy initialization of Deepgram client
let deepgramClient: DeepgramClient | null = null;

function getDeepgramClient(): DeepgramClient | null {
  if (!process.env.DEEPGRAM_API_KEY) {
    return null;
  }
  if (!deepgramClient) {
    deepgramClient = createClient(process.env.DEEPGRAM_API_KEY);
  }
  return deepgramClient;
}

// Transcribe audio/video from URL
export async function transcribeFromUrl(url: string): Promise<string | null> {
  const client = getDeepgramClient();
  if (!client) {
    console.log("Deepgram not configured, skipping transcription");
    return null;
  }

  try {
    const { result, error } = await client.listen.prerecorded.transcribeUrl(
      { url },
      {
        model: "nova-2",
        smart_format: true,
        punctuate: true,
        paragraphs: true,
        utterances: true,
        diarize: true, // Speaker identification
      }
    );

    if (error) {
      console.error("Deepgram transcription error:", error);
      return null;
    }

    // Extract the transcript text
    const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
    return transcript || null;
  } catch (error) {
    console.error("Error calling Deepgram:", error);
    return null;
  }
}

// Transcribe audio/video from buffer
export async function transcribeFromBuffer(
  buffer: Buffer,
  mimetype: string
): Promise<string | null> {
  const client = getDeepgramClient();
  if (!client) {
    console.log("Deepgram not configured, skipping transcription");
    return null;
  }

  try {
    const { result, error } = await client.listen.prerecorded.transcribeFile(
      buffer,
      {
        model: "nova-2",
        smart_format: true,
        punctuate: true,
        paragraphs: true,
        mimetype,
      }
    );

    if (error) {
      console.error("Deepgram transcription error:", error);
      return null;
    }

    const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
    return transcript || null;
  } catch (error) {
    console.error("Error calling Deepgram:", error);
    return null;
  }
}
