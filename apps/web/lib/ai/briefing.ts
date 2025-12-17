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

export interface BriefingContext {
  user: {
    name: string;
    role: string;
    pillar: string | null;
  };
  metrics: Array<{
    name: string;
    current_value: number | null;
    goal: number | null;
    trend: string;
    status: string;
    owner: string;
  }>;
  rocks: Array<{
    name: string;
    status: string;
    owner: string;
    quarter: number;
    year: number;
  }>;
  issues: Array<{
    title: string;
    priority: number;
    owner: string | null;
    created_at: string;
  }>;
  updates: Array<{
    author: string;
    type: string;
    content: string | null;
    transcript: string | null;
    published_at: string;
  }>;
  alerts: Array<{
    title: string;
    type: string;
    severity: string;
    created_at: string;
    acknowledged: boolean;
  }>;
  pendingTodos: number;
  upcomingMeeting: {
    type: string;
    scheduled_at: string;
  } | null;
}

export interface BriefingContent {
  greeting: string;
  summary: string;
  highlights: string[];
  attention_needed: string[];
  opportunities: string[];
  meeting_prep: string | null;
}

export async function generateMorningBriefing(
  context: BriefingContext
): Promise<BriefingContent | null> {
  const client = getAnthropicClient();
  if (!client) {
    console.log("Anthropic not configured, skipping briefing generation");
    return null;
  }

  const systemPrompt = `You are an executive assistant helping a senior leader prepare for their day.
Generate a concise, actionable morning briefing based on the provided context.

Your response must be valid JSON matching this structure:
{
  "greeting": "A brief, personalized greeting",
  "summary": "2-3 sentence overview of the day's priorities",
  "highlights": ["Array of 2-4 positive developments or wins"],
  "attention_needed": ["Array of 2-4 items requiring attention, ordered by urgency"],
  "opportunities": ["Array of 1-2 strategic opportunities or suggestions"],
  "meeting_prep": "If there's an upcoming meeting, brief prep notes. Otherwise null"
}

Guidelines:
- Be concise and direct - executives are busy
- Prioritize by business impact
- Use specific numbers and names when relevant
- Flag urgent items clearly
- Keep the tone professional but warm
- Focus on actionable insights, not just status updates`;

  const userPrompt = `Generate a morning briefing for ${context.user.name} (${context.user.role}${context.user.pillar ? `, ${context.user.pillar}` : ""}).

CURRENT STATE:

Metrics (${context.metrics.length} tracked):
${context.metrics.map((m) => `- ${m.name}: ${m.current_value ?? "No data"} (Goal: ${m.goal ?? "None"}, ${m.status}, ${m.trend} trend, Owner: ${m.owner})`).join("\n") || "No metrics data"}

Rocks this quarter (${context.rocks.length}):
${context.rocks.map((r) => `- ${r.name}: ${r.status} (Owner: ${r.owner})`).join("\n") || "No rocks"}

Open Issues (${context.issues.length}):
${context.issues.slice(0, 5).map((i) => `- [Priority ${i.priority}] ${i.title} (Owner: ${i.owner || "Unassigned"})`).join("\n") || "No open issues"}

Recent Updates (last 24h):
${context.updates.slice(0, 5).map((u) => `- ${u.author} (${u.type}): ${u.content?.slice(0, 100) || u.transcript?.slice(0, 100) || "Video update"}...`).join("\n") || "No recent updates"}

Unacknowledged Alerts (${context.alerts.filter((a) => !a.acknowledged).length}):
${context.alerts.filter((a) => !a.acknowledged).slice(0, 3).map((a) => `- [${a.severity.toUpperCase()}] ${a.title} (${a.type})`).join("\n") || "None"}

Pending To-Dos: ${context.pendingTodos}

${context.upcomingMeeting ? `Next Meeting: ${context.upcomingMeeting.type} at ${new Date(context.upcomingMeeting.scheduled_at).toLocaleTimeString()}` : "No meetings scheduled today"}

Generate the briefing JSON:`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      system: systemPrompt,
    });

    const content = response.content[0];
    if (content.type !== "text") {
      console.error("Unexpected response type from Claude");
      return null;
    }

    // Parse the JSON response
    const briefing = JSON.parse(content.text) as BriefingContent;
    return briefing;
  } catch (error) {
    console.error("Error generating briefing:", error);
    return null;
  }
}

export async function generateMeetingPrep(
  meetingType: string,
  context: {
    attendees: string[];
    recentIssues: Array<{ title: string; status: string }>;
    recentUpdates: Array<{ author: string; summary: string }>;
    rockStatuses: Array<{ name: string; status: string; owner: string }>;
    openTodos: number;
  }
): Promise<string | null> {
  const client = getAnthropicClient();
  if (!client) {
    return null;
  }

  const prompt = `Generate a brief pre-meeting synthesis for a ${meetingType} meeting.

Attendees: ${context.attendees.join(", ")}

Recent Issues to Discuss:
${context.recentIssues.map((i) => `- ${i.title} (${i.status})`).join("\n") || "None"}

Key Updates Since Last Meeting:
${context.recentUpdates.map((u) => `- ${u.author}: ${u.summary}`).join("\n") || "None"}

Rock Status:
${context.rockStatuses.map((r) => `- ${r.name}: ${r.status} (${r.owner})`).join("\n") || "None"}

Open To-Dos: ${context.openTodos}

Provide a 3-4 sentence synthesis highlighting:
1. Key items to prioritize in discussion
2. Any patterns or concerns to address
3. Suggested focus areas`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return null;
    }

    return content.text;
  } catch (error) {
    console.error("Error generating meeting prep:", error);
    return null;
  }
}
