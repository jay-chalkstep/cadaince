import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { emitIntegrationEvent } from "@/lib/inngest/emit";

// GET /api/rocks/:id - Get single rock with cascade info
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const includeChildren = searchParams.get("include") === "children";
  const includeAncestors = searchParams.get("include") === "ancestors";

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

  const { data: rock, error } = await supabase
    .from("rocks")
    .select(`
      *,
      owner:profiles!owner_id(id, full_name, avatar_url, email, title),
      pillar:pillars!pillar_id(id, name, color),
      parent:rocks!parent_rock_id(id, title, rock_level, status),
      quarter:quarters!quarter_id(id, year, quarter, planning_status, start_date, end_date)
    `)
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (error || !rock) {
    return NextResponse.json({ error: "Rock not found" }, { status: 404 });
  }

  // Get related milestones
  const { data: milestones } = await supabase
    .from("rock_milestones")
    .select("*")
    .eq("rock_id", id)
    .order("due_date", { ascending: true });

  let result: Record<string, unknown> = {
    ...rock,
    milestones: milestones || [],
  };

  // Include children (pillar/individual rocks under this one)
  if (includeChildren) {
    const { data: children } = await supabase
      .from("rocks")
      .select(`
        *,
        owner:profiles!owner_id(id, full_name, avatar_url),
        pillar:pillars!pillar_id(id, name, color)
      `)
      .eq("parent_rock_id", id)
      .order("rock_level", { ascending: true })
      .order("title", { ascending: true });

    // For company rocks, also get grandchildren (individual rocks)
    if (rock.rock_level === "company" && children && children.length > 0) {
      const childIds = children.map((c) => c.id);
      const { data: grandchildren } = await supabase
        .from("rocks")
        .select(`
          *,
          owner:profiles!owner_id(id, full_name, avatar_url),
          pillar:pillars!pillar_id(id, name, color)
        `)
        .in("parent_rock_id", childIds)
        .order("title", { ascending: true });

      // Nest grandchildren under their parents
      const childrenWithGrandchildren = children.map((child) => ({
        ...child,
        children: (grandchildren || []).filter((gc) => gc.parent_rock_id === child.id),
      }));

      result.children = childrenWithGrandchildren;
    } else {
      result.children = children || [];
    }
  }

  // Include ancestors (parent chain up to company rock)
  if (includeAncestors && rock.parent_rock_id) {
    const ancestors: Array<Record<string, unknown>> = [];
    let currentParentId = rock.parent_rock_id;

    while (currentParentId) {
      const { data: parent } = await supabase
        .from("rocks")
        .select(`
          id, title, rock_level, status, parent_rock_id,
          owner:profiles!owner_id(id, full_name, avatar_url)
        `)
        .eq("id", currentParentId)
        .single();

      if (parent) {
        ancestors.push(parent);
        currentParentId = parent.parent_rock_id;
      } else {
        break;
      }
    }

    result.ancestors = ancestors.reverse(); // From company down to immediate parent
  }

  return NextResponse.json(result);
}

// PATCH /api/rocks/:id - Update rock with cascade fields
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

  // Get the rock to check ownership and org
  const { data: rock } = await supabase
    .from("rocks")
    .select("owner_id, organization_id, rock_level, pillar_id, status")
    .eq("id", id)
    .single();

  if (!rock) {
    return NextResponse.json({ error: "Rock not found" }, { status: 404 });
  }

  if (rock.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Rock not found" }, { status: 404 });
  }

  // Check if user is admin, elt, owner, or pillar lead
  const isAdmin = profile.access_level === "admin";
  const isElt = profile.access_level === "elt" || profile.is_elt;
  const isOwner = rock.owner_id === profile.id;

  // Check pillar lead status if not already authorized
  let isPillarLead = false;
  if (!isAdmin && !isElt && !isOwner && rock.pillar_id) {
    const { data: membership } = await supabase
      .from("team_member_pillars")
      .select("is_lead")
      .eq("team_member_id", profile.id)
      .eq("pillar_id", rock.pillar_id)
      .single();
    isPillarLead = membership?.is_lead || false;
  }

  if (!isAdmin && !isElt && !isOwner && !isPillarLead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    title,
    name, // Legacy
    description,
    owner_id,
    status,
    due_date,
    quarter,
    quarter_id,
    rock_level,
    parent_rock_id,
    pillar_id,
    linked_metric_id,
  } = body;

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (name !== undefined && title === undefined) updateData.title = name; // Legacy
  if (description !== undefined) updateData.description = description;
  if (owner_id !== undefined) updateData.owner_id = owner_id;
  if (status !== undefined) updateData.status = status;
  if (due_date !== undefined) updateData.due_date = due_date;
  if (quarter !== undefined) updateData.quarter = quarter;
  if (quarter_id !== undefined) updateData.quarter_id = quarter_id;
  if (rock_level !== undefined) updateData.rock_level = rock_level;
  if (parent_rock_id !== undefined) updateData.parent_rock_id = parent_rock_id;
  if (pillar_id !== undefined) updateData.pillar_id = pillar_id;
  if (linked_metric_id !== undefined) updateData.linked_metric_id = linked_metric_id;

  const { data: updated, error } = await supabase
    .from("rocks")
    .update(updateData)
    .eq("id", id)
    .select(`
      *,
      owner:profiles!owner_id(id, full_name, avatar_url, title),
      pillar:pillars!pillar_id(id, name, color),
      parent:rocks!parent_rock_id(id, title, rock_level),
      quarter:quarters!quarter_id(id, year, quarter, planning_status)
    `)
    .single();

  if (error) {
    console.error("Error updating rock:", error);
    return NextResponse.json({ error: "Failed to update rock" }, { status: 500 });
  }

  // Emit integration event for status change (for Slack notifications, etc.)
  if (status !== undefined && status !== rock.status) {
    await emitIntegrationEvent("rock/status.changed", {
      organization_id: profile.organization_id,
      rock_id: id,
      title: updated.title,
      old_status: rock.status,
      new_status: status,
      owner_id: updated.owner_id,
      rock_level: updated.rock_level,
    });
  }

  return NextResponse.json(updated);
}

// DELETE /api/rocks/:id - Delete rock
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
    .select("organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if rock has children
  const { data: children } = await supabase
    .from("rocks")
    .select("id")
    .eq("parent_rock_id", id)
    .limit(1);

  if (children && children.length > 0) {
    return NextResponse.json(
      { error: "Cannot delete rock with child rocks. Delete children first." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("rocks")
    .delete()
    .eq("id", id)
    .eq("organization_id", profile.organization_id);

  if (error) {
    console.error("Error deleting rock:", error);
    return NextResponse.json({ error: "Failed to delete rock" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
