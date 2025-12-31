import Anthropic from "@anthropic-ai/sdk";

// Lazy initialization of Anthropic client
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

export interface IssueExtractionResult {
  title: string;              // Max 80 chars, IDS-ready
  description: string;        // Bullet points from transcript
  suggested_owner_name: string | null;  // Name mentioned in transcript
  linked_rock_title: string | null;     // Rock title if mentioned
  priority: 1 | 2 | 3;        // 1=high, 2=medium, 3=low
  confidence: number;         // 0-1
}

export interface UpdateContext {
  content: string | null;
  transcript: string | null;
  type: "general" | "rock" | "scorecard" | "incident";
  author_name: string;
  published_at: string;
  linked_rock?: { id: string; title: string } | null;
  linked_metric?: { id: string; name: string } | null;
}

export interface TeamContext {
  members: Array<{ id: string; full_name: string }>;
  rocks: Array<{ id: string; title: string }>;
}

const SYSTEM_PROMPT = `You are an EOS (Entrepreneurial Operating System) assistant helping extract issues from team updates.

Your task is to analyze an update (text or video transcript) and extract a clearly-defined issue for the team's Issues List.

EOS Issue Guidelines:
- Issues should be stated simply and clearly
- Focus on the root cause, not symptoms
- Make the title actionable (what needs to be solved)
- The description should provide context needed for IDS (Identify, Discuss, Solve)
- If this is an incident update, treat it with higher priority

Your response must be valid JSON matching this structure:
{
  "title": "Brief, actionable issue statement (max 80 chars)",
  "description": "• Key point 1 from the update\\n• Key point 2\\n• Context needed for discussion",
  "suggested_owner_name": "Name of person mentioned who should own this (or null)",
  "linked_rock_title": "Title of related rock if mentioned (or null)",
  "priority": 1-3,
  "confidence": 0.0-1.0
}

Priority Guidelines:
- Priority 1 (High): Blocking other work, urgent customer impact, incidents, time-sensitive
- Priority 2 (Medium): Should be addressed this week, affects team productivity
- Priority 3 (Low): Improvement opportunity, not urgent, can wait

Confidence Guidelines:
- 0.8-1.0: Clear issue stated with specifics
- 0.5-0.8: Issue implied but needs clarification
- Below 0.5: Update doesn't contain a clear issue

Important:
- If the update doesn't contain a clear issue, set confidence below 0.5
- Extract specific names mentioned as potential owners
- Look for rock references like "related to our Q1 rock" or specific rock titles
- Incident updates should default to priority 1`;

export async function extractIssueFromUpdate(
  update: UpdateContext,
  team?: TeamContext
): Promise<IssueExtractionResult | null> {
  const client = getAnthropicClient();
  if (!client) {
    console.error("Anthropic not configured - ANTHROPIC_API_KEY is missing");
    return null;
  }

  // Build the content to analyze
  const textToAnalyze = update.transcript || update.content || "";

  if (!textToAnalyze.trim()) {
    return null;
  }

  // Build team context if available
  const teamContext = team ? `
Available Team Members for Owner Assignment:
${team.members.map((m) => `- ${m.full_name}`).join("\n")}

Active Rocks that might be referenced:
${team.rocks.map((r) => `- ${r.title}`).join("\n")}
` : "";

  // Build linked context
  const linkedContext = [];
  if (update.linked_rock) {
    linkedContext.push(`This update is linked to rock: "${update.linked_rock.title}"`);
  }
  if (update.linked_metric) {
    linkedContext.push(`This update references metric: "${update.linked_metric.name}"`);
  }

  const userPrompt = `Analyze this team update and extract an EOS-style issue if one exists.

Update Type: ${update.type}${update.type === "incident" ? " (TREAT AS HIGH PRIORITY)" : ""}
Posted by: ${update.author_name}
Date: ${new Date(update.published_at).toLocaleDateString()}
${linkedContext.length > 0 ? "\n" + linkedContext.join("\n") : ""}

Content/Transcript:
"""
${textToAnalyze}
"""
${teamContext}
Generate the issue JSON:`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      system: SYSTEM_PROMPT,
    });

    const content = response.content[0];
    if (content.type !== "text") {
      console.error("Unexpected response type from Claude");
      return null;
    }

    // Parse the JSON response
    // Handle potential markdown code blocks
    let jsonText = content.text.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.slice(7);
    }
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith("```")) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const result = JSON.parse(jsonText) as IssueExtractionResult;

    // Validate and clamp values
    result.priority = Math.max(1, Math.min(3, result.priority)) as 1 | 2 | 3;
    result.confidence = Math.max(0, Math.min(1, result.confidence));

    // Truncate title if too long
    if (result.title.length > 80) {
      result.title = result.title.slice(0, 77) + "...";
    }

    return result;
  } catch (error) {
    console.error("Error extracting issue from update:", error);
    return null;
  }
}
