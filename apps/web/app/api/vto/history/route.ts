import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/vto/history - Get V/TO change history
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "50");

  const { data: history, error } = await supabase
    .from("vto_history")
    .select(`
      *,
      changed_by_profile:profiles!vto_history_changed_by_fkey(id, full_name, avatar_url)
    `)
    .order("changed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching VTO history:", error);
    return NextResponse.json({ error: "Failed to fetch VTO history" }, { status: 500 });
  }

  return NextResponse.json(history);
}
