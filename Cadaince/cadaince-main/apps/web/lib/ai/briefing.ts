import { generateJson } from "@/lib/ai/llm";

export interface BriefingContext {
  user: {
    name: string;
    role: string | null;
    pillar: string | null;
    access_level: string;
  };
  metrics: Array<{
    id: string;
    name: string;
    current_value: number | null;
    target_value: number | null;
    unit: string | null;
    status: string;
    trend: string | null;
    owner: string | null;
  }>;
  rocks: Array<{
    id: string;
    name: string;
    status: string;
    progress_percent: number | null;
    owner: string | null;
    due_date: string | null;
  }>;
  issues: Array<{
    id: string;
    title: string;
    status: string;
    priority: string | null;
    owner: string | null;
    created_at: string;
  }>;
  todos: Array<{
    id: string;
    title: string;
    due_date: string | null;
    owner: string | null;
  }>;
  updates: Array<{
    id: string;
    content: string;
    created_at: string;
    author: string | null;
    type: string;
  }>;
  alerts: Array<{
    id: string;
    title: string;
    message: string;
    severity: string;
    acknowledged: boolean;
    created_at: string;
  }>;
  anomalies: Array<{
    id: string;
    metric_name: string;
    message: string;
    severity: string;
    created_at: string;
  }>;
  upcoming_meeting: {
    id: string;
    title: string;
    start_time: string;
    attendees: string[];
    meeting_type: string | null;
  } | null;
  vto: {
    vision_summary: string | null;
    three_year_picture: string | null;
    one_year_plan: string | null;
    quarterly_rocks: string | null;
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
  const system = `You are an executive assistant helping a senior leader prepare for their day.
Generate a concise, actionable morning briefing based on the provided context.

Return valid JSON:
{
  "greeting": "A brief, personalized greeting",
  "summary": "2-3 sentence overview of the day's priorities, referencing strategic goals when relevant",
  "highlights": ["2-4 positive developments or wins"],
  "attention_needed": ["2-4 items requiring attention, ordered by urgency/impact"],
  "opportunities": ["1-2 strategic opportunities or suggestions"],
  "meeting_prep": "Upcoming meeting prep notes or null"
}

Rules:
- Be concise and direct (exec-friendly)
- Do not invent facts
- JSON only (no markdown, no commentary)`;

  const strategicContext =
    context.vto?.vision_summary || context.vto?.one_year_plan || context.vto?.three_year_picture
      ? `\nSTRATEGIC CONTEXT (V/TO):\nVision: ${context.vto?.vision_summary || "Not set"}\n3-Year Picture: ${context.vto?.three_year_picture || "Not set"}\n1-Year Plan: ${context.vto?.one_year_plan || "Not set"}\nQuarterly Rocks: ${context.vto?.quarterly_rocks || "Not set"}\n`
      : "";

  const rocksAtRisk = context.rocks.filter(
    (r) => r.status === "at_risk" || r.status === "off_track"
  );

  const user = `Generate a morning briefing for ${context.user.name} (${context.user.role || "Team Member"}${context.user.pillar ? `, ${context.user.pillar}` : ""}, ${context.user.access_level}).\n${strategicContext}

Metrics (${context.metrics.length}):
${context.metrics.map((m) => `- ${m.name}: ${m.current_value ?? "N/A"}${m.unit ? ` ${m.unit}` : ""} (Target: ${m.target_value ?? "N/A"}${m.unit ? ` ${m.unit}` : ""}, Status: ${m.status}${m.trend ? `, Trend: ${m.trend}` : ""}, Owner: ${m.owner || "Unassigned"})`).join("\n") || "None"}

Rocks (${context.rocks.length}${rocksAtRisk.length ? `; at risk: ${rocksAtRisk.length}` : ""}):
${context.rocks.map((r) => `- ${r.name}: ${r.status}${r.progress_percent != null ? ` (${r.progress_percent}%)` : ""} (Owner: ${r.owner || "Unassigned"}${r.due_date ? `, Due: ${new Date(r.due_date).toLocaleDateString()}` : ""})`).join("\n") || "None"}

Issues (${context.issues.length}):
${context.issues.slice(0, 12).map((i) => `- ${i.title} (Status: ${i.status}${i.priority ? `, Priority: ${i.priority}` : ""}, Owner: ${i.owner || "Unassigned"})`).join("\n") || "None"}

To-dos (${context.todos.length}):
${context.todos.slice(0, 12).map((t) => `- ${t.title}${t.due_date ? ` (Due: ${new Date(t.due_date).toLocaleDateString()})` : ""}`).join("\n") || "None"}

Updates (${context.updates.length}):
${context.updates.slice(0, 10).map((u) => `- ${u.author || "Someone"} (${u.type}) @ ${new Date(u.created_at).toLocaleString()}: ${u.content}`).join("\n") || "None"}

Alerts (unacknowledged: ${context.alerts.filter((a) => !a.acknowledged).length}):
${context.alerts.filter((a) => !a.acknowledged).slice(0, 10).map((a) => `- [${a.severity.toUpperCase()}] ${a.title}: ${a.message}`).join("\n") || "None"}

Upcoming Meeting:
${context.upcoming_meeting ? `${context.upcoming_meeting.title} at ${new Date(context.upcoming_meeting.start_time).toLocaleTimeString()} (${context.upcoming_meeting.attendees.join(", ") || "no attendees"})` : "None"}

Return JSON only.`;

  const result = await generateJson<BriefingContent>({
    system,
    user,
    temperature: 0.25,
    maxTokens: 900,
  });

  if (!result) return null;

  const b: any = result.json || {};
  return {
    greeting: String(b.greeting || `Good morning, ${context.user.name}!`).slice(0, 200),
    summary: String(b.summary || "No summary generated.").slice(0, 1200),
    highlights: Array.isArray(b.highlights) ? b.highlights.map(String).slice(0, 6) : [],
    attention_needed: Array.isArray(b.attention_needed) ? b.attention_needed.map(String).slice(0, 8) : [],
    opportunities: Array.isArray(b.opportunities) ? b.opportunities.map(String).slice(0, 6) : [],
    meeting_prep: b.meeting_prep == null ? null : String(b.meeting_prep).slice(0, 1200),
  };
}

export async function generateMeetingSynthesis(
  meetingType: string,
  context: {
    attendees: string[];
    recentIssues: Array<{ title: string; status: string; owner: string | null }>;
    rockStatuses: Array<{ name: string; status: string; owner: string | null }>;
    openTodos: number;
  }
): Promise<string | null> {
  const system = "Return JSON: { \"text\": \"...\" }. No markdown.";
  const user = `Write a concise pre-meeting synthesis for a ${meetingType} meeting.\n\nAttendees: ${context.attendees.join(", ")}\n\nRecent issues:\n${context.recentIssues.map((i) => `- ${i.title} (${i.status})`).join("\n") || "None"}\n\nRocks:\n${context.rockStatuses.map((r) => `- ${r.name}: ${r.status}`).join("\n") || "None"}\n\nOpen to-dos: ${context.openTodos}\n\nOutput 6-10 bullets maximum; prioritize decisions.`;

  const result = await generateJson<{ text: string }>({
    system,
    user,
    temperature: 0.2,
    maxTokens: 450,
  });

  return result ? String((result.json as any)?.text || "").trim() || null : null;
}
