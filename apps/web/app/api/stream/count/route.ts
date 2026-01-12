import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/stream/count - Get combined unread updates + unacknowledged alerts count
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  if (!profile.organization_id) {
    return NextResponse.json({ unread_updates: 0, unacknowledged_alerts: 0, total: 0 });
  }

  // Count unread updates
  let unreadUpdates = 0;
  {
    // Get all published, non-archived updates in org
    const { data: updates, error: updatesError } = await supabase
      .from("updates")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("is_draft", false)
      .not("published_at", "is", null)
      .is("archived_at", null);

    if (!updatesError && updates) {
      // Get read states for current user
      const { data: readStates } = await supabase
        .from("update_read_state")
        .select("update_id")
        .eq("profile_id", profile.id)
        .not("read_at", "is", null);

      const readUpdateIds = new Set(readStates?.map((r) => r.update_id) || []);
      unreadUpdates = updates.filter((u) => !readUpdateIds.has(u.id)).length;
    }
  }

  // Count unacknowledged alerts
  let unacknowledgedAlerts = 0;
  {
    // Get all alerts in org
    const { data: alerts, error: alertsError } = await supabase
      .from("alerts")
      .select("id")
      .eq("organization_id", profile.organization_id);

    if (!alertsError && alerts) {
      // Get acknowledgments for current user
      const { data: acks } = await supabase
        .from("alert_acknowledgments")
        .select("alert_id")
        .eq("profile_id", profile.id);

      const acknowledgedAlertIds = new Set(acks?.map((a) => a.alert_id) || []);
      unacknowledgedAlerts = alerts.filter((a) => !acknowledgedAlertIds.has(a.id)).length;
    }
  }

  return NextResponse.json({
    unread_updates: unreadUpdates,
    unacknowledged_alerts: unacknowledgedAlerts,
    total: unreadUpdates + unacknowledgedAlerts,
  });
}
