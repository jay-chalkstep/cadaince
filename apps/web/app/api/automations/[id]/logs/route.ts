import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";

// GET - Get execution logs for an automation
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const supabase = createAdminClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("clerk_id", userId)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Verify automation belongs to org
    const { data: automation } = await supabase
      .from("integration_automations")
      .select("id, name")
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (!automation) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    // Get logs
    const { data: logs, error, count } = await supabase
      .from("automation_action_log")
      .select("*", { count: "exact" })
      .eq("automation_id", id)
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching automation logs:", error);
      return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
    }

    return NextResponse.json({
      logs: logs || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error in GET automation logs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
