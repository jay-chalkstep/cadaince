import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/private-notes/:id - Get single note
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

  // Get current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data: note, error } = await supabase
    .from("private_notes")
    .select(`
      *,
      author:profiles!private_notes_author_id_fkey(id, full_name, avatar_url, email, role),
      recipient:profiles!private_notes_recipient_id_fkey(id, full_name, avatar_url, email, role),
      linked_update:updates(id, content, format, author:profiles!updates_author_id_fkey(id, full_name)),
      linked_rock:rocks(id, title, status, owner:profiles!owner_id(id, full_name)),
      linked_metric:metrics(id, name, goal, unit),
      escalated_to_issue:issues(id, title, status)
    `)
    .eq("id", id)
    .single();

  if (error || !note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  // Only author or recipient can view
  if (note.author_id !== profile.id && note.recipient_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(note);
}

// PATCH /api/private-notes/:id - Update note status
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
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Get the note
  const { data: note } = await supabase
    .from("private_notes")
    .select("author_id, recipient_id")
    .eq("id", id)
    .single();

  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  // Only author or recipient can update
  if (note.author_id !== profile.id && note.recipient_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { status, resolution_note, escalated_to_issue_id } = body;

  const updateData: Record<string, unknown> = {};
  if (status !== undefined) updateData.status = status;
  if (resolution_note !== undefined) updateData.resolution_note = resolution_note;
  if (escalated_to_issue_id !== undefined) updateData.escalated_to_issue_id = escalated_to_issue_id;

  // Set resolved_at when marking as resolved
  if (status === "resolved") {
    updateData.resolved_at = new Date().toISOString();
  }

  const { data: updated, error } = await supabase
    .from("private_notes")
    .update(updateData)
    .eq("id", id)
    .select(`
      *,
      author:profiles!private_notes_author_id_fkey(id, full_name, avatar_url),
      recipient:profiles!private_notes_recipient_id_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error("Error updating note:", error);
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/private-notes/:id - Delete note
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
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Get the note
  const { data: note } = await supabase
    .from("private_notes")
    .select("author_id")
    .eq("id", id)
    .single();

  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  // Only author can delete
  if (note.author_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("private_notes").delete().eq("id", id);

  if (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
