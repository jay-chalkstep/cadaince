import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/integrations/slack/user-mappings - List current user mappings
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Get all mappings with profile info
  const { data: mappings, error } = await supabase
    .from("slack_user_mappings")
    .select(`
      id,
      slack_user_id,
      slack_email,
      slack_username,
      slack_display_name,
      slack_avatar_url,
      match_method,
      matched_at,
      profile:profiles(id, full_name, email, avatar_url)
    `)
    .eq("organization_id", profile.organization_id)
    .order("slack_display_name", { ascending: true });

  if (error) {
    console.error("Error fetching mappings:", error);
    return NextResponse.json({ error: "Failed to fetch mappings" }, { status: 500 });
  }

  return NextResponse.json(mappings || []);
}

// POST /api/integrations/slack/user-mappings - Manually map a Slack user
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's profile and check admin status
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  if (profile.access_level !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { slack_user_id, profile_id } = body;

  if (!slack_user_id || !profile_id) {
    return NextResponse.json(
      { error: "slack_user_id and profile_id are required" },
      { status: 400 }
    );
  }

  // Verify the profile belongs to the organization
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profile_id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!targetProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Update the mapping
  const { data: mapping, error } = await supabase
    .from("slack_user_mappings")
    .update({
      profile_id,
      match_method: "manual",
      matched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", profile.organization_id)
    .eq("slack_user_id", slack_user_id)
    .select(`
      id,
      slack_user_id,
      slack_display_name,
      profile:profiles(id, full_name, email)
    `)
    .single();

  if (error) {
    console.error("Error updating mapping:", error);
    return NextResponse.json({ error: "Failed to update mapping" }, { status: 500 });
  }

  return NextResponse.json(mapping);
}

// DELETE /api/integrations/slack/user-mappings - Remove a mapping
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's profile and check admin status
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  if (profile.access_level !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const slackUserId = searchParams.get("slack_user_id");

  if (!slackUserId) {
    return NextResponse.json({ error: "slack_user_id is required" }, { status: 400 });
  }

  // Clear the mapping (don't delete the row, just unlink)
  const { error } = await supabase
    .from("slack_user_mappings")
    .update({
      profile_id: null,
      match_method: null,
      matched_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", profile.organization_id)
    .eq("slack_user_id", slackUserId);

  if (error) {
    console.error("Error removing mapping:", error);
    return NextResponse.json({ error: "Failed to remove mapping" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
