import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/goals - List individual goals
 *
 * Query params:
 * - pillar_id: Filter by pillar (preferred)
 * - team_id: DEPRECATED - use pillar_id
 * - owner_id: Filter by owner
 * - rock_id: Filter by parent rock
 * - status: Filter by status (on_track, off_track, complete)
 */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const pillar_id = url.searchParams.get("pillar_id");
  const team_id = url.searchParams.get("team_id"); // DEPRECATED: use pillar_id
  const owner_id = url.searchParams.get("owner_id");
  const rock_id = url.searchParams.get("rock_id");
  const status = url.searchParams.get("status");
  const my_goals = url.searchParams.get("my_goals") === "true";

  let query = supabase
    .from("individual_goals")
    .select(`
      id,
      title,
      description,
      target_value,
      current_value,
      unit,
      due_date,
      status,
      created_at,
      updated_at,
      pillar_id,
      team_id,
      rock_id,
      owner_id,
      pillar:pillars!individual_goals_pillar_id_fkey(id, name, color),
      team:teams!individual_goals_team_id_fkey(id, name, level),
      rock:rocks!individual_goals_rock_id_fkey(id, title, status),
      owner:profiles!individual_goals_owner_id_fkey(id, full_name, avatar_url)
    `)
    .eq("organization_id", profile.organization_id)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  // Filter by pillar (preferred)
  if (pillar_id) {
    query = query.eq("pillar_id", pillar_id);
  }

  // DEPRECATED: team_id filter - use pillar_id instead
  if (team_id) {
    query = query.eq("team_id", team_id);
  }

  if (owner_id) {
    query = query.eq("owner_id", owner_id);
  } else if (my_goals) {
    query = query.eq("owner_id", profile.id);
  }

  if (rock_id) {
    query = query.eq("rock_id", rock_id);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data: goals, error } = await query;

  if (error) {
    console.error("Error fetching goals:", error);
    return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
  }

  // Calculate progress for goals with target values
  const goalsWithProgress = (goals || []).map((goal) => {
    let progress = null;
    if (goal.target_value && goal.target_value > 0) {
      progress = Math.min(100, Math.round(((goal.current_value || 0) / goal.target_value) * 100));
    }
    return { ...goal, progress };
  });

  return NextResponse.json({
    goals: goalsWithProgress,
    total: goalsWithProgress.length,
  });
}

/**
 * POST /api/goals - Create a new individual goal
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const body = await req.json();
  const {
    title,
    description,
    target_value,
    current_value,
    unit,
    due_date,
    pillar_id,
    team_id, // DEPRECATED: use pillar_id
    rock_id,
    owner_id,
    status,
  } = body;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Pillar is required (or team_id for backwards compatibility)
  if (!pillar_id && !team_id) {
    return NextResponse.json({ error: "Pillar is required" }, { status: 400 });
  }

  // Verify pillar exists in org
  if (pillar_id) {
    const { data: pillar } = await supabase
      .from("pillars")
      .select("id")
      .eq("id", pillar_id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (!pillar) {
      return NextResponse.json({ error: "Pillar not found" }, { status: 404 });
    }
  }

  // DEPRECATED: Verify team exists in org (for backwards compatibility)
  if (team_id) {
    const { data: team } = await supabase
      .from("teams")
      .select("id")
      .eq("id", team_id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
  }

  // If rock_id provided, verify it exists in org
  if (rock_id) {
    const { data: rock } = await supabase
      .from("rocks")
      .select("id")
      .eq("id", rock_id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (!rock) {
      return NextResponse.json({ error: "Rock not found" }, { status: 404 });
    }
  }

  // Determine owner - defaults to current user
  const goalOwnerId = owner_id || profile.id;

  // Non-admin/ELT can only create goals for themselves
  if (goalOwnerId !== profile.id && !["admin", "elt"].includes(profile.access_level || "")) {
    return NextResponse.json({ error: "Can only create goals for yourself" }, { status: 403 });
  }

  const { data: goal, error } = await supabase
    .from("individual_goals")
    .insert({
      organization_id: profile.organization_id,
      pillar_id: pillar_id || null,
      team_id: team_id || null, // DEPRECATED: use pillar_id
      rock_id: rock_id || null,
      owner_id: goalOwnerId,
      title,
      description: description || null,
      target_value: target_value || null,
      current_value: current_value || null,
      unit: unit || null,
      due_date: due_date || null,
      status: status || "on_track",
    })
    .select(`
      id,
      title,
      description,
      target_value,
      current_value,
      unit,
      due_date,
      status,
      created_at,
      pillar:pillars!individual_goals_pillar_id_fkey(id, name, color),
      team:teams!individual_goals_team_id_fkey(id, name),
      rock:rocks!individual_goals_rock_id_fkey(id, title),
      owner:profiles!individual_goals_owner_id_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error("Error creating goal:", error);
    return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
  }

  return NextResponse.json(goal, { status: 201 });
}
