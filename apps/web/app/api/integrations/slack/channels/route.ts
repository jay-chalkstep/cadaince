import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { SlackClient } from "@/lib/integrations/slack/client";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get user's profile and organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("clerk_id", userId)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get Slack client
    const client = await SlackClient.fromOrganization(profile.organization_id);
    if (!client) {
      return NextResponse.json({ channels: [] });
    }

    // Fetch channels
    const channels = await client.listChannels();

    return NextResponse.json({
      channels: channels.map((c) => ({
        id: c.id,
        name: c.name,
        is_private: c.is_private,
      })),
    });
  } catch (error) {
    console.error("Error fetching Slack channels:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
