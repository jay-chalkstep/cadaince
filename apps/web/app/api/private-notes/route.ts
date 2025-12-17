import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/private-notes - List private notes (sent or received)
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const direction = searchParams.get("direction") || "received"; // 'sent' or 'received'
  const status = searchParams.get("status");

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

  let query = supabase
    .from("private_notes")
    .select(`
      *,
      author:profiles!private_notes_author_id_fkey(id, full_name, avatar_url, role),
      recipient:profiles!private_notes_recipient_id_fkey(id, full_name, avatar_url, role),
      linked_update:updates(id, content, format),
      linked_rock:rocks(id, title, status),
      linked_metric:metrics(id, name),
      escalated_to_issue:issues(id, title, status)
    `)
    .order("created_at", { ascending: false });

  // Filter by direction
  if (direction === "sent") {
    query = query.eq("author_id", profile.id);
  } else {
    query = query.eq("recipient_id", profile.id);
  }

  // Filter by status
  if (status) {
    query = query.eq("status", status);
  }

  const { data: notes, error } = await query;

  if (error) {
    console.error("Error fetching private notes:", error);
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }

  return NextResponse.json(notes);
}

// POST /api/private-notes - Create a new private note
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
  const { recipient_id, content, linked_update_id, linked_rock_id, linked_metric_id } = body;

  if (!recipient_id || !content) {
    return NextResponse.json(
      { error: "Recipient and content are required" },
      { status: 400 }
    );
  }

  // Verify recipient exists
  const { data: recipient } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", recipient_id)
    .single();

  if (!recipient) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
  }

  const { data: note, error } = await supabase
    .from("private_notes")
    .insert({
      author_id: profile.id,
      recipient_id,
      content,
      linked_update_id: linked_update_id || null,
      linked_rock_id: linked_rock_id || null,
      linked_metric_id: linked_metric_id || null,
      status: "pending",
    })
    .select(`
      *,
      author:profiles!private_notes_author_id_fkey(id, full_name, avatar_url),
      recipient:profiles!private_notes_recipient_id_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error("Error creating private note:", error);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }

  return NextResponse.json(note, { status: 201 });
}
