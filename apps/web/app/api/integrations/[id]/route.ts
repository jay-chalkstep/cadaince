import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/integrations/[id] - Get a single integration
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

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  const { data: integration, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching integration:", error);
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  return NextResponse.json(integration);
}

// PUT /api/integrations/[id] - Update an integration
export async function PUT(
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
    .select("access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { name, is_active, config } = body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (is_active !== undefined) updates.is_active = is_active;
  if (config !== undefined) updates.config = config;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data: integration, error } = await supabase
    .from("integrations")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating integration:", error);
    return NextResponse.json({ error: "Failed to update integration" }, { status: 500 });
  }

  return NextResponse.json(integration);
}

// DELETE /api/integrations/[id] - Delete an integration
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
    .select("access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting integration:", error);
    return NextResponse.json({ error: "Failed to delete integration" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
