import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/team - List all team members for the user's organization
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's organization
  const { data: currentUser } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!currentUser?.organization_id) {
    return NextResponse.json([]);
  }

  const { searchParams } = new URL(req.url);
  const pillarId = searchParams.get("pillar_id");
  const status = searchParams.get("status");

  let query = supabase
    .from("profiles")
    .select(`
      *,
      pillar:pillars!profiles_pillar_id_fkey(id, name, slug, color)
    `)
    .eq("organization_id", currentUser.organization_id)
    .order("full_name", { ascending: true });

  if (pillarId) {
    query = query.eq("pillar_id", pillarId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data: teamMembers, error } = await query;

  if (error) {
    console.error("Error fetching team members:", error);
    return NextResponse.json({ error: "Failed to fetch team members" }, { status: 500 });
  }

  return NextResponse.json(teamMembers);
}

// POST /api/team - Create a new team member (admin only, for invites)
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Check if user is admin and get organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, access_level, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  if (!profile.organization_id) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const body = await req.json();
  const {
    email,
    full_name,
    title,
    role,
    access_level,
    pillar_id,
    is_pillar_lead,
    responsibilities,
    receives_briefing,
    briefing_time,
    timezone,
  } = body;

  if (!email || !full_name) {
    return NextResponse.json(
      { error: "Email and full_name are required" },
      { status: 400 }
    );
  }

  // Check if email already exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (existingProfile) {
    return NextResponse.json(
      { error: "A team member with this email already exists" },
      { status: 400 }
    );
  }

  // Create profile with invited status (no clerk_id yet)
  const { data: newMember, error } = await supabase
    .from("profiles")
    .insert({
      clerk_id: `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`, // Temp ID until Clerk signup
      email,
      full_name,
      title,
      role: role || title || "Team Member",
      access_level: access_level || "slt",
      pillar_id,
      is_pillar_lead: is_pillar_lead || false,
      responsibilities: responsibilities || [],
      receives_briefing: receives_briefing ?? true,
      briefing_time: briefing_time || "07:00",
      timezone: timezone || "America/Denver",
      status: "invited",
      invited_at: new Date().toISOString(),
      organization_id: profile.organization_id,
    })
    .select(`
      *,
      pillar:pillars!profiles_pillar_id_fkey(id, name, slug, color)
    `)
    .single();

  if (error) {
    console.error("Error creating team member:", error);
    return NextResponse.json({ error: "Failed to create team member" }, { status: 500 });
  }

  return NextResponse.json(newMember, { status: 201 });
}
