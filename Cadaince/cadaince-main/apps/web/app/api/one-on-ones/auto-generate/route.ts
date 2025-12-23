import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { autoGenerateOneOnOneMeetings, syncOneOnOneMeetings } from "@/lib/meetings/auto-generate";

// POST /api/one-on-ones/auto-generate - Auto-generate 1:1 meetings from org structure
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get current user's profile and check admin access
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Only admins can auto-generate meetings
  if (profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { sync = false, deactivate_removed = false } = body;

  try {
    let result;
    if (sync) {
      result = await syncOneOnOneMeetings(deactivate_removed);
    } else {
      result = await autoGenerateOneOnOneMeetings();
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error auto-generating 1:1 meetings:", error);
    return NextResponse.json(
      { error: "Failed to auto-generate meetings" },
      { status: 500 }
    );
  }
}
