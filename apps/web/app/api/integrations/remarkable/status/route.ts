import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("clerk_id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get reMarkable integration status
    const { data: integration, error: integrationError } = await supabase
      .from("user_integrations")
      .select("id, status, connected_at, error_message")
      .eq("profile_id", profile.id)
      .eq("integration_type", "remarkable")
      .single();

    if (integrationError && integrationError.code !== "PGRST116") {
      console.error("Error fetching reMarkable integration:", integrationError);
      return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
    }

    // Get reMarkable settings
    const { data: settings } = await supabase
      .from("remarkable_settings")
      .select("push_meeting_agendas, push_briefings, minutes_before_meeting, folder_path")
      .eq("profile_id", profile.id)
      .single();

    // Get recent documents
    const { data: recentDocs } = await supabase
      .from("remarkable_documents")
      .select("id, title, document_type, status, pushed_at")
      .eq("profile_id", profile.id)
      .order("pushed_at", { ascending: false })
      .limit(5);

    return NextResponse.json({
      connected: integration?.status === "active",
      status: integration?.status || "disconnected",
      connected_at: integration?.connected_at || null,
      error_message: integration?.error_message || null,
      settings: settings || {
        push_meeting_agendas: true,
        push_briefings: false,
        minutes_before_meeting: 60,
        folder_path: "/Aicomplice",
      },
      recent_documents: recentDocs || [],
    });
  } catch (error) {
    console.error("Error in reMarkable status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
