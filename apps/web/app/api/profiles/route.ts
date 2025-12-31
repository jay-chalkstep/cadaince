import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/profiles - List all profiles for the user's organization
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's organization
  const { data: currentUser } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!currentUser?.organization_id) {
    return NextResponse.json([]);
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, avatar_url, access_level, is_elt")
    .eq("organization_id", currentUser.organization_id)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Error fetching profiles:", error);
    return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
  }

  return NextResponse.json(profiles);
}
