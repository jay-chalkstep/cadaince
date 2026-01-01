import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { RemarkableClient, saveRemarkableConnection } from "@/lib/integrations/remarkable/client";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "One-time code is required" },
        { status: 400 }
      );
    }

    // Clean up the code (remove spaces, dashes, etc.)
    const cleanCode = code.replace(/[\s-]/g, "").toLowerCase();

    if (cleanCode.length !== 8) {
      return NextResponse.json(
        { error: "Invalid code format. Code should be 8 characters." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("clerk_id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Check for pending pairing
    const { data: pendingIntegration } = await supabase
      .from("user_integrations")
      .select("id, config")
      .eq("profile_id", profile.id)
      .eq("integration_type", "remarkable")
      .eq("status", "pending")
      .single();

    if (!pendingIntegration) {
      return NextResponse.json(
        { error: "No pending pairing found. Please start pairing first." },
        { status: 400 }
      );
    }

    try {
      // Exchange code for device token
      const deviceToken = await RemarkableClient.registerDevice(cleanCode);

      // Save the connection
      await saveRemarkableConnection(
        profile.id,
        profile.organization_id,
        deviceToken
      );

      // Also create default settings
      await supabase.from("remarkable_settings").upsert(
        {
          profile_id: profile.id,
          organization_id: profile.organization_id,
          push_meeting_agendas: true,
          push_briefings: false,
          minutes_before_meeting: 60,
          folder_path: "/Aicomplice",
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "profile_id",
        }
      );

      return NextResponse.json({
        success: true,
        message: "reMarkable connected successfully",
      });
    } catch (error) {
      console.error("Error registering reMarkable device:", error);

      // Update integration status to error
      await supabase
        .from("user_integrations")
        .update({
          status: "error",
          error_message:
            error instanceof Error ? error.message : "Failed to verify code",
          updated_at: new Date().toISOString(),
        })
        .eq("id", pendingIntegration.id);

      return NextResponse.json(
        { error: "Invalid or expired code. Please try again." },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error verifying reMarkable code:", error);
    return NextResponse.json(
      { error: "Failed to verify code" },
      { status: 500 }
    );
  }
}
