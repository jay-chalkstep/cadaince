import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/issues - List all issues
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const ownerId = searchParams.get("owner_id");

  const supabase = createAdminClient();

  // Get current user's organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json([]);
  }

  let query = supabase
    .from("issues")
    .select(`
      *,
      queued_for_meeting_id,
      owner:profiles!issues_owner_id_fkey(id, full_name, avatar_url),
      raised_by_profile:profiles!issues_raised_by_fkey(id, full_name, avatar_url),
      created_by_profile:profiles!issues_created_by_fkey(id, full_name, avatar_url)
    `)
    .eq("organization_id", profile.organization_id)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  } else {
    // Default to open issues
    query = query.eq("status", "open");
  }

  if (priority) {
    query = query.eq("priority", parseInt(priority));
  }
  if (ownerId) {
    query = query.eq("owner_id", ownerId);
  }

  const { data: issues, error } = await query;

  if (error) {
    console.error("Error fetching issues:", error);
    return NextResponse.json({ error: "Failed to fetch issues" }, { status: 500 });
  }

  return NextResponse.json(issues);
}

// POST /api/issues - Create a new issue
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get current user's profile with organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (!profile.organization_id) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, owner_id, priority, linked_rock_id } = body;

  if (!title) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400 }
    );
  }

  const { data: issue, error } = await supabase
    .from("issues")
    .insert({
      title,
      description: description || null,
      owner_id: owner_id || profile.id,
      organization_id: profile.organization_id,
      // Keep legacy column populated for backwards-compatible RLS + data integrity
      raised_by: profile.id,
      created_by: profile.id,
      priority: priority || 2, // Default to medium priority
      status: "open",
      linked_rock_id: linked_rock_id || null,
    })
    .select(`
      *,
      owner:profiles!issues_owner_id_fkey(id, full_name, avatar_url),
      created_by_profile:profiles!issues_created_by_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error("Error creating issue:", error);
    return NextResponse.json({ error: "Failed to create issue" }, { status: 500 });
  }

  return NextResponse.json(issue, { status: 201 });
}
