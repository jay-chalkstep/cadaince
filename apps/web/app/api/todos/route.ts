import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { emitIntegrationEvent } from "@/lib/inngest/emit";

// GET /api/todos - List todos
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const ownerId = searchParams.get("owner_id");
  const mine = searchParams.get("mine");
  const visibility = searchParams.get("visibility"); // private, team, or all
  const meetingId = searchParams.get("meeting_id");
  const pillarId = searchParams.get("pillar_id");
  const teamId = searchParams.get("team_id"); // DEPRECATED: use pillar_id

  const supabase = createAdminClient();

  // Get current user's profile first (needed for visibility filtering)
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  let query = supabase
    .from("todos")
    .select(`
      *,
      owner:profiles!todos_owner_id_fkey(id, full_name, avatar_url),
      created_by_profile:profiles!todos_created_by_fkey(id, full_name, avatar_url),
      pillar:pillars!todos_pillar_id_fkey(id, name, color),
      team:teams!todos_team_id_fkey(id, name)
    `)
    .eq("organization_id", profile.organization_id)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  // Filter by status
  if (status === "completed") {
    query = query.eq("is_complete", true);
  } else if (status === "open" || !status) {
    query = query.eq("is_complete", false);
  }

  // Filter by specific owner
  if (ownerId) {
    query = query.eq("owner_id", ownerId);
  }

  // Filter to current user's todos
  if (mine === "true") {
    query = query.eq("owner_id", profile.id);
  }

  // Filter by visibility
  if (visibility === "private") {
    // Private todos: only show owner's private todos
    query = query.eq("visibility", "private").eq("owner_id", profile.id);
  } else if (visibility === "team") {
    // Team todos: show all team-visible todos in org
    query = query.eq("visibility", "team");
  }
  // If visibility is "all" or not specified, show:
  // - All team todos in org
  // - User's own private todos

  // Filter by meeting
  if (meetingId) {
    query = query.eq("meeting_id", meetingId);
  }

  // Filter by pillar
  if (pillarId) {
    query = query.eq("pillar_id", pillarId);
  }

  // DEPRECATED: team_id filter - use pillar_id instead
  if (teamId) {
    query = query.eq("team_id", teamId);
  }

  const { data: todos, error } = await query;

  if (error) {
    console.error("Error fetching todos:", error);
    return NextResponse.json({ error: "Failed to fetch todos" }, { status: 500 });
  }

  // If no visibility filter, filter out other people's private todos
  let filteredTodos = todos;
  if (!visibility || visibility === "all") {
    filteredTodos = todos?.filter(
      (t) => t.visibility !== "private" || t.owner_id === profile.id
    );
  }

  return NextResponse.json(filteredTodos);
}

// POST /api/todos - Create a new todo
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Get organization_id for the todo
  const { data: profileWithOrg } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", profile.id)
    .single();

  const body = await req.json();
  const {
    title,
    description,
    owner_id,
    due_date,
    linked_rock_id,
    linked_issue_id,
    visibility,
    meeting_id,
    pillar_id,
    team_id, // DEPRECATED: use pillar_id
  } = body;

  if (!title) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400 }
    );
  }

  // Default due date to 7 days from now if not provided
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 7);

  const { data: todo, error } = await supabase
    .from("todos")
    .insert({
      title,
      description: description || null,
      owner_id: owner_id || profile.id, // Default to current user
      created_by: profile.id,
      due_date: due_date || defaultDueDate.toISOString().split("T")[0],
      is_complete: false,
      linked_rock_id: linked_rock_id || null,
      linked_issue_id: linked_issue_id || null,
      visibility: visibility || "team", // Default to team visibility
      meeting_id: meeting_id || null,
      organization_id: profileWithOrg?.organization_id,
      pillar_id: pillar_id || null,
      team_id: team_id || null, // DEPRECATED: use pillar_id
    })
    .select(`
      *,
      owner:profiles!todos_owner_id_fkey(id, full_name, avatar_url),
      created_by_profile:profiles!todos_created_by_fkey(id, full_name, avatar_url),
      pillar:pillars!todos_pillar_id_fkey(id, name, color)
    `)
    .single();

  if (error) {
    console.error("Error creating todo:", error);
    return NextResponse.json({ error: "Failed to create todo" }, { status: 500 });
  }

  // Emit integration event for todo creation (team visibility only)
  if (profileWithOrg?.organization_id && todo.visibility === "team") {
    await emitIntegrationEvent("todo/created", {
      organization_id: profileWithOrg.organization_id,
      todo_id: todo.id,
      title: todo.title,
      owner_id: todo.owner_id,
      owner_name: todo.owner?.full_name,
      due_date: todo.due_date,
      created_by: profile.id,
    });
  }

  return NextResponse.json(todo, { status: 201 });
}
