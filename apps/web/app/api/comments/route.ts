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

// GET /api/comments - List comments for an entity
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entity_type");
  const entityId = searchParams.get("entity_id");

  if (!entityType || !entityId) {
    return NextResponse.json(
      { error: "entity_type and entity_id are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Get user's organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Fetch comments with author info
  const { data: comments, error } = await supabase
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
    .eq("organization_id", profile.organization_id)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }

  return NextResponse.json(comments);
}

// POST /api/comments - Create a comment
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const body = await req.json();
  const { entity_type, entity_id, body: commentBody } = body;

  if (!entity_type || !entity_id || !commentBody) {
    return NextResponse.json(
      { error: "entity_type, entity_id, and body are required" },
      { status: 400 }
    );
  }

  // Validate entity_type
  const validEntityTypes = ['rock', 'todo', 'issue', 'metric', 'milestone', 'headline', 'process', 'vto'];
  if (!validEntityTypes.includes(entity_type)) {
    return NextResponse.json(
      { error: `Invalid entity_type. Must be one of: ${validEntityTypes.join(', ')}` },
      { status: 400 }
    );
  }

  // Create the comment
  const { data: comment, error } = await supabase
    .from("comments")
    .insert({
      organization_id: profile.organization_id,
      entity_type,
      entity_id,
      body: commentBody,
      author_id: profile.id,
    })
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
    console.error("Error creating comment:", error);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }

  // Extract and create mentions
  const mentionedUserIds = extractMentions(commentBody);

  if (mentionedUserIds.length > 0) {
    // Validate mentioned users are in same org
    const { data: validUsers } = await supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .in("id", mentionedUserIds);

    const validUserIds = validUsers?.map(u => u.id) || [];

    if (validUserIds.length > 0) {
      const mentionRecords = validUserIds.map(mentionedId => ({
        comment_id: comment.id,
        mentioned_id: mentionedId,
      }));

      const { error: mentionError } = await supabase
        .from("mentions")
        .insert(mentionRecords);

      if (mentionError) {
        console.error("Error creating mentions:", mentionError);
        // Don't fail the whole request, mentions are secondary
      }
    }
  }

  return NextResponse.json(comment, { status: 201 });
}
