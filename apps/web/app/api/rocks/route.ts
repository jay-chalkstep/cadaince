import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/rocks - List all rocks
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const quarter = searchParams.get("quarter");
  const year = searchParams.get("year");
  const status = searchParams.get("status");
  const ownerId = searchParams.get("owner_id");

  const supabase = createAdminClient();

  let query = supabase
    .from("rocks")
    .select(`
      *,
      owner:profiles!rocks_owner_id_fkey(id, full_name, avatar_url),
      pillar:pillars!rocks_pillar_id_fkey(id, name)
    `)
    .order("created_at", { ascending: false });

  if (quarter) {
    query = query.eq("quarter", parseInt(quarter));
  }
  if (year) {
    query = query.eq("year", parseInt(year));
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (ownerId) {
    query = query.eq("owner_id", ownerId);
  }

  const { data: rocks, error } = await query;

  if (error) {
    console.error("Error fetching rocks:", error);
    return NextResponse.json({ error: "Failed to fetch rocks" }, { status: 500 });
  }

  return NextResponse.json(rocks);
}

// POST /api/rocks - Create a new rock
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Only admin and ELT can create rocks
  if (profile.access_level !== "admin" && profile.access_level !== "elt") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, pillar_id, owner_id, quarter, year } = body;

  if (!name || !owner_id) {
    return NextResponse.json(
      { error: "Name and owner_id are required" },
      { status: 400 }
    );
  }

  // Default to current quarter/year if not specified
  const now = new Date();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
  const currentYear = now.getFullYear();

  const { data: rock, error } = await supabase
    .from("rocks")
    .insert({
      name,
      description,
      pillar_id: pillar_id || null,
      owner_id,
      status: "not_started",
      quarter: quarter || currentQuarter,
      year: year || currentYear,
    })
    .select(`
      *,
      owner:profiles!rocks_owner_id_fkey(id, full_name, avatar_url),
      pillar:pillars!rocks_pillar_id_fkey(id, name)
    `)
    .single();

  if (error) {
    console.error("Error creating rock:", error);
    return NextResponse.json({ error: "Failed to create rock" }, { status: 500 });
  }

  return NextResponse.json(rock, { status: 201 });
}
