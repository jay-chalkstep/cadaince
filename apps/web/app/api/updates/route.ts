import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/updates - List updates
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const authorId = searchParams.get("author_id");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = parseInt(searchParams.get("offset") || "0");

  const supabase = createAdminClient();

  let query = supabase
    .from("updates")
    .select(`
      *,
      author:profiles!updates_author_id_fkey(id, full_name, avatar_url, role),
      linked_rock:rocks(id, title, status),
      linked_metric:metrics(id, name)
    `)
    .eq("is_draft", false)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) {
    query = query.eq("type", type);
  }
  if (authorId) {
    query = query.eq("author_id", authorId);
  }

  const { data: updates, error } = await query;

  if (error) {
    console.error("Error fetching updates:", error);
    return NextResponse.json({ error: "Failed to fetch updates" }, { status: 500 });
  }

  return NextResponse.json(updates);
}

// POST /api/updates - Create a new update
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
  const {
    type,
    format,
    content,
    video_url,
    video_asset_id,
    thumbnail_url,
    transcript,
    duration_seconds,
    linked_rock_id,
    linked_metric_id,
    is_draft,
  } = body;

  // Validate required fields
  if (format === "text" && !content) {
    return NextResponse.json(
      { error: "Content is required for text updates" },
      { status: 400 }
    );
  }

  const { data: update, error } = await supabase
    .from("updates")
    .insert({
      author_id: profile.id,
      type: type || "general",
      format: format || "text",
      content: content || null,
      video_url: video_url || null,
      video_asset_id: video_asset_id || null,
      thumbnail_url: thumbnail_url || null,
      transcript: transcript || null,
      duration_seconds: duration_seconds || null,
      linked_rock_id: linked_rock_id || null,
      linked_metric_id: linked_metric_id || null,
      is_draft: is_draft || false,
      published_at: is_draft ? null : new Date().toISOString(),
    })
    .select(`
      *,
      author:profiles!updates_author_id_fkey(id, full_name, avatar_url, role)
    `)
    .single();

  if (error) {
    console.error("Error creating update:", error);
    return NextResponse.json({ error: "Failed to create update" }, { status: 500 });
  }

  return NextResponse.json(update, { status: 201 });
}
