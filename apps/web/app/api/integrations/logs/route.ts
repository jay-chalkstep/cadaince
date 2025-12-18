import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/integrations/logs - List sync logs
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const integrationId = searchParams.get("integration_id");
  const metricId = searchParams.get("metric_id");
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  let query = supabase
    .from("sync_logs")
    .select(`
      *,
      integration:integrations(id, type, name),
      metric:metrics(id, name)
    `, { count: "exact" })
    .order("started_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (integrationId) {
    query = query.eq("integration_id", integrationId);
  }
  if (metricId) {
    query = query.eq("metric_id", metricId);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data: logs, error, count } = await query;

  if (error) {
    console.error("Error fetching sync logs:", error);
    return NextResponse.json({ error: "Failed to fetch sync logs" }, { status: 500 });
  }

  return NextResponse.json({
    data: logs,
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: (offset + limit) < (count || 0),
    },
  });
}
