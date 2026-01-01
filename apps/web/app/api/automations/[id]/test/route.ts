import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";

// POST - Test an automation with sample data
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createAdminClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, organization_id, access_level")
      .eq("clerk_id", userId)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.access_level !== "admin") {
      return NextResponse.json(
        { error: "Admin access required to test automations" },
        { status: 403 }
      );
    }

    // Get the automation
    const { data: automation } = await supabase
      .from("integration_automations")
      .select("*")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (!automation) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    // Generate sample event data based on trigger type
    const sampleData = generateSampleEventData(
      automation.trigger_event,
      profile.organization_id,
      profile.id
    );

    // Send test event to Inngest
    await inngest.send({
      name: "automation/test",
      data: {
        automation_id: automation.id,
        organization_id: profile.organization_id,
        trigger_event: automation.trigger_event,
        event_data: sampleData,
        is_test: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Test automation triggered. Check the logs for results.",
      sample_data: sampleData,
    });
  } catch (error) {
    console.error("Error in POST automation test:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function generateSampleEventData(
  triggerEvent: string,
  organizationId: string,
  profileId: string
): Record<string, unknown> {
  const baseData = {
    organization_id: organizationId,
    triggered_by: profileId,
    timestamp: new Date().toISOString(),
  };

  switch (triggerEvent) {
    case "l10/meeting.created":
    case "l10/meeting.updated":
    case "l10/meeting.starting_soon":
    case "l10/meeting.completed":
      return {
        ...baseData,
        meeting_id: "sample-meeting-id",
        title: "Sample L10 Meeting",
        scheduled_at: new Date().toISOString(),
      };

    case "issue/created":
    case "issue/queued":
    case "issue/resolved":
      return {
        ...baseData,
        issue_id: "sample-issue-id",
        title: "Sample Issue Title",
        priority: 2,
        owner_id: profileId,
      };

    case "rock/status.changed":
    case "rock/completed":
      return {
        ...baseData,
        rock_id: "sample-rock-id",
        title: "Sample Rock Title",
        old_status: "on_track",
        new_status: "off_track",
        owner_id: profileId,
        rock_level: "individual",
      };

    case "todo/created":
    case "todo/overdue":
      return {
        ...baseData,
        todo_id: "sample-todo-id",
        title: "Sample To-Do",
        owner_id: profileId,
        due_date: new Date().toISOString(),
      };

    case "headline/created":
      return {
        ...baseData,
        headline_id: "sample-headline-id",
        title: "Sample Headline - Great customer win!",
        headline_type: "customer",
        created_by: profileId,
      };

    case "scorecard/below_goal":
      return {
        ...baseData,
        metric_id: "sample-metric-id",
        metric_name: "Sample Metric",
        current_value: 75,
        goal: 100,
        owner_id: profileId,
      };

    default:
      return baseData;
  }
}
