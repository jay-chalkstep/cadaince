import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// DELETE - Disconnect reMarkable
export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Delete user integration
    const { error: integrationError } = await supabase
      .from("user_integrations")
      .delete()
      .eq("profile_id", profile.id)
      .eq("integration_type", "remarkable");

    if (integrationError) {
      console.error("Error deleting reMarkable integration:", integrationError);
      return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
    }

    // Delete settings
    await supabase
      .from("remarkable_settings")
      .delete()
      .eq("profile_id", profile.id);

    // Note: We keep remarkable_documents for history

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting reMarkable:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
