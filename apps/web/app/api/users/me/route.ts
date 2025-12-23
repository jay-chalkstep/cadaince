import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(`
      *,
      pillar:pillars(id, name)
    `)
    .eq("clerk_id", userId)
    .single();

  if (error) {
    console.error("Error fetching profile:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      clerkUserId: userId,
    });
    // Distinguish between "not found" and actual errors
    if (error.code === "PGRST116") {
      // PGRST116 = "The result contains 0 rows" - profile doesn't exist
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    // For other errors (e.g., query failures), return 500
    return NextResponse.json(
      {
        error: "Failed to fetch profile",
        details: process.env.NODE_ENV === "development" ? error.message : undefined
      },
      { status: 500 }
    );
  }

  return NextResponse.json(profile);
}
