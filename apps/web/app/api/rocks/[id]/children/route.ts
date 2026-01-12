import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/rocks/[id]/children - Get all descendant rocks (pillar + individual under a company rock)
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

  // Get user's organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Verify the rock exists and belongs to org
  const { data: rock, error: rockError } = await supabase
    .from("rocks")
    .select("id, rock_level, organization_id")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (rockError || !rock) {
    return NextResponse.json({ error: "Rock not found" }, { status: 404 });
  }

  // Get all descendants using recursive approach
  const { searchParams } = new URL(req.url);
  const flat = searchParams.get("flat") === "true";

  // Get direct children (pillar rocks)
  const { data: children, error: childrenError } = await supabase
    .from("rocks")
    .select(`
      *,
      owner:profiles!owner_id(id, full_name, avatar_url, title),
      pillar:pillars!pillar_id(id, name, color)
    `)
    .eq("parent_rock_id", id)
    .order("rock_level", { ascending: true })
    .order("title", { ascending: true });

  if (childrenError) {
    console.error("Error fetching rock children:", childrenError);
    return NextResponse.json({ error: "Failed to fetch children" }, { status: 500 });
  }

  if (!children || children.length === 0) {
    return NextResponse.json(flat ? [] : { children: [], grandchildren: [] });
  }

  // Get grandchildren (individual rocks under pillar rocks)
  const childIds = children.map((c) => c.id);
  const { data: grandchildren } = await supabase
    .from("rocks")
    .select(`
      *,
      owner:profiles!owner_id(id, full_name, avatar_url, title),
      pillar:pillars!pillar_id(id, name, color)
    `)
    .in("parent_rock_id", childIds)
    .order("title", { ascending: true });

  // Transform pillar to team for component compatibility
  const transformRock = (rock: any) => ({
    id: rock.id,
    title: rock.title,
    status: rock.status,
    rock_level: rock.rock_level,
    owner: rock.owner,
    team: rock.pillar, // Map pillar to team for cascade tree component
    children_count: 0,
    children_on_track: 0,
  });

  if (flat) {
    // Return flat list of all descendants
    return NextResponse.json([...children, ...(grandchildren || [])].map(transformRock));
  }

  // Return nested structure with cascade tree format
  const nestedChildren = children.map((child) => {
    const childGrandchildren = (grandchildren || []).filter((gc) => gc.parent_rock_id === child.id);
    const onTrack = childGrandchildren.filter((gc) => gc.status === "on_track" || gc.status === "complete").length;
    return {
      ...transformRock(child),
      children_count: childGrandchildren.length,
      children_on_track: onTrack,
      children: childGrandchildren.map(transformRock),
    };
  });

  return NextResponse.json({
    children: nestedChildren,
    stats: {
      pillar_rock_count: children.length,
      individual_rock_count: grandchildren?.length || 0,
      on_track: [...children, ...(grandchildren || [])].filter((r) => r.status === "on_track").length,
      at_risk: [...children, ...(grandchildren || [])].filter((r) => r.status === "at_risk").length,
      off_track: [...children, ...(grandchildren || [])].filter((r) => r.status === "off_track").length,
      complete: [...children, ...(grandchildren || [])].filter((r) => r.status === "complete").length,
    },
  });
}
