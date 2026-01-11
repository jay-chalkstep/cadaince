import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/governance-bodies - List all governance bodies for the organization
 *
 * Returns governance bodies (ELT, SLT, custom) with member counts.
 * These are curated leadership groups, NOT derived from AC.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Fetch governance bodies with member counts
  const { data: bodies, error } = await supabase
    .from("governance_bodies")
    .select(`
      id,
      name,
      slug,
      description,
      body_type,
      l10_required,
      is_confidential,
      settings,
      created_at,
      updated_at
    `)
    .eq("organization_id", profile.organization_id)
    .order("body_type", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching governance bodies:", error);
    return NextResponse.json({ error: "Failed to fetch governance bodies" }, { status: 500 });
  }

  // Get member counts for each body
  const bodiesWithCounts = await Promise.all(
    bodies.map(async (body) => {
      const { count } = await supabase
        .from("governance_body_memberships")
        .select("*", { count: "exact", head: true })
        .eq("governance_body_id", body.id);

      return {
        ...body,
        member_count: count || 0,
      };
    })
  );

  return NextResponse.json({ governance_bodies: bodiesWithCounts });
}

/**
 * POST /api/governance-bodies - Create a new governance body
 *
 * Admin only. Creates a new curated leadership group.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's profile and check permissions
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Only admin and elt can create governance bodies
  if (!["admin", "elt"].includes(profile.access_level)) {
    return NextResponse.json({ error: "Forbidden - Admin or ELT access required" }, { status: 403 });
  }

  const body = await req.json();
  const { name, slug, description, body_type, l10_required, is_confidential, settings } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!body_type || !["elt", "slt", "custom"].includes(body_type)) {
    return NextResponse.json({ error: "Valid body_type is required (elt, slt, custom)" }, { status: 400 });
  }

  // Generate slug if not provided
  const bodySlug = slug || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const { data: governanceBody, error } = await supabase
    .from("governance_bodies")
    .insert({
      organization_id: profile.organization_id,
      name,
      slug: bodySlug,
      description,
      body_type,
      l10_required: l10_required ?? true,
      is_confidential: is_confidential ?? (body_type === "elt"),
      settings: settings || {},
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating governance body:", error);
    if (error.code === "23505") {
      return NextResponse.json({ error: "A governance body with this slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create governance body" }, { status: 500 });
  }

  return NextResponse.json(governanceBody, { status: 201 });
}
