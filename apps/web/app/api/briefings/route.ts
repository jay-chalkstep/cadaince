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
      pillar:pillars(name)
    `)
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
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
        summary: "AI briefing generation is not configured. Please add your ANTHROPIC_API_KEY to enable personalized briefings.",
        highlights: [],
        attention_needed: context.alerts.filter((a) => !a.acknowledged).map((a) => a.title),
        opportunities: [],
        meeting_prep: null,
      },
      generated_at: new Date().toISOString(),
      is_fallback: true,
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
  const [metricsResult, rocksResult, issuesResult, updatesResult, alertsResult, todosResult, meetingResult] =
    await Promise.all([
      // Metrics with latest values
      supabase
        .from("metrics")
        .select(`
          name,
          goal,
          unit,
          owner:profiles!metrics_owner_id_fkey(full_name)
        `)
        .limit(20),

      // Current quarter rocks
      supabase
        .from("rocks")
        .select(`
          title,
          status,
          quarter,
          year,
          owner:profiles!rocks_owner_id_fkey(full_name)
        `)
        .eq("quarter", currentQuarter)
        .eq("year", currentYear),

      // Open issues
      supabase
        .from("issues")
        .select("title, priority, created_at, owner:profiles!issues_owner_id_fkey(full_name)")
        .eq("status", "open")
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
    ]);

  // Helper to extract name from Supabase relation array
  const getOwnerName = (owner: unknown): string => {
    const ownerArr = owner as { full_name: string }[] | null;
    return ownerArr?.[0]?.full_name || "Unknown";
  };

  return {
    metrics: (metricsResult.data || []).map((m) => ({
      name: m.name,
      current_value: null, // Would need to join with metric_values
      goal: m.goal,
      trend: "flat",
      status: "on_track",
      owner: getOwnerName(m.owner),
    })),
    rocks: (rocksResult.data || []).map((r) => ({
      name: r.title,
      status: r.status,
      owner: getOwnerName(r.owner),
      quarter: r.quarter,
      year: r.year,
    })),
    issues: (issuesResult.data || []).map((i) => ({
      title: i.title,
      priority: i.priority,
      owner: getOwnerName(i.owner),
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
  };
}
