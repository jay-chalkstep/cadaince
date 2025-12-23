import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/accountability-chart/functions - Get all functions for org
export async function GET() {
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
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Get all functions for this org (EOS defaults + custom)
  const { data: functions, error } = await supabase
    .from("seat_functions")
    .select(`
      *,
      assignments:seat_function_assignments(
        id,
        seat_id,
        assignment_type,
        sort_order,
        seat:seats!seat_function_assignments_seat_id_fkey(id, name)
      )
    `)
    .eq("organization_id", profile.organization_id)
    .eq("is_hidden", false)
    .order("sort_order")
    .order("name");

  if (error) {
    console.error("Error fetching functions:", error);
    return NextResponse.json({ error: "Failed to fetch functions" }, { status: 500 });
  }

  // Group by category for easier UI consumption
  const categories = new Map<string, typeof functions>();
  functions?.forEach((fn) => {
    const cat = fn.category || "other";
    if (!categories.has(cat)) {
      categories.set(cat, []);
    }
    categories.get(cat)!.push(fn);
  });

  return NextResponse.json({
    functions: functions || [],
    byCategory: Object.fromEntries(categories),
  });
}

// POST /api/accountability-chart/functions - Create a new custom function
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

  // Only admin and ELT can create functions
  if (!["admin", "elt"].includes(profile.access_level || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, category, icon } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Get next sort_order for this category
  const { data: lastFn } = await supabase
    .from("seat_functions")
    .select("sort_order")
    .eq("organization_id", profile.organization_id)
    .eq("category", category || "other")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextSortOrder = (lastFn?.sort_order || 0) + 1;

  const { data: fn, error } = await supabase
    .from("seat_functions")
    .insert({
      organization_id: profile.organization_id,
      name,
      description: description || null,
      category: category || "other",
      icon: icon || null,
      is_eos_default: false,
      is_custom: true,
      sort_order: nextSortOrder,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating function:", error);
    return NextResponse.json({ error: "Failed to create function" }, { status: 500 });
  }

  return NextResponse.json(fn, { status: 201 });
}
