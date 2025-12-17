import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

  const supabase = createAdminClient();

  let query = supabase
    .from("todos")
    .select(`
      *,
      owner:profiles!todos_owner_id_fkey(id, full_name, avatar_url),
      created_by_profile:profiles!todos_created_by_fkey(id, full_name, avatar_url)
    `)
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
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (profile) {
      query = query.eq("owner_id", profile.id);
    }
  }

  const { data: todos, error } = await query;

  if (error) {
    console.error("Error fetching todos:", error);
    return NextResponse.json({ error: "Failed to fetch todos" }, { status: 500 });
  }

  return NextResponse.json(todos);
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

  const body = await req.json();
  const { title, description, owner_id, due_date, linked_rock_id, linked_issue_id } = body;

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
    })
    .select(`
      *,
      owner:profiles!todos_owner_id_fkey(id, full_name, avatar_url),
      created_by_profile:profiles!todos_created_by_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error("Error creating todo:", error);
    return NextResponse.json({ error: "Failed to create todo" }, { status: 500 });
  }

  return NextResponse.json(todo, { status: 201 });
}
