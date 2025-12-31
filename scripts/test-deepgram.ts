/**
 * Test script to verify Deepgram integration
 *
 * Usage:
 *   DEEPGRAM_API_KEY=your_key npx tsx scripts/test-deepgram.ts
 *
 * Expected Deepgram Project ID: efeac6d5-a282-45d9-b5d3-5e889c74a894
 */

import { createClient } from "@deepgram/sdk";

const API_KEY = process.env.DEEPGRAM_API_KEY;

if (!API_KEY) {
  console.error("❌ DEEPGRAM_API_KEY environment variable is not set");
  console.log("\nTo run this test:");
  console.log("  DEEPGRAM_API_KEY=your_key npx tsx scripts/test-deepgram.ts");
  process.exit(1);
}

console.log("🔑 API Key found (first 8 chars):", API_KEY.substring(0, 8) + "...");

async function testDeepgram() {
  const client = createClient(API_KEY);

  // Test 1: Check API key validity by getting projects
  console.log("\n📡 Testing API key validity...");
  try {
    const { result, error } = await client.manage.getProjects();
    if (error) {
      console.error("❌ API error:", error);
      return;
    }
    console.log("✅ API key is valid!");
    console.log("   Projects found:", result?.projects?.length || 0);
    result?.projects?.forEach((p: { project_id: string; name: string }) => {
      console.log(`   - ${p.name} (${p.project_id})`);
      if (p.project_id === "efeac6d5-a282-45d9-b5d3-5e889c74a894") {
        console.log("     ✅ This matches your expected project!");
      }
    });
  } catch (err) {
    console.error("❌ Failed to verify API key:", err);
    return;
  }

  // Test 2: Transcribe a sample audio file (NASA audio - public domain)
  console.log("\n🎤 Testing transcription with sample audio...");
  const testAudioUrl = "https://static.deepgram.com/examples/interview_speech-analytics.wav";

  try {
    const startTime = Date.now();
    const { result, error } = await client.listen.prerecorded.transcribeUrl(
      { url: testAudioUrl },
      {
        model: "nova-2",
        smart_format: true,
        punctuate: true,
      }
    );

    if (error) {
      console.error("❌ Transcription error:", error);
      return;
    }

    const elapsed = Date.now() - startTime;
    const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
    const words = result?.results?.channels?.[0]?.alternatives?.[0]?.words;

    console.log("✅ Transcription successful!");
    console.log(`   Time: ${elapsed}ms`);
    console.log(`   Words: ${words?.length || 0}`);
    console.log(`   Preview: "${transcript?.substring(0, 100)}..."`);

    // Test 3: Verify word-level timestamps
    if (words && words.length > 0) {
      console.log("\n⏱️  Word-level timestamps:");
      words.slice(0, 5).forEach((w: { word: string; start: number; end: number }) => {
        console.log(`   "${w.word}" @ ${w.start}s - ${w.end}s`);
      });
      console.log("   ... (showing first 5 words)");
    }

    console.log("\n✅ All tests passed! Deepgram integration is working.");
    console.log("\n📝 Next steps:");
    console.log("   1. Add DEEPGRAM_API_KEY to your Vercel project environment variables");
    console.log("   2. Also check that Mux static MP4 renditions are enabled");

  } catch (err) {
    console.error("❌ Transcription failed:", err);
  }
}

testDeepgram();
