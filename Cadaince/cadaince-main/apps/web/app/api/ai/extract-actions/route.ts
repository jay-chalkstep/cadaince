import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateJson, getConfiguredLLMProvider } from "@/lib/ai/llm";

// POST /api/ai/extract-actions
// Body: { text: string, context?: string }
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
  const text = String(body.text || "").trim();
  if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });

  const system = `You are an operations assistant for an EOS-style leadership team.
Extract actionable items from the input.

Return valid JSON:
{
  "todos": [{"title": "...", "owner_hint": "optional", "due_date_hint": "optional"}],
  "issues": [{"title": "...", "priority_hint": "optional"}],
  "rocks": [{"name": "...", "reason": "..."}],
  "summary": "1-2 sentence recap"
}

Rules:
- Do not invent facts not present in the text.
- Titles should be short and verb-first when possible.
- Limit to max 7 todos, 5 issues, 3 rocks.`;

  const user = `${typeof body.context === "string" && body.context.trim() ? `Context:\n${body.context.trim()}\n\n` : ""}Text:\n${text}`;

  const result = await generateJson<any>({ system, user, temperature: 0.1, maxTokens: 900 });
  if (!result) return NextResponse.json({ error: "LLM not configured" }, { status: 400 });

  const json = result.json || {};
  return NextResponse.json({
    provider: result.provider,
    model: result.model,
    ...json,
  });
}
