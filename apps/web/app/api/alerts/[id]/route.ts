import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/alerts/:id - Get single alert
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: alert, error } = await supabase
    .from("alerts")
    .select(`
      *,
      triggered_by_profile:profiles!alerts_triggered_by_fkey(id, full_name, avatar_url, email),
      update:updates(id, content, format, author:profiles!updates_author_id_fkey(id, full_name)),
      metric:metrics(id, name, goal, unit, owner:profiles!metrics_owner_id_fkey(id, full_name)),
      acknowledgments:alert_acknowledgments(
        id,
        profile_id,
        acknowledged_at,
        profile:profiles(id, full_name, avatar_url)
      )
    `)
    .eq("id", id)
    .single();

  if (error || !alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  return NextResponse.json(alert);
}

// POST /api/alerts/:id/acknowledge - Acknowledge an alert
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  // Get current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Check if already acknowledged
  const { data: existing } = await supabase
    .from("alert_acknowledgments")
    .select("id")
    .eq("alert_id", id)
    .eq("profile_id", profile.id)
    .single();

  if (existing) {
    return NextResponse.json({ message: "Already acknowledged" });
  }

  // Create acknowledgment
  const { error } = await supabase.from("alert_acknowledgments").insert({
    alert_id: id,
    profile_id: profile.id,
  });

  if (error) {
    console.error("Error acknowledging alert:", error);
    return NextResponse.json({ error: "Failed to acknowledge" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/alerts/:id - Delete alert (admin only)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("alerts").delete().eq("id", id);

  if (error) {
    console.error("Error deleting alert:", error);
    return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
