import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/updates/:id/convert-to-issue - Create issue from update
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  // Get current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Get the update to verify it exists and isn't already converted
  const { data: update, error: updateError } = await supabase
    .from("updates")
    .select("id, converted_to_issue_id, organization_id")
    .eq("id", id)
    .single();

  if (updateError || !update) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  // Verify same organization
  if (update.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if already converted
  if (update.converted_to_issue_id) {
    return NextResponse.json(
      { error: "Update has already been converted to an issue" },
      { status: 400 }
    );
  }

  // Parse request body
  const body = await req.json();
  const {
    title,
    description,
    owner_id,
    priority = 2,
    linked_rock_id,
  } = body;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Create the issue
  const { data: issue, error: issueError } = await supabase
    .from("issues")
    .insert({
      title,
      description: description || null,
      owner_id: owner_id || null,
      raised_by: profile.id,
      created_by: profile.id,
      priority: Math.max(1, Math.min(3, priority)),
      linked_rock_id: linked_rock_id || null,
      source: "update",
      source_ref: id,
      source_update_id: id,
      status: "open",
      organization_id: profile.organization_id,
    })
    .select(`
      id,
      title,
      description,
      status,
      priority,
      owner:profiles!issues_owner_id_fkey(id, full_name),
      linked_rock:rocks(id, title)
    `)
    .single();

  if (issueError) {
    console.error("Error creating issue:", issueError);
    return NextResponse.json({ error: "Failed to create issue" }, { status: 500 });
  }

  // Update the update to link to the issue
  const { error: linkError } = await supabase
    .from("updates")
    .update({
      converted_to_issue_id: issue.id,
      converted_at: new Date().toISOString(),
      converted_by: profile.id,
    })
    .eq("id", id);

  if (linkError) {
    console.error("Error linking update to issue:", linkError);
    // Don't fail the request - issue was created successfully
  }

  return NextResponse.json({
    success: true,
    issue,
  }, { status: 201 });
}
