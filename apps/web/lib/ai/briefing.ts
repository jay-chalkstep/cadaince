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
    access_level: string;
  };
  // Team context for cascade awareness
  team?: {
    id: string;
    name: string;
    level: number; // 1 = ELT, 2 = Pillar, 3 = Department, 4 = Team
    is_elt: boolean;
    child_teams?: Array<{
      id: string;
      name: string;
      level: number;
    }>;
  } | null;
  // V/TO Strategic Context
  vto: {
    purpose: string | null;
    ten_year_target: string | null;
    three_year_revenue: number | null;
    three_year_target_date: string | null;
    one_year_revenue: number | null;
    one_year_profit: number | null;
    one_year_target_date: string | null;
    one_year_goals: Array<{ goal: string; measurable: string }>;
  } | null;
  metrics: Array<{
    name: string;
    current_value: number | null;
    goal: number | null;
    trend: string;
    status: string;
    owner: string;
  }>;
  // Anomalies detected from external data
  anomalies: Array<{
    metric_name: string;
    type: string;
    severity: string;
    message: string;
  }>;
  rocks: Array<{
    name: string;
    status: string;
    owner: string;
    quarter: number;
    year: number;
    due_date: string | null;
  }>;
  issues: Array<{
    title: string;
    priority: number;
    owner: string | null;
    created_at: string;
    team_name?: string | null;
  }>;
  // Issues escalated from child teams
  escalatedIssues?: Array<{
    title: string;
    priority: number;
    from_team: string;
    escalated_at: string;
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
  mentions: Array<{
    author: string;
    entity_type: string;
    preview: string;
  }>;
}

export interface BriefingContent {
  greeting: string;
  summary: string;
  highlights: string[];
  attention_needed: string[];
  opportunities: string[];
  meeting_prep: string | null;
}

export type BriefingResult =
  | { success: true; content: BriefingContent }
  | { success: false; reason: "no_api_key" | "api_error"; error?: string };

export async function generateMorningBriefing(
  context: BriefingContext
): Promise<BriefingResult> {
  const client = getAnthropicClient();
  if (!client) {
    console.log("Anthropic not configured, skipping briefing generation");
    return { success: false, reason: "no_api_key" };
  }

  const systemPrompt = `You are an executive assistant helping a senior leader prepare for their day.
Generate a concise, actionable morning briefing based on the provided context.

Your response must be valid JSON matching this structure:
{
  "greeting": "A brief, personalized greeting",
  "summary": "2-3 sentence overview of the day's priorities, referencing strategic goals when relevant",
  "highlights": ["Array of 2-4 positive developments or wins"],
  "attention_needed": ["Array of 2-4 items requiring attention, ordered by urgency/impact"],
  "opportunities": ["Array of 1-2 strategic opportunities or suggestions"],
  "meeting_prep": "If there's an upcoming meeting, brief prep notes. Otherwise null"
}

Guidelines:
- Be concise and direct - executives are busy
- Prioritize by business impact and alignment with strategic goals
- Reference the V/TO (Vision/Traction Organizer) context to connect daily activities to strategic objectives
- Use specific numbers, percentages, and names when relevant
- Flag urgent items clearly, especially threshold breaches and anomalies
- Keep the tone professional but warm
- Focus on actionable insights, not just status updates
- For ELT members, emphasize strategic posture and decisions needed
- For pillar leads, emphasize domain-specific items plus cross-functional awareness
- Highlight progress toward 1-Year Plan goals when data is available
- For leaders with direct report teams, highlight escalated issues that need attention
- Consider the team cascade when prioritizing - issues escalated up require prompt action`;

  // Build strategic context from V/TO
  const strategicContext = context.vto
    ? `
STRATEGIC CONTEXT (V/TO):
- Purpose: ${context.vto.purpose || "Not defined"}
- 10-Year Target: ${context.vto.ten_year_target || "Not defined"}
${context.vto.one_year_revenue ? `- 1-Year Revenue Goal: $${context.vto.one_year_revenue.toLocaleString()}${context.vto.one_year_target_date ? ` (by ${new Date(context.vto.one_year_target_date).toLocaleDateString()})` : ""}` : ""}
${context.vto.one_year_profit ? `- 1-Year Profit Goal: $${context.vto.one_year_profit.toLocaleString()}` : ""}
${context.vto.one_year_goals?.length > 0 ? `- Key Goals: ${context.vto.one_year_goals.map((g) => g.goal).join("; ")}` : ""}
`
    : "";

  // Build team context
  const teamContext = context.team
    ? `
TEAM CONTEXT:
- Your Team: ${context.team.name} (Level ${context.team.level}${context.team.is_elt ? ", ELT" : ""})
${context.team.child_teams?.length ? `- Direct Reports: ${context.team.child_teams.map((t) => t.name).join(", ")}` : "- No direct report teams"}
`
    : "";

  // Build anomaly alerts
  const anomalyAlerts = context.anomalies?.length > 0
    ? `
DATA ANOMALIES DETECTED (${context.anomalies.length}):
${context.anomalies.slice(0, 5).map((a) => `- [${a.severity.toUpperCase()}] ${a.metric_name}: ${a.message}`).join("\n")}`
    : "";

  // Calculate rocks at risk
  const rocksAtRisk = context.rocks.filter(
    (r) => r.status === "at_risk" || r.status === "off_track"
  );
  const rocksDueSoon = context.rocks.filter((r) => {
    if (!r.due_date) return false;
    const daysUntilDue = Math.ceil(
      (new Date(r.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilDue <= 14 && daysUntilDue > 0;
  });

  // Build escalated issues section
  const escalatedSection = context.escalatedIssues?.length
    ? `
ESCALATED ISSUES FROM CHILD TEAMS (${context.escalatedIssues.length}):
${context.escalatedIssues.slice(0, 5).map((i) => `- [Priority ${i.priority}] ${i.title} (from ${i.from_team}, escalated ${new Date(i.escalated_at).toLocaleDateString()})`).join("\n")}`
    : "";

  const userPrompt = `Generate a morning briefing for ${context.user.name} (${context.user.role}${context.user.pillar ? `, ${context.user.pillar}` : ""}, ${context.user.access_level}).
${strategicContext}${teamContext}
CURRENT STATE:

Metrics (${context.metrics.length} tracked):
${context.metrics.map((m) => `- ${m.name}: ${m.current_value ?? "No data"} (Goal: ${m.goal ?? "None"}, ${m.status}, ${m.trend} trend, Owner: ${m.owner})`).join("\n") || "No metrics data"}
${anomalyAlerts}

Rocks this quarter (${context.rocks.length}${rocksAtRisk.length > 0 ? `, ${rocksAtRisk.length} at risk` : ""}):
${context.rocks.map((r) => `- ${r.name}: ${r.status} (Owner: ${r.owner}${r.due_date ? `, Due: ${new Date(r.due_date).toLocaleDateString()}` : ""})`).join("\n") || "No rocks"}
${rocksDueSoon.length > 0 ? `\nRocks due in next 14 days: ${rocksDueSoon.map((r) => r.name).join(", ")}` : ""}

Open Issues (${context.issues.length}):
${context.issues.slice(0, 5).map((i) => `- [Priority ${i.priority}] ${i.title} (Owner: ${i.owner || "Unassigned"}${i.team_name ? `, Team: ${i.team_name}` : ""})`).join("\n") || "No open issues"}
${escalatedSection}

Recent Updates (last 24h):
${context.updates.slice(0, 5).map((u) => `- ${u.author} (${u.type}): ${u.content?.slice(0, 100) || u.transcript?.slice(0, 100) || "Video update"}...`).join("\n") || "No recent updates"}

Unacknowledged Alerts (${context.alerts.filter((a) => !a.acknowledged).length}):
${context.alerts.filter((a) => !a.acknowledged).slice(0, 3).map((a) => `- [${a.severity.toUpperCase()}] ${a.title} (${a.type})`).join("\n") || "None"}

Pending To-Dos: ${context.pendingTodos}

${context.upcomingMeeting ? `Next Meeting: ${context.upcomingMeeting.type} at ${new Date(context.upcomingMeeting.scheduled_at).toLocaleTimeString()}` : "No meetings scheduled today"}

${context.mentions?.length > 0 ? `Unread Mentions (${context.mentions.length}):
${context.mentions.map((m) => `- ${m.author} mentioned you on ${m.entity_type}: "${m.preview.slice(0, 50)}..."`).join("\n")}` : "No unread mentions"}

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
      return { success: false, reason: "api_error", error: "Unexpected response type" };
    }

    // Parse the JSON response - strip markdown code fences if present
    let jsonText = content.text.trim();
    if (jsonText.startsWith("```")) {
      // Remove opening fence (```json or ```)
      jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "");
      // Remove closing fence
      jsonText = jsonText.replace(/\n?```\s*$/, "");
    }
    const briefing = JSON.parse(jsonText) as BriefingContent;
    return { success: true, content: briefing };
  } catch (error) {
    console.error("Error generating briefing:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, reason: "api_error", error: errorMessage };
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
