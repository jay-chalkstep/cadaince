import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/vto - Get the organization's V/TO
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: vto, error } = await supabase
    .from("vto")
    .select(`
      *,
      updated_by_profile:profiles!vto_updated_by_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching VTO:", error);
    return NextResponse.json({ error: "Failed to fetch VTO" }, { status: 500 });
  }

  // If no VTO exists, return empty template
  if (!vto) {
    return NextResponse.json({
      id: null,
      core_values: [],
      purpose: null,
      niche: null,
      ten_year_target: null,
      ten_year_target_date: null,
      target_market: null,
      three_uniques: [],
      proven_process: null,
      guarantee: null,
      three_year_revenue: null,
      three_year_profit: null,
      three_year_measurables: [],
      three_year_description: null,
      three_year_target_date: null,
      one_year_revenue: null,
      one_year_profit: null,
      one_year_goals: [],
      one_year_target_date: null,
    });
  }

  return NextResponse.json(vto);
}

// PUT /api/vto - Update the V/TO (admin only)
export async function PUT(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { section, ...updates } = body;

  // Get existing VTO for history
  const { data: existingVto } = await supabase
    .from("vto")
    .select("*")
    .single();

  let vtoId = existingVto?.id;

  // Build previous values for history (only changed fields)
  const previousValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  if (existingVto) {
    for (const key of Object.keys(updates)) {
      if (JSON.stringify(existingVto[key]) !== JSON.stringify(updates[key])) {
        previousValues[key] = existingVto[key];
        newValues[key] = updates[key];
      }
    }
  }

  if (existingVto) {
    // Update existing VTO
    const { data: vto, error } = await supabase
      .from("vto")
      .update({
        ...updates,
        updated_by: profile.id,
      })
      .eq("id", existingVto.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating VTO:", error);
      return NextResponse.json({ error: "Failed to update VTO" }, { status: 500 });
    }

    vtoId = vto.id;
  } else {
    // Create new VTO
    const { data: vto, error } = await supabase
      .from("vto")
      .insert({
        ...updates,
        updated_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating VTO:", error);
      return NextResponse.json({ error: "Failed to create VTO" }, { status: 500 });
    }

    vtoId = vto.id;
  }

  // Log history if there were changes
  if (Object.keys(newValues).length > 0) {
    await supabase.from("vto_history").insert({
      vto_id: vtoId,
      changed_by: profile.id,
      change_type: section || "update",
      section: section,
      previous_values: previousValues,
      new_values: newValues,
    });
  }

  // Fetch updated VTO
  const { data: updatedVto } = await supabase
    .from("vto")
    .select(`
      *,
      updated_by_profile:profiles!vto_updated_by_fkey(id, full_name, avatar_url)
    `)
    .eq("id", vtoId)
    .single();

  return NextResponse.json(updatedVto);
}
