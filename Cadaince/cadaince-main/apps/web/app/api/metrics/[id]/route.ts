import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/metrics/:id - Get single metric with history
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

  const { data: metric, error } = await supabase
    .from("metrics")
    .select(`
      *,
      owner:profiles!metrics_owner_id_fkey(id, full_name, avatar_url, email)
    `)
    .eq("id", id)
    .single();

  if (error || !metric) {
    return NextResponse.json({ error: "Metric not found" }, { status: 404 });
  }

  // Get historical values (last 12 weeks)
  const { data: values } = await supabase
    .from("metric_values")
    .select("*")
    .eq("metric_id", id)
    .order("recorded_at", { ascending: false })
    .limit(12);

  // Get related updates
  const { data: updates } = await supabase
    .from("updates")
    .select(`
      id,
      content,
      format,
      video_url,
      thumbnail_url,
      published_at,
      author:profiles!updates_author_id_fkey(id, full_name, avatar_url)
    `)
    .eq("linked_metric_id", id)
    .eq("is_draft", false)
    .order("published_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    ...metric,
    values: values || [],
    updates: updates || [],
  });
}

// PATCH /api/metrics/:id - Update metric
export async function PATCH(
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
    .select("id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Get the metric to check ownership
  const { data: metric } = await supabase
    .from("metrics")
    .select("owner_id")
    .eq("id", id)
    .single();

  if (!metric) {
    return NextResponse.json({ error: "Metric not found" }, { status: 404 });
  }

  // Check if user is admin or owner
  if (profile.access_level !== "admin" && metric.owner_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    name,
    description,
    owner_id,
    goal,
    unit,
    frequency,
    threshold_red,
    threshold_yellow,
    display_order,
  } = body;

  const { data: updated, error } = await supabase
    .from("metrics")
    .update({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(owner_id !== undefined && { owner_id }),
      ...(goal !== undefined && { goal }),
      ...(unit !== undefined && { unit }),
      ...(frequency !== undefined && { frequency }),
      ...(threshold_red !== undefined && { threshold_red }),
      ...(threshold_yellow !== undefined && { threshold_yellow }),
      ...(display_order !== undefined && { display_order }),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating metric:", error);
    return NextResponse.json({ error: "Failed to update metric" }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/metrics/:id - Delete metric (admin only)
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

  const { error } = await supabase.from("metrics").delete().eq("id", id);

  if (error) {
    console.error("Error deleting metric:", error);
    return NextResponse.json({ error: "Failed to delete metric" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
