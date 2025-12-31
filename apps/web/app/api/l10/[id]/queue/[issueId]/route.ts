import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// DELETE /api/l10/[id]/queue/[issueId] - Remove an issue from the meeting queue
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: meetingId, issueId } = await params;
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

  // Verify issue is queued for this meeting
  const { data: issue } = await supabase
    .from("issues")
    .select("id, queued_for_meeting_id")
    .eq("id", issueId)
    .single();

  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  if (issue.queued_for_meeting_id !== meetingId) {
    return NextResponse.json(
      { error: "Issue is not queued for this meeting" },
      { status: 400 }
    );
  }

  // Remove from queue (set queued_for_meeting_id to null)
  const { error: updateError } = await supabase
    .from("issues")
    .update({
      queued_for_meeting_id: null,
      queue_order: null,
    })
    .eq("id", issueId);

  if (updateError) {
    console.error("Error removing issue from queue:", updateError);
    return NextResponse.json({ error: "Failed to remove issue from queue" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
