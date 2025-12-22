import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/mentions - Get my mentions
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true";
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = parseInt(searchParams.get("offset") || "0");

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

  // Build query for mentions
  let query = supabase
    .from("mentions")
    .select(`
      id,
      read_at,
      created_at,
      comment:comments!mentions_comment_id_fkey(
        id,
        entity_type,
        entity_id,
        body,
        created_at,
        author:profiles!comments_author_id_fkey(
          id, full_name, avatar_url
        )
      )
    `)
    .eq("mentioned_id", profile.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Filter to unread only unless all=true
  if (!all) {
    query = query.is("read_at", null);
  }

  const { data: mentions, error } = await query;

  if (error) {
    console.error("Error fetching mentions:", error);
    return NextResponse.json({ error: "Failed to fetch mentions" }, { status: 500 });
  }

  // Filter out mentions where the comment was deleted
  const activeMentions = mentions?.filter(m => {
    const comment = m.comment as { id: string } | null;
    return comment !== null;
  }) || [];

  return NextResponse.json(activeMentions);
}

// POST /api/mentions/read-all - Mark all mentions as read
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Mark all unread mentions as read
  const { error } = await supabase
    .from("mentions")
    .update({ read_at: new Date().toISOString() })
    .eq("mentioned_id", profile.id)
    .is("read_at", null);

  if (error) {
    console.error("Error marking mentions read:", error);
    return NextResponse.json({ error: "Failed to mark mentions read" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
