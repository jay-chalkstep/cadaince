import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/quarters/[id] - Get a single quarter with rocks
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

  // Get current user's organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const includeRocks = searchParams.get("include_rocks") === "true";

  // Get quarter
  const { data: quarter, error } = await supabase
    .from("quarters")
    .select("*")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (error || !quarter) {
    return NextResponse.json({ error: "Quarter not found" }, { status: 404 });
  }

  // Mark if current
  const now = new Date();
  const quarterData = {
    ...quarter,
    is_current:
      new Date(quarter.start_date) <= now && new Date(quarter.end_date) >= now,
  };

  // Optionally include rocks
  if (includeRocks) {
    const { data: rocks } = await supabase
      .from("rocks")
      .select(`
        *,
        owner:profiles!owner_id(id, full_name, avatar_url, title),
        pillar:pillars(id, name, color)
      `)
      .eq("quarter_id", id)
      .order("rock_level", { ascending: true })
      .order("title", { ascending: true });

    return NextResponse.json({
      ...quarterData,
      rocks: rocks || [],
    });
  }

  return NextResponse.json(quarterData);
}

// PATCH /api/quarters/[id] - Update a quarter
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
    .select("id, organization_id, access_level, is_elt")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Only admin and ELT can update quarters
  if (profile.access_level !== "admin" && profile.access_level !== "elt" && !profile.is_elt) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify quarter belongs to org
  const { data: existingQuarter } = await supabase
    .from("quarters")
    .select("id")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!existingQuarter) {
    return NextResponse.json({ error: "Quarter not found" }, { status: 404 });
  }

  const body = await req.json();
  const { start_date, end_date, planning_status } = body;

  const updateData: Record<string, unknown> = {};
  if (start_date !== undefined) updateData.start_date = start_date;
  if (end_date !== undefined) updateData.end_date = end_date;
  if (planning_status !== undefined) updateData.planning_status = planning_status;

  const { data: quarter, error } = await supabase
    .from("quarters")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating quarter:", error);
    return NextResponse.json({ error: "Failed to update quarter" }, { status: 500 });
  }

  return NextResponse.json(quarter);
}

// DELETE /api/quarters/[id] - Delete a quarter
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

  // Get current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Only admins can delete quarters
  if (profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  // Check if quarter has rocks
  const { data: rocks } = await supabase
    .from("rocks")
    .select("id")
    .eq("quarter_id", id)
    .limit(1);

  if (rocks && rocks.length > 0) {
    return NextResponse.json(
      { error: "Cannot delete quarter with rocks. Remove or reassign rocks first." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("quarters")
    .delete()
    .eq("id", id)
    .eq("organization_id", profile.organization_id);

  if (error) {
    console.error("Error deleting quarter:", error);
    return NextResponse.json({ error: "Failed to delete quarter" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
