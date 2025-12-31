import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/updates/:id/acknowledge - Acknowledge update ("I've got this")
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

  const now = new Date().toISOString();

  // Upsert read state with acknowledgment
  // Also mark as read if not already (acknowledging implies reading)
  const { data: readState, error } = await supabase
    .from("update_read_state")
    .upsert(
      {
        update_id: id,
        profile_id: profile.id,
        acknowledged_at: now,
        read_at: now, // Also mark as read when acknowledging
      },
      {
        onConflict: "update_id,profile_id",
      }
    )
    .select()
    .single();

  if (error) {
    console.error("Error acknowledging update:", error);
    return NextResponse.json({ error: "Failed to acknowledge" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    acknowledged_at: readState.acknowledged_at,
    read_at: readState.read_at,
  });
}

// DELETE /api/updates/:id/acknowledge - Remove acknowledgment
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

  // Set acknowledged_at to null (keep read_at)
  const { error } = await supabase
    .from("update_read_state")
    .update({ acknowledged_at: null })
    .eq("update_id", id)
    .eq("profile_id", profile.id);

  if (error) {
    console.error("Error removing acknowledgment:", error);
    return NextResponse.json({ error: "Failed to remove acknowledgment" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
