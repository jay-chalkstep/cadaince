import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Regex to match @[Display Name](uuid) pattern
const MENTION_REGEX = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;

// Parse mentions from comment body
function extractMentions(body: string): string[] {
  const mentions: string[] = [];
  let match;
  while ((match = MENTION_REGEX.exec(body)) !== null) {
    mentions.push(match[2]); // Extract UUID
  }
  return [...new Set(mentions)]; // Dedupe
}

// GET /api/comments/[id] - Get a single comment
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

  // Get user's organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const { data: comment, error } = await supabase
    .from("comments")
    .select(`
      id,
      entity_type,
      entity_id,
      body,
      author_id,
      edited_at,
      deleted_at,
      created_at,
      author:profiles!comments_author_id_fkey(
        id, full_name, avatar_url, email
      )
    `)
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (error || !comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  return NextResponse.json(comment);
}

// PATCH /api/comments/[id] - Edit a comment (author only)
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

  // Get user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Verify comment exists and user is author
  const { data: existingComment } = await supabase
    .from("comments")
    .select("id, author_id")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .is("deleted_at", null)
    .single();

  if (!existingComment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  if (existingComment.author_id !== profile.id) {
    return NextResponse.json({ error: "Can only edit your own comments" }, { status: 403 });
  }

  const body = await req.json();
  const { body: newBody } = body;

  if (!newBody) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  // Update the comment
  const { data: comment, error } = await supabase
    .from("comments")
    .update({
      body: newBody,
      edited_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(`
      id,
      entity_type,
      entity_id,
      body,
      author_id,
      edited_at,
      deleted_at,
      created_at,
      author:profiles!comments_author_id_fkey(
        id, full_name, avatar_url, email
      )
    `)
    .single();

  if (error) {
    console.error("Error updating comment:", error);
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
  }

  // Handle mentions: delete old ones and create new ones
  await supabase.from("mentions").delete().eq("comment_id", id);

  const mentionedUserIds = extractMentions(newBody);

  if (mentionedUserIds.length > 0) {
    const { data: validUsers } = await supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .in("id", mentionedUserIds);

    const validUserIds = validUsers?.map(u => u.id) || [];

    if (validUserIds.length > 0) {
      const mentionRecords = validUserIds.map(mentionedId => ({
        comment_id: id,
        mentioned_id: mentionedId,
      }));

      await supabase.from("mentions").insert(mentionRecords);
    }
  }

  return NextResponse.json(comment);
}

// DELETE /api/comments/[id] - Soft delete a comment (author only)
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

  // Get user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Verify comment exists and user is author
  const { data: existingComment } = await supabase
    .from("comments")
    .select("id, author_id")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .is("deleted_at", null)
    .single();

  if (!existingComment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  if (existingComment.author_id !== profile.id) {
    return NextResponse.json({ error: "Can only delete your own comments" }, { status: 403 });
  }

  // Soft delete the comment
  const { error } = await supabase
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
