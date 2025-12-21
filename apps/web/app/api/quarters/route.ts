import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/quarters - List quarters for the organization
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get current user's organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const year = searchParams.get("year");
  const includeCurrent = searchParams.get("include_current") === "true";

  let query = supabase
    .from("quarters")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .order("year", { ascending: false })
    .order("quarter", { ascending: false });

  if (status) {
    query = query.eq("planning_status", status);
  }

  if (year) {
    query = query.eq("year", parseInt(year));
  }

  const { data: quarters, error } = await query;

  if (error) {
    console.error("Error fetching quarters:", error);
    return NextResponse.json({ error: "Failed to fetch quarters" }, { status: 500 });
  }

  // Mark the current quarter
  const now = new Date();
  const quartersWithCurrent = quarters?.map((q) => ({
    ...q,
    is_current:
      new Date(q.start_date) <= now && new Date(q.end_date) >= now,
  }));

  return NextResponse.json(quartersWithCurrent);
}

// POST /api/quarters - Create a new quarter
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // Only admin and ELT can create quarters
  if (profile.access_level !== "admin" && profile.access_level !== "elt" && !profile.is_elt) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { year, quarter, start_date, end_date, planning_status } = body;

  if (!year || !quarter || !start_date || !end_date) {
    return NextResponse.json(
      { error: "year, quarter, start_date, and end_date are required" },
      { status: 400 }
    );
  }

  // Check for existing quarter
  const { data: existing } = await supabase
    .from("quarters")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .eq("year", year)
    .eq("quarter", quarter)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: `Q${quarter} ${year} already exists` },
      { status: 400 }
    );
  }

  const { data: newQuarter, error } = await supabase
    .from("quarters")
    .insert({
      organization_id: profile.organization_id,
      year,
      quarter,
      start_date,
      end_date,
      planning_status: planning_status || "upcoming",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating quarter:", error);
    return NextResponse.json({ error: "Failed to create quarter" }, { status: 500 });
  }

  return NextResponse.json(newQuarter, { status: 201 });
}
