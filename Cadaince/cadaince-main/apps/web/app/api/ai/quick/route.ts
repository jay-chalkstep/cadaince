import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateJson, getConfiguredLLMProvider } from "@/lib/ai/llm";

// POST /api/ai/quick - lightweight LLM endpoint for UI experiments
// Body: { system?: string, prompt: string, json?: boolean }
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = getConfiguredLLMProvider();
  if (!provider) {
    return NextResponse.json(
      { error: "No LLM provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });

  const system =
    typeof body.system === "string" && body.system.trim().length > 0
      ? body.system.trim()
      : "You are a helpful assistant. Be concise.";

  const wantsJson = Boolean(body.json);

  if (wantsJson) {
    const result = await generateJson<any>({
      system,
      user: prompt,
      temperature: 0.2,
      maxTokens: 800,
    });
    if (!result) return NextResponse.json({ error: "LLM not configured" }, { status: 400 });
    return NextResponse.json({ provider: result.provider, model: result.model, json: result.json });
  }

  const result = await generateJson<{ text: string }>({
    system: system + "\nReturn JSON: { \"text\": \"...\" }",
    user: prompt,
    temperature: 0.2,
    maxTokens: 800,
  });
  if (!result) return NextResponse.json({ error: "LLM not configured" }, { status: 400 });

  return NextResponse.json({
    provider: result.provider,
    model: result.model,
    text: String((result.json as any)?.text || "").trim(),
  });
}
