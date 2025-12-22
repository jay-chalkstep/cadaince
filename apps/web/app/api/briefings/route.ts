import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { generateMorningBriefing, BriefingContext } from "@/lib/ai/briefing";
import { NextResponse } from "next/server";

// GET /api/briefings - Get today's briefing or generate one
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const forceRegenerate = searchParams.get("regenerate") === "true";

  const supabase = createAdminClient();

  // Get current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      role,
      access_level,
      pillar:pillars(name)
    `)
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    // Return fallback briefing if profile not found
    // This can happen during initial setup or if webhook hasn't synced yet
    const today = new Date().toISOString().split("T")[0];
    return NextResponse.json({
      profile_id: null,
      briefing_date: today,
      content: {
        greeting: "Good morning!",
        summary: "Your profile is being set up. Please refresh in a moment.",
        highlights: [],
        attention_needed: [],
        opportunities: [],
        meeting_prep: null,
      },
      generated_at: new Date().toISOString(),
      is_fallback: true,
      fallback_reason: "profile_not_found",
    });
  }

  const today = new Date().toISOString().split("T")[0];

  // Check for existing briefing today
  if (!forceRegenerate) {
    const { data: existingBriefing } = await supabase
      .from("briefings")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("briefing_date", today)
      .single();

    if (existingBriefing) {
      // Mark as viewed if not already
      if (!existingBriefing.viewed_at) {
        await supabase
          .from("briefings")
          .update({ viewed_at: new Date().toISOString() })
          .eq("id", existingBriefing.id);
      }

      return NextResponse.json({
        ...existingBriefing,
        is_cached: true,
      });
    }
  }

  // Gather context for briefing generation
  const context = await gatherBriefingContext(supabase, profile.id);

  // Add user info to context
  // Supabase returns relations as arrays when not using .single()
  const pillarData = profile.pillar as { name: string }[] | null;
  const fullContext: BriefingContext = {
    user: {
      name: profile.full_name,
      role: profile.role,
      pillar: pillarData?.[0]?.name || null,
      access_level: profile.access_level,
    },
    ...context,
  };

  // Generate briefing with Claude
  const briefingContent = await generateMorningBriefing(fullContext);

  if (!briefingContent) {
    // Return a fallback briefing if AI is not available
    return NextResponse.json({
      profile_id: profile.id,
      briefing_date: today,
      content: {
        greeting: `Good morning, ${profile.full_name}!`,
        summary: "AI briefing generation is not configured. Please add your ANTHROPIC_API_KEY to your environment and redeploy.",
        highlights: [],
        attention_needed: context.alerts.filter((a) => !a.acknowledged).map((a) => a.title),
        opportunities: [],
        meeting_prep: null,
      },
      generated_at: new Date().toISOString(),
      is_fallback: true,
      fallback_reason: "api_key_missing",
    });
  }

  // Store the briefing
  const { data: newBriefing, error } = await supabase
    .from("briefings")
    .upsert(
      {
        profile_id: profile.id,
        briefing_date: today,
        content: briefingContent,
        generated_at: new Date().toISOString(),
        viewed_at: new Date().toISOString(),
      },
      {
        onConflict: "profile_id,briefing_date",
      }
    )
    .select()
    .single();

  if (error) {
    console.error("Error storing briefing:", error);
    // Return the generated briefing even if storage fails
    return NextResponse.json({
      profile_id: profile.id,
      briefing_date: today,
      content: briefingContent,
      generated_at: new Date().toISOString(),
    });
  }

  return NextResponse.json(newBriefing);
}

async function gatherBriefingContext(supabase: ReturnType<typeof createAdminClient>, profileId: string) {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
  const currentYear = now.getFullYear();

  // Fetch all context data in parallel
  const [metricsResult, rocksResult, issuesResult, updatesResult, alertsResult, todosResult, meetingResult, vtoResult, anomaliesResult, mentionsResult] =
    await Promise.all([
      // Metrics with latest values
      supabase
        .from("metrics")
        .select(`
          name,
          goal,
          unit,
          owner:profiles!metrics_owner_id_fkey(full_name),
          metric_values(value, recorded_at)
        `)
        .eq("is_active", true)
        .order("recorded_at", { foreignTable: "metric_values", ascending: false })
        .limit(1, { foreignTable: "metric_values" })
        .limit(20),

      // Current quarter rocks
      supabase
        .from("rocks")
        .select(`
          title,
          status,
          quarter,
          due_date,
          owner:profiles!rocks_owner_id_fkey(full_name)
        `)
        .ilike("quarter", `%Q${currentQuarter}%`),

      // Open issues (not resolved)
      supabase
        .from("issues")
        .select("title, priority, created_at, raised_by:profiles!issues_raised_by_fkey(full_name)")
        .neq("status", "resolved")
        .order("priority", { ascending: true })
        .limit(10),

      // Recent updates (last 24h)
      supabase
        .from("updates")
        .select(`
          type,
          content,
          transcript,
          published_at,
          author:profiles!updates_author_id_fkey(full_name)
        `)
        .gte("published_at", yesterday)
        .order("published_at", { ascending: false })
        .limit(10),

      // Alerts with acknowledgment status for this user
      supabase
        .from("alerts")
        .select(`
          title,
          type,
          severity,
          created_at,
          acknowledgments:alert_acknowledgments(profile_id)
        `)
        .gte("created_at", yesterday)
        .order("created_at", { ascending: false })
        .limit(10),

      // Pending todos count
      supabase
        .from("todos")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", profileId)
        .is("completed_at", null),

      // Next meeting today
      supabase
        .from("meetings")
        .select("type, scheduled_at")
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(1)
        .single(),

      // V/TO strategic context
      supabase
        .from("vto")
        .select(`
          purpose,
          ten_year_target,
          three_year_revenue,
          three_year_target_date,
          one_year_revenue,
          one_year_profit,
          one_year_target_date,
          one_year_goals
        `)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),

      // Recent anomalies
      supabase
        .from("metric_anomalies")
        .select(`
          metric_id,
          anomaly_type,
          severity,
          message,
          metric:metrics(name)
        `)
        .is("resolved_at", null)
        .order("detected_at", { ascending: false })
        .limit(10),

      // Recent unread mentions
      supabase
        .from("mentions")
        .select(`
          id,
          created_at,
          comment:comments!mentions_comment_id_fkey(
            entity_type,
            entity_id,
            body,
            author:profiles!comments_author_id_fkey(full_name)
          )
        `)
        .eq("mentioned_id", profileId)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  // Helper to extract name from Supabase relation array
  const getOwnerName = (owner: unknown): string => {
    const ownerArr = owner as { full_name: string }[] | null;
    return ownerArr?.[0]?.full_name || "Unknown";
  };

  // Helper to parse quarter from text (e.g., "Q1 2024" or "Q1")
  const parseQuarter = (quarter: string | null): number => {
    if (!quarter) return currentQuarter;
    const match = quarter.match(/Q(\d)/i);
    return match ? parseInt(match[1]) : currentQuarter;
  };

  // Helper to derive year from due_date or quarter text
  const deriveYear = (dueDate: string | null, quarter: string | null): number => {
    if (dueDate) {
      return new Date(dueDate).getFullYear();
    }
    if (quarter) {
      const match = quarter.match(/(\d{4})/);
      if (match) return parseInt(match[1]);
    }
    return currentYear;
  };

  // Helper to extract metric name from relation
  const getMetricName = (metric: unknown): string => {
    const metricArr = metric as { name: string }[] | null;
    return metricArr?.[0]?.name || "Unknown";
  };

  return {
    vto: vtoResult.data
      ? {
          purpose: vtoResult.data.purpose,
          ten_year_target: vtoResult.data.ten_year_target,
          three_year_revenue: vtoResult.data.three_year_revenue,
          three_year_target_date: vtoResult.data.three_year_target_date,
          one_year_revenue: vtoResult.data.one_year_revenue,
          one_year_profit: vtoResult.data.one_year_profit,
          one_year_target_date: vtoResult.data.one_year_target_date,
          one_year_goals: vtoResult.data.one_year_goals || [],
        }
      : null,
    metrics: (metricsResult.data || []).map((m) => {
      const values = m.metric_values as { value: number; recorded_at: string }[] | null;
      return {
        name: m.name,
        current_value: values?.[0]?.value ?? null,
        goal: m.goal,
        trend: "flat" as const,
        status: "on_track" as const,
        owner: getOwnerName(m.owner),
      };
    }),
    anomalies: (anomaliesResult.data || []).map((a) => ({
      metric_name: getMetricName(a.metric),
      type: a.anomaly_type,
      severity: a.severity,
      message: a.message,
    })),
    rocks: (rocksResult.data || []).map((r) => ({
      name: r.title,
      status: r.status,
      owner: getOwnerName(r.owner),
      quarter: parseQuarter(r.quarter),
      year: deriveYear(r.due_date, r.quarter),
      due_date: r.due_date,
    })),
    issues: (issuesResult.data || []).map((i) => ({
      title: i.title,
      priority: i.priority,
      owner: getOwnerName(i.raised_by),
      created_at: i.created_at,
    })),
    updates: (updatesResult.data || []).map((u) => ({
      author: getOwnerName(u.author),
      type: u.type,
      content: u.content,
      transcript: u.transcript,
      published_at: u.published_at,
    })),
    alerts: (alertsResult.data || []).map((a) => ({
      title: a.title,
      type: a.type,
      severity: a.severity,
      created_at: a.created_at,
      acknowledged: (a.acknowledgments as { profile_id: string }[] || []).some(
        (ack) => ack.profile_id === profileId
      ),
    })),
    pendingTodos: todosResult.count || 0,
    upcomingMeeting: meetingResult.data
      ? {
          type: meetingResult.data.type,
          scheduled_at: meetingResult.data.scheduled_at,
        }
      : null,
    mentions: (mentionsResult.data || []).map((m) => {
      const comment = m.comment as unknown as {
        entity_type: string;
        entity_id: string;
        body: string;
        author: { full_name: string }[] | null;
      } | null;
      return {
        author: comment?.author?.[0]?.full_name || "Someone",
        entity_type: comment?.entity_type || "unknown",
        preview: comment?.body?.slice(0, 100) || "",
      };
    }),
  };
}
