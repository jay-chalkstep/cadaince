import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/mentions/count - Get unread mention count
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Count unread mentions
  const { count, error } = await supabase
    .from("mentions")
    .select("id", { count: "exact", head: true })
    .eq("mentioned_id", profile.id)
    .is("read_at", null);

  if (error) {
    console.error("Error counting mentions:", error);
    return NextResponse.json({ error: "Failed to count mentions" }, { status: 500 });
  }

  return NextResponse.json({ count: count || 0 });
}
