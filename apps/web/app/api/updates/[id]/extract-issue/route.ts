import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { extractIssueFromUpdate, UpdateContext, TeamContext } from "@/lib/ai/issue-extraction";

// POST /api/updates/:id/extract-issue - AI extraction of issue from update
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  // Get current user's profile and organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Get the update with related data
  const { data: update, error: updateError } = await supabase
    .from("updates")
    .select(`
      id,
      type,
      content,
      transcript,
      published_at,
      converted_to_issue_id,
      author:profiles!updates_author_id_fkey(id, full_name),
      linked_rock:rocks(id, title),
      linked_metric:metrics(id, name)
    `)
    .eq("id", id)
    .single();

  if (updateError || !update) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  // Check if already converted
  if (update.converted_to_issue_id) {
    return NextResponse.json(
      { error: "Update has already been converted to an issue" },
      { status: 400 }
    );
  }

  // Get team context for AI
  const { data: teamMembers } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("organization_id", profile.organization_id);

  const { data: rocks } = await supabase
    .from("rocks")
    .select("id, title")
    .eq("organization_id", profile.organization_id)
    .eq("status", "on_track")
    .limit(20);

  // Prepare context for AI
  const updateContext: UpdateContext = {
    content: update.content,
    transcript: update.transcript,
    type: update.type as "general" | "rock" | "scorecard" | "incident",
    author_name: update.author?.full_name || "Unknown",
    published_at: update.published_at,
    linked_rock: update.linked_rock,
    linked_metric: update.linked_metric,
  };

  const teamContext: TeamContext = {
    members: teamMembers || [],
    rocks: rocks || [],
  };

  // Extract issue using AI
  const extraction = await extractIssueFromUpdate(updateContext, teamContext);

  if (!extraction) {
    return NextResponse.json(
      { error: "Failed to extract issue. AI service may be unavailable." },
      { status: 500 }
    );
  }

  // Try to match suggested owner to actual team member
  let suggested_owner_id: string | null = null;
  if (extraction.suggested_owner_name && teamMembers) {
    const match = teamMembers.find(
      (m) =>
        m.full_name.toLowerCase().includes(extraction.suggested_owner_name!.toLowerCase()) ||
        extraction.suggested_owner_name!.toLowerCase().includes(m.full_name.toLowerCase())
    );
    if (match) {
      suggested_owner_id = match.id;
    }
  }

  // Try to match linked rock to actual rock
  let linked_rock_id: string | null = update.linked_rock?.id || null;
  if (!linked_rock_id && extraction.linked_rock_title && rocks) {
    const match = rocks.find(
      (r) =>
        r.title.toLowerCase().includes(extraction.linked_rock_title!.toLowerCase()) ||
        extraction.linked_rock_title!.toLowerCase().includes(r.title.toLowerCase())
    );
    if (match) {
      linked_rock_id = match.id;
    }
  }

  return NextResponse.json({
    title: extraction.title,
    description: extraction.description,
    suggested_owner_id,
    suggested_owner_name: extraction.suggested_owner_name,
    linked_rock_id,
    linked_rock_title: extraction.linked_rock_title,
    priority: extraction.priority,
    confidence: extraction.confidence,
  });
}
