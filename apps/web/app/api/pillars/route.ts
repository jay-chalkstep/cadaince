import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/pillars - List all pillars for the user's organization
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json([]);
  }

  const url = new URL(req.url);
  const includeMembers = url.searchParams.get("include_members") === "true";

  const { data: pillars, error } = await supabase
    .from("pillars")
    .select(`
      id,
      name,
      slug,
      description,
      color,
      sort_order,
      anchor_seat_id,
      leader:profiles!pillars_leader_id_fkey(id, full_name, avatar_url),
      anchor_seat:seats!pillars_anchor_seat_id_fkey(
        id,
        name,
        eos_role
      )
    `)
    .eq("organization_id", profile.organization_id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching pillars:", error);
    return NextResponse.json({ error: "Failed to fetch pillars" }, { status: 500 });
  }

  // Get member counts and optionally full members for each pillar
  const pillarsWithData = await Promise.all(
    pillars.map(async (pillar) => {
      // Get computed members from pillar_memberships view
      const { data: computedMembers, count: computedCount } = await supabase
        .from("pillar_memberships")
        .select("profile_id, is_lead", { count: "exact" })
        .eq("pillar_id", pillar.id);

      // Fallback: also count legacy profiles.pillar_id members
      const { count: legacyCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("pillar_id", pillar.id)
        .eq("status", "active");

      const member_count = Math.max(computedCount || 0, legacyCount || 0);

      // If including full members, fetch profile details
      let computed_members = undefined;
      if (includeMembers && computedMembers && computedMembers.length > 0) {
        const profileIds = computedMembers.map(m => m.profile_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, title")
          .in("id", profileIds);

        computed_members = computedMembers.map(m => ({
          ...m,
          profile: profiles?.find(p => p.id === m.profile_id),
        }));
      }

      return {
        ...pillar,
        member_count,
        computed_members,
      };
    })
  );

  return NextResponse.json(pillarsWithData);
}

// POST /api/pillars - Create a new pillar (admin only)
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Check if user is admin and get organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  if (!profile.organization_id) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const body = await req.json();
  const { name, slug, description, color, sort_order, leader_id, anchor_seat_id } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Generate slug if not provided
  const pillarSlug = slug || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const { data: pillar, error } = await supabase
    .from("pillars")
    .insert({
      name,
      slug: pillarSlug,
      description,
      color: color || "#6366F1",
      sort_order: sort_order || 0,
      leader_id,
      anchor_seat_id,
      organization_id: profile.organization_id,
    })
    .select(`
      id,
      name,
      slug,
      description,
      color,
      sort_order,
      anchor_seat_id,
      leader:profiles!pillars_leader_id_fkey(id, full_name, avatar_url),
      anchor_seat:seats!pillars_anchor_seat_id_fkey(id, name, eos_role)
    `)
    .single();

  if (error) {
    console.error("Error creating pillar:", error);
    return NextResponse.json({ error: "Failed to create pillar" }, { status: 500 });
  }

  return NextResponse.json(pillar, { status: 201 });
}
