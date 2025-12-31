import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/updates/count - Get unread update count for current user
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

  // Count published, non-archived updates in user's org that are unread
  // An update is unread if:
  // 1. No entry in update_read_state for this user, OR
  // 2. Entry exists but read_at is null
  const { count, error } = await supabase
    .from("updates")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", profile.organization_id)
    .eq("is_draft", false)
    .not("published_at", "is", null)
    .is("archived_at", null)
    .not(
      "id",
      "in",
      // Subquery: updates that have been read by current user
      supabase
        .from("update_read_state")
        .select("update_id")
        .eq("profile_id", profile.id)
        .not("read_at", "is", null)
    );

  if (error) {
    // Fallback: use a different approach if the NOT IN subquery doesn't work
    // This is a simpler but less efficient approach
    console.error("Error with subquery, trying alternative:", error);

    // Get all published, non-archived updates in org
    const { data: updates, error: updatesError } = await supabase
      .from("updates")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("is_draft", false)
      .not("published_at", "is", null)
      .is("archived_at", null);

    if (updatesError) {
      console.error("Error fetching updates:", updatesError);
      return NextResponse.json({ error: "Failed to count updates" }, { status: 500 });
    }

    // Get read states for current user
    const { data: readStates, error: readError } = await supabase
      .from("update_read_state")
      .select("update_id")
      .eq("profile_id", profile.id)
      .not("read_at", "is", null);

    if (readError) {
      console.error("Error fetching read states:", readError);
      return NextResponse.json({ error: "Failed to count updates" }, { status: 500 });
    }

    const readUpdateIds = new Set(readStates?.map((r) => r.update_id) || []);
    const unreadCount = updates?.filter((u) => !readUpdateIds.has(u.id)).length || 0;

    return NextResponse.json({ count: unreadCount });
  }

  return NextResponse.json({ count: count || 0 });
}
