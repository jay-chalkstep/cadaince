import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/l10/[id]/queue - Get queued issues for a meeting
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

  // Get queued issues
  const { data: issues, error } = await supabase
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
    .eq("queued_for_meeting_id", id)
    .order("queue_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching queued issues:", error);
    return NextResponse.json({ error: "Failed to fetch queued issues" }, { status: 500 });
  }

  return NextResponse.json(issues || []);
}

// POST /api/l10/[id]/queue - Queue an issue for the meeting
export async function POST(
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

  if (meeting.status !== "scheduled") {
    return NextResponse.json(
      { error: "Can only queue issues for scheduled meetings" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { issue_id, title, description, priority } = body;

  // Get current max queue_order for this meeting
  const { data: maxOrderResult } = await supabase
    .from("issues")
    .select("queue_order")
    .eq("queued_for_meeting_id", meetingId)
    .order("queue_order", { ascending: false, nullsFirst: false })
    .limit(1)
    .single();

  const nextQueueOrder = (maxOrderResult?.queue_order ?? 0) + 1;

  let issue;

  if (issue_id) {
    // Queue an existing issue
    const { data: existingIssue, error: fetchError } = await supabase
      .from("issues")
      .select("id, organization_id, queued_for_meeting_id")
      .eq("id", issue_id)
      .single();

    if (fetchError || !existingIssue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    if (existingIssue.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    if (existingIssue.queued_for_meeting_id) {
      return NextResponse.json(
        { error: "Issue is already queued for a meeting" },
        { status: 400 }
      );
    }

    // Update the issue to queue it
    const { data: updatedIssue, error: updateError } = await supabase
      .from("issues")
      .update({
        queued_for_meeting_id: meetingId,
        queue_order: nextQueueOrder,
      })
      .eq("id", issue_id)
      .select(`
        id,
        title,
        description,
        priority,
        queue_order,
        created_at,
        raised_by_profile:profiles!issues_raised_by_fkey(id, full_name, avatar_url)
      `)
      .single();

    if (updateError) {
      console.error("Error queuing issue:", updateError);
      return NextResponse.json({ error: "Failed to queue issue" }, { status: 500 });
    }

    issue = updatedIssue;
  } else if (title) {
    // Create a new issue and queue it
    const { data: newIssue, error: createError } = await supabase
      .from("issues")
      .insert({
        title,
        description: description || null,
        priority: priority || null,
        raised_by: profile.id,
        created_by: profile.id,
        organization_id: profile.organization_id,
        status: "open",
        queued_for_meeting_id: meetingId,
        queue_order: nextQueueOrder,
      })
      .select(`
        id,
        title,
        description,
        priority,
        queue_order,
        created_at,
        raised_by_profile:profiles!issues_raised_by_fkey(id, full_name, avatar_url)
      `)
      .single();

    if (createError) {
      console.error("Error creating issue:", createError);
      return NextResponse.json({ error: "Failed to create issue" }, { status: 500 });
    }

    issue = newIssue;
  } else {
    return NextResponse.json(
      { error: "Either issue_id or title is required" },
      { status: 400 }
    );
  }

  return NextResponse.json(issue, { status: 201 });
}
