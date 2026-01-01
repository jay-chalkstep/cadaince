import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/goals/:id - Get a single goal with details
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const { data: goal, error } = await supabase
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
      team_id,
      rock_id,
      owner_id,
      team:teams!individual_goals_team_id_fkey(
        id,
        name,
        level,
        anchor_seat:seats!teams_anchor_seat_id_fkey(id, name)
      ),
      rock:rocks!individual_goals_rock_id_fkey(
        id,
        title,
        status,
        rock_level,
        owner:profiles!rocks_owner_id_fkey(id, full_name)
      ),
      owner:profiles!individual_goals_owner_id_fkey(
        id,
        full_name,
        avatar_url,
        email,
        title
      )
    `)
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (error || !goal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  // Calculate progress
  let progress = null;
  if (goal.target_value && goal.target_value > 0) {
    progress = Math.min(100, Math.round(((goal.current_value || 0) / goal.target_value) * 100));
  }

  return NextResponse.json({ ...goal, progress });
}

/**
 * PATCH /api/goals/:id - Update a goal
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Get goal to check ownership
  const { data: existingGoal } = await supabase
    .from("individual_goals")
    .select("id, owner_id")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!existingGoal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  // Only owner or admin/ELT can update
  const isOwner = existingGoal.owner_id === profile.id;
  const isAdmin = ["admin", "elt"].includes(profile.access_level || "");
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    title,
    description,
    target_value,
    current_value,
    unit,
    due_date,
    status,
    rock_id,
  } = body;

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (target_value !== undefined) updateData.target_value = target_value;
  if (current_value !== undefined) updateData.current_value = current_value;
  if (unit !== undefined) updateData.unit = unit;
  if (due_date !== undefined) updateData.due_date = due_date;
  if (status !== undefined) updateData.status = status;
  if (rock_id !== undefined) updateData.rock_id = rock_id;

  const { data: goal, error } = await supabase
    .from("individual_goals")
    .update(updateData)
    .eq("id", id)
    .select(`
      id,
      title,
      description,
      target_value,
      current_value,
      unit,
      due_date,
      status,
      updated_at,
      team:teams!individual_goals_team_id_fkey(id, name),
      rock:rocks!individual_goals_rock_id_fkey(id, title),
      owner:profiles!individual_goals_owner_id_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error("Error updating goal:", error);
    return NextResponse.json({ error: "Failed to update goal" }, { status: 500 });
  }

  return NextResponse.json(goal);
}

/**
 * DELETE /api/goals/:id - Delete a goal
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Get goal to check ownership
  const { data: existingGoal } = await supabase
    .from("individual_goals")
    .select("id, owner_id")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!existingGoal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  // Only owner or admin can delete
  const isOwner = existingGoal.owner_id === profile.id;
  const isAdmin = profile.access_level === "admin";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("individual_goals")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting goal:", error);
    return NextResponse.json({ error: "Failed to delete goal" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
