import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// GET - Fetch settings
export async function GET() {
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

    const { data: settings } = await supabase
      .from("remarkable_settings")
      .select("*")
      .eq("profile_id", profile.id)
      .single();

    return NextResponse.json({
      settings: settings || {
        push_meeting_agendas: true,
        push_briefings: false,
        minutes_before_meeting: 60,
        folder_path: "/Aicomplice",
      },
    });
  } catch (error) {
    console.error("Error fetching reMarkable settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH - Update settings
export async function PATCH(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      push_meeting_agendas,
      push_briefings,
      minutes_before_meeting,
      folder_path,
    } = body;

    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("clerk_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Validate folder path
    const sanitizedFolderPath = folder_path
      ? `/${folder_path.replace(/^\/+/, "").replace(/\/+$/, "")}`
      : "/Aicomplice";

    const { data: settings, error } = await supabase
      .from("remarkable_settings")
      .upsert(
        {
          profile_id: profile.id,
          organization_id: profile.organization_id,
          push_meeting_agendas:
            push_meeting_agendas !== undefined ? push_meeting_agendas : true,
          push_briefings: push_briefings !== undefined ? push_briefings : false,
          minutes_before_meeting:
            minutes_before_meeting !== undefined
              ? Math.max(15, Math.min(120, minutes_before_meeting))
              : 60,
          folder_path: sanitizedFolderPath,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "profile_id",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Error updating reMarkable settings:", error);
      return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error updating reMarkable settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
