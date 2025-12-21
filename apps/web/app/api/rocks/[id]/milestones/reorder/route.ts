import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/rocks/:id/milestones/reorder - Reorder milestones
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rockId } = await params;
  const supabase = createAdminClient();

  // Get user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Verify rock exists and user can edit it
  const { data: rock } = await supabase
    .from("rocks")
    .select("id, owner_id")
    .eq("id", rockId)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!rock) {
    return NextResponse.json({ error: "Rock not found" }, { status: 404 });
  }

  // Check permission
  const canEdit =
    rock.owner_id === profile.id ||
    ["admin", "elt"].includes(profile.access_level || "");

  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { milestone_ids } = body;

  if (!Array.isArray(milestone_ids)) {
    return NextResponse.json({ error: "milestone_ids array is required" }, { status: 400 });
  }

  // Update each milestone's sort_order
  const updates = milestone_ids.map((id: string, index: number) =>
    supabase
      .from("rock_milestones")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("rock_id", rockId)
  );

  try {
    await Promise.all(updates);
  } catch (error) {
    console.error("Error reordering milestones:", error);
    return NextResponse.json({ error: "Failed to reorder milestones" }, { status: 500 });
  }

  // Fetch updated milestones
  const { data: milestones } = await supabase
    .from("rock_milestones")
    .select("*")
    .eq("rock_id", rockId)
    .order("sort_order", { ascending: true });

  return NextResponse.json(milestones);
}
