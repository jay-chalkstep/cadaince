import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/pillars - List all pillars
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: pillars, error } = await supabase
    .from("pillars")
    .select(`
      id,
      name,
      leader:profiles!pillars_leader_id_fkey(id, full_name, avatar_url)
    `)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching pillars:", error);
    return NextResponse.json({ error: "Failed to fetch pillars" }, { status: 500 });
  }

  return NextResponse.json(pillars);
}
