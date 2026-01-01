import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("clerk_id", userId)
      .single();

    if (profileError || !profile?.organization_id) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Check if already connected
    const { data: existingIntegration } = await supabase
      .from("user_integrations")
      .select("id, status")
      .eq("profile_id", profile.id)
      .eq("integration_type", "remarkable")
      .single();

    if (existingIntegration?.status === "active") {
      return NextResponse.json(
        { error: "reMarkable is already connected" },
        { status: 400 }
      );
    }

    // Generate a unique device ID for this pairing attempt
    const deviceId = crypto.randomUUID();

    // Store pending pairing state in user_integrations
    await supabase.from("user_integrations").upsert(
      {
        profile_id: profile.id,
        organization_id: profile.organization_id,
        integration_type: "remarkable",
        status: "pending",
        config: { device_id: deviceId },
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "profile_id,integration_type",
      }
    );

    return NextResponse.json({
      device_id: deviceId,
      instructions: {
        step1: "Visit my.remarkable.com/device/browser/connect",
        step2: "Sign in with your reMarkable account",
        step3: "Enter the one-time code shown on the screen",
        step4: "Return here and enter that code to complete pairing",
      },
      pairing_url: "https://my.remarkable.com/device/browser/connect",
    });
  } catch (error) {
    console.error("Error starting reMarkable pairing:", error);
    return NextResponse.json(
      { error: "Failed to start pairing" },
      { status: 500 }
    );
  }
}
