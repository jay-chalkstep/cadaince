import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { SlackClient } from "@/lib/integrations/slack/client";

// POST /api/integrations/slack/sync-users - Re-sync Slack users and auto-map by email
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's profile and check admin status
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  if (profile.access_level !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Get Slack client
  const client = await SlackClient.fromOrganization(profile.organization_id);
  if (!client) {
    return NextResponse.json({ error: "Slack not connected" }, { status: 400 });
  }

  try {
    // Fetch Slack users
    const slackUsers = await client.listUsers();

    // Get all profiles in the organization
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("organization_id", profile.organization_id);

    const profilesByEmail = new Map(
      (profiles || []).map((p) => [p.email?.toLowerCase(), p.id])
    );

    let matched = 0;
    let unmatched = 0;
    const mappings: Array<{
      slack_user_id: string;
      slack_display_name: string;
      profile_id: string | null;
      match_method: string | null;
    }> = [];

    // Process each Slack user
    for (const member of slackUsers) {
      const slackEmail = member.profile?.email?.toLowerCase();
      const matchedProfileId = slackEmail ? profilesByEmail.get(slackEmail) : null;

      if (matchedProfileId) {
        matched++;
      } else {
        unmatched++;
      }

      const mapping = {
        organization_id: profile.organization_id,
        slack_user_id: member.id,
        slack_email: member.profile?.email || null,
        slack_username: member.name,
        slack_display_name: member.profile?.display_name || member.profile?.real_name || member.name,
        slack_avatar_url: member.profile?.image_72 || null,
        profile_id: matchedProfileId || null,
        match_method: matchedProfileId ? "auto_email" : null,
        matched_at: matchedProfileId ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      await supabase.from("slack_user_mappings").upsert(mapping, {
        onConflict: "organization_id,slack_user_id",
      });

      mappings.push({
        slack_user_id: member.id,
        slack_display_name: mapping.slack_display_name || member.name,
        profile_id: matchedProfileId || null,
        match_method: matchedProfileId ? "auto_email" : null,
      });
    }

    return NextResponse.json({
      matched,
      unmatched,
      total: slackUsers.length,
      mappings,
    });
  } catch (err) {
    console.error("Error syncing Slack users:", err);
    return NextResponse.json(
      { error: "Failed to sync Slack users" },
      { status: 500 }
    );
  }
}
