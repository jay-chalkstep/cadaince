import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get user's profile and organization
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("clerk_id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get Slack workspace for this organization
    const { data: workspace, error: workspaceError } = await supabase
      .from("slack_workspaces")
      .select("id, workspace_name, team_icon_url, is_active")
      .eq("organization_id", profile.organization_id)
      .single();

    if (workspaceError && workspaceError.code !== "PGRST116") {
      console.error("Error fetching Slack workspace:", workspaceError);
      return NextResponse.json({ error: "Failed to fetch workspace" }, { status: 500 });
    }

    return NextResponse.json({ workspace: workspace || null });
  } catch (error) {
    console.error("Error in Slack status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
