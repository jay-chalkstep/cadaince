import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/rocks/:id/milestones - List milestones for a rock
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rockId } = await params;
  const supabase = createAdminClient();

  // Get user's organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Verify rock exists in this org
  const { data: rock } = await supabase
    .from("rocks")
    .select("id")
    .eq("id", rockId)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!rock) {
    return NextResponse.json({ error: "Rock not found" }, { status: 404 });
  }

  const { data: milestones, error } = await supabase
    .from("rock_milestones")
    .select("*")
    .eq("rock_id", rockId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching milestones:", error);
    return NextResponse.json({ error: "Failed to fetch milestones" }, { status: 500 });
  }

  // Add is_overdue field
  const today = new Date().toISOString().split("T")[0];
  const enrichedMilestones = milestones.map(m => ({
    ...m,
    is_overdue: m.due_date && m.due_date < today && m.status !== "complete",
  }));

  return NextResponse.json(enrichedMilestones);
}

// POST /api/rocks/:id/milestones - Create milestone
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

  // Check permission: owner, admin, or ELT
  const canEdit =
    rock.owner_id === profile.id ||
    ["admin", "elt"].includes(profile.access_level || "");

  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, due_date, status } = body;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Get max sort_order
  const { data: lastMilestone } = await supabase
    .from("rock_milestones")
    .select("sort_order")
    .eq("rock_id", rockId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (lastMilestone?.sort_order ?? -1) + 1;

  const { data: milestone, error } = await supabase
    .from("rock_milestones")
    .insert({
      rock_id: rockId,
      title,
      description: description || null,
      due_date: due_date || null,
      status: status || "not_started",
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating milestone:", error);
    return NextResponse.json({ error: "Failed to create milestone" }, { status: 500 });
  }

  return NextResponse.json(milestone, { status: 201 });
}
