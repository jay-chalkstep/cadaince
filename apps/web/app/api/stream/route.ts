import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export interface StreamItem {
  item_type: "update" | "alert";
  id: string;
  created_at: string;
  data: any;
}

// GET /api/stream - Combined updates and alerts stream
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "all"; // all, updates, alerts
  const limit = parseInt(searchParams.get("limit") || "50");

  const supabase = createAdminClient();

  // Get current user's profile for read state lookup and organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (!profile.organization_id) {
    return NextResponse.json([]);
  }

  const streamItems: StreamItem[] = [];

  // Fetch updates if type is 'all' or 'updates'
  if (type === "all" || type === "updates") {
    const { data: updates, error: updatesError } = await supabase
      .from("updates")
      .select(`
        *,
        author:profiles!updates_author_id_fkey(id, full_name, avatar_url, role),
        linked_rock:rocks(id, title, status),
        linked_metric:metrics(id, name),
        converted_to_issue:issues!updates_converted_to_issue_id_fkey(id, title, status)
      `)
      .eq("organization_id", profile.organization_id)
      .eq("is_draft", false)
      .not("published_at", "is", null)
      .is("archived_at", null)
      .order("published_at", { ascending: false })
      .limit(limit);

    if (updatesError) {
      console.error("Error fetching updates:", updatesError);
    } else if (updates && updates.length > 0) {
      // Fetch read states for current user
      const updateIds = updates.map((u) => u.id);
      const { data: readStates } = await supabase
        .from("update_read_state")
        .select("update_id, read_at, acknowledged_at")
        .eq("profile_id", profile.id)
        .in("update_id", updateIds);

      const readStateMap = new Map(
        readStates?.map((rs) => [rs.update_id, rs]) || []
      );

      // Add updates to stream
      updates.forEach((update) => {
        const readState = readStateMap.get(update.id);
        streamItems.push({
          item_type: "update",
          id: update.id,
          created_at: update.published_at,
          data: {
            ...update,
            read_at: readState?.read_at || null,
            acknowledged_at: readState?.acknowledged_at || null,
          },
        });
      });
    }
  }

  // Fetch alerts if type is 'all' or 'alerts'
  if (type === "all" || type === "alerts") {
    const { data: alerts, error: alertsError } = await supabase
      .from("alerts")
      .select(`
        *,
        triggered_by_profile:profiles!alerts_triggered_by_fkey(id, full_name, avatar_url),
        update:updates(id, content, format),
        metric:metrics(id, name, goal, unit),
        acknowledgments:alert_acknowledgments(
          id,
          profile_id,
          acknowledged_at,
          profile:profiles(id, full_name, avatar_url)
        )
      `)
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (alertsError) {
      console.error("Error fetching alerts:", alertsError);
    } else if (alerts) {
      // Add alerts to stream with user's acknowledged status
      alerts.forEach((alert) => {
        const userAcknowledged = alert.acknowledgments?.some(
          (ack: { profile_id: string }) => ack.profile_id === profile.id
        );
        streamItems.push({
          item_type: "alert",
          id: alert.id,
          created_at: alert.created_at,
          data: {
            ...alert,
            user_acknowledged: userAcknowledged,
          },
        });
      });
    }
  }

  // Sort by created_at descending
  streamItems.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Limit to requested number
  const limitedItems = streamItems.slice(0, limit);

  return NextResponse.json(limitedItems);
}
