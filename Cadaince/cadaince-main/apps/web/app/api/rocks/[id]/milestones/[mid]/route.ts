import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// PATCH /api/rocks/:id/milestones/:mid - Update milestone
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rockId, mid: milestoneId } = await params;
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
  const { title, description, due_date, status, sort_order } = body;

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (due_date !== undefined) updateData.due_date = due_date;
  if (status !== undefined) {
    updateData.status = status;
    // Set completed_at when marking complete
    if (status === "complete") {
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.completed_at = null;
    }
  }
  if (sort_order !== undefined) updateData.sort_order = sort_order;

  const { data: milestone, error } = await supabase
    .from("rock_milestones")
    .update(updateData)
    .eq("id", milestoneId)
    .eq("rock_id", rockId)
    .select()
    .single();

  if (error) {
    console.error("Error updating milestone:", error);
    return NextResponse.json({ error: "Failed to update milestone" }, { status: 500 });
  }

  if (!milestone) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }

  return NextResponse.json(milestone);
}

// DELETE /api/rocks/:id/milestones/:mid - Delete milestone
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rockId, mid: milestoneId } = await params;
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

  const { error } = await supabase
    .from("rock_milestones")
    .delete()
    .eq("id", milestoneId)
    .eq("rock_id", rockId);

  if (error) {
    console.error("Error deleting milestone:", error);
    return NextResponse.json({ error: "Failed to delete milestone" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
