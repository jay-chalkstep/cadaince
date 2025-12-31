import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/updates/:id/read - Mark update as read
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
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Verify update exists
  const { data: update } = await supabase
    .from("updates")
    .select("id")
    .eq("id", id)
    .single();

  if (!update) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  // Upsert read state (insert or update if exists)
  const { data: readState, error } = await supabase
    .from("update_read_state")
    .upsert(
      {
        update_id: id,
        profile_id: profile.id,
        read_at: new Date().toISOString(),
      },
      {
        onConflict: "update_id,profile_id",
      }
    )
    .select()
    .single();

  if (error) {
    console.error("Error marking update as read:", error);
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    read_at: readState.read_at,
  });
}

// DELETE /api/updates/:id/read - Mark update as unread
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

  // Get current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Set read_at to null (keep acknowledged_at if set)
  const { error } = await supabase
    .from("update_read_state")
    .update({ read_at: null })
    .eq("update_id", id)
    .eq("profile_id", profile.id);

  if (error) {
    console.error("Error marking update as unread:", error);
    return NextResponse.json({ error: "Failed to mark as unread" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
