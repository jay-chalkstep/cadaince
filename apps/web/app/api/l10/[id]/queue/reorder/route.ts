import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// PATCH /api/l10/[id]/queue/reorder - Reorder queued issues
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: meetingId } = await params;
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

  // Verify meeting exists and belongs to user's org
  const { data: meeting } = await supabase
    .from("l10_meetings")
    .select("id, organization_id, status")
    .eq("id", meetingId)
    .single();

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  if (meeting.organization_id && meeting.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const body = await req.json();
  const { issue_ids } = body;

  if (!Array.isArray(issue_ids) || issue_ids.length === 0) {
    return NextResponse.json(
      { error: "issue_ids array is required" },
      { status: 400 }
    );
  }

  // Verify all issues are queued for this meeting
  const { data: queuedIssues } = await supabase
    .from("issues")
    .select("id")
    .eq("queued_for_meeting_id", meetingId);

  const queuedIssueIds = new Set((queuedIssues || []).map((i) => i.id));

  for (const issueId of issue_ids) {
    if (!queuedIssueIds.has(issueId)) {
      return NextResponse.json(
        { error: `Issue ${issueId} is not queued for this meeting` },
        { status: 400 }
      );
    }
  }

  // Update queue_order for each issue
  const updates = issue_ids.map((issueId: string, index: number) => ({
    id: issueId,
    queue_order: index + 1,
  }));

  // Update each issue's queue_order
  for (const update of updates) {
    const { error } = await supabase
      .from("issues")
      .update({ queue_order: update.queue_order })
      .eq("id", update.id);

    if (error) {
      console.error("Error updating queue order:", error);
      return NextResponse.json({ error: "Failed to reorder issues" }, { status: 500 });
    }
  }

  // Return updated queue
  const { data: updatedIssues, error: fetchError } = await supabase
    .from("issues")
    .select(`
      id,
      title,
      description,
      priority,
      queue_order,
      created_at,
      raised_by_profile:profiles!issues_raised_by_fkey(id, full_name, avatar_url)
    `)
    .eq("queued_for_meeting_id", meetingId)
    .order("queue_order", { ascending: true });

  if (fetchError) {
    console.error("Error fetching updated queue:", fetchError);
    return NextResponse.json({ error: "Failed to fetch updated queue" }, { status: 500 });
  }

  return NextResponse.json(updatedIssues || []);
}
