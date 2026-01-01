import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";

// DELETE - Disconnect Slack workspace
export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get user's profile and verify admin access
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, organization_id, access_level")
      .eq("clerk_id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.access_level !== "admin") {
      return NextResponse.json(
        { error: "Admin access required to disconnect Slack" },
        { status: 403 }
      );
    }

    // Delete all Slack-related data for this organization
    const organizationId = profile.organization_id;

    // Delete notification settings
    await supabase
      .from("slack_notification_settings")
      .delete()
      .eq("organization_id", organizationId);

    // Delete user mappings
    await supabase
      .from("slack_user_mappings")
      .delete()
      .eq("organization_id", organizationId);

    // Delete workspace
    const { error: deleteError } = await supabase
      .from("slack_workspaces")
      .delete()
      .eq("organization_id", organizationId);

    if (deleteError) {
      console.error("Error deleting Slack workspace:", deleteError);
      return NextResponse.json(
        { error: "Failed to disconnect workspace" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting Slack:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
