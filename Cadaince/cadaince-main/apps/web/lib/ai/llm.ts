import Anthropic from "@anthropic-ai/sdk";

type LLMProvider = "anthropic" | "openai";

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

export function getConfiguredLLMProvider(): LLMProvider | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

function safeJsonParse<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {}

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    return JSON.parse(candidate) as T;
  }

  throw new Error("Model did not return valid JSON");
}

export async function generateJson<T>(args: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ json: T; provider: LLMProvider; model: string } | null> {
  const provider = getConfiguredLLMProvider();
  if (!provider) return null;

  const temperature = args.temperature ?? 0.3;

  if (provider === "anthropic") {
    const client = getAnthropicClient();
    if (!client) return null;

    const model =
      process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

    const resp = await client.messages.create({
      model,
      max_tokens: args.maxTokens ?? 900,
      temperature,
      system: args.system,
      messages: [{ role: "user", content: args.user }],
    });

    const text =
      resp.content?.find((c) => c.type === "text")?.text ?? "";
    const json = safeJsonParse<T>(text);

    return { json, provider, model };
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: args.maxTokens ?? 900,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    console.error("OpenAI error:", resp.status, errText);
    throw new Error(`OpenAI request failed: ${resp.status}`);
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  const json = safeJsonParse<T>(text);
  return { json, provider, model };
}
