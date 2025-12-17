import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/todos/:id - Get single todo
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

  const { data: todo, error } = await supabase
    .from("todos")
    .select(`
      *,
      owner:profiles!todos_owner_id_fkey(id, full_name, avatar_url, email),
      created_by_profile:profiles!todos_created_by_fkey(id, full_name, avatar_url),
      linked_rock:rocks(id, name, status),
      linked_issue:issues(id, title, status)
    `)
    .eq("id", id)
    .single();

  if (error || !todo) {
    return NextResponse.json({ error: "Todo not found" }, { status: 404 });
  }

  return NextResponse.json(todo);
}

// PATCH /api/todos/:id - Update todo
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

  // Get current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Get the todo to check ownership
  const { data: todo } = await supabase
    .from("todos")
    .select("owner_id, created_by")
    .eq("id", id)
    .single();

  if (!todo) {
    return NextResponse.json({ error: "Todo not found" }, { status: 404 });
  }

  // Check if user is admin, owner, or creator
  const isAdmin = profile.access_level === "admin";
  const isOwner = todo.owner_id === profile.id;
  const isCreator = todo.created_by === profile.id;

  if (!isAdmin && !isOwner && !isCreator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, owner_id, due_date, is_complete, linked_rock_id, linked_issue_id } = body;

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (owner_id !== undefined) updateData.owner_id = owner_id;
  if (due_date !== undefined) updateData.due_date = due_date;
  if (is_complete !== undefined) updateData.is_complete = is_complete;
  if (linked_rock_id !== undefined) updateData.linked_rock_id = linked_rock_id;
  if (linked_issue_id !== undefined) updateData.linked_issue_id = linked_issue_id;

  // Set completed_at when marking complete
  if (is_complete === true) {
    updateData.completed_at = new Date().toISOString();
  } else if (is_complete === false) {
    updateData.completed_at = null;
  }

  const { data: updated, error } = await supabase
    .from("todos")
    .update(updateData)
    .eq("id", id)
    .select(`
      *,
      owner:profiles!todos_owner_id_fkey(id, full_name, avatar_url),
      created_by_profile:profiles!todos_created_by_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error("Error updating todo:", error);
    return NextResponse.json({ error: "Failed to update todo" }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/todos/:id - Delete todo
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

  // Get current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Get the todo to check ownership
  const { data: todo } = await supabase
    .from("todos")
    .select("owner_id, created_by")
    .eq("id", id)
    .single();

  if (!todo) {
    return NextResponse.json({ error: "Todo not found" }, { status: 404 });
  }

  // Only admin, owner, or creator can delete
  const isAdmin = profile.access_level === "admin";
  const isOwner = todo.owner_id === profile.id;
  const isCreator = todo.created_by === profile.id;

  if (!isAdmin && !isOwner && !isCreator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("todos").delete().eq("id", id);

  if (error) {
    console.error("Error deleting todo:", error);
    return NextResponse.json({ error: "Failed to delete todo" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
