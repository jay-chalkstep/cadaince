import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface PositionUpdate {
  id: string;
  position_x: number;
  position_y: number;
}

/**
 * PATCH /api/accountability-chart/seats/positions - Bulk update seat positions
 *
 * Used by the chart canvas to persist manual layout positions efficiently.
 * Batches multiple position updates into a single request.
 */
export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Only admin and ELT can update positions
  if (!["admin", "elt"].includes(profile.access_level || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { updates } = body as { updates: PositionUpdate[] };

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "Updates array required" }, { status: 400 });
  }

  // Validate all updates have required fields
  for (const update of updates) {
    if (!update.id || typeof update.position_x !== "number" || typeof update.position_y !== "number") {
      return NextResponse.json(
        { error: "Each update must have id, position_x, and position_y" },
        { status: 400 }
      );
    }
  }

  // Get all seat IDs to verify they belong to this org
  const seatIds = updates.map((u) => u.id);
  const { data: existingSeats, error: fetchError } = await supabase
    .from("seats")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .in("id", seatIds);

  if (fetchError) {
    console.error("Error verifying seats:", fetchError);
    return NextResponse.json({ error: "Failed to verify seats" }, { status: 500 });
  }

  const validIds = new Set(existingSeats?.map((s) => s.id) || []);
  const invalidIds = seatIds.filter((id) => !validIds.has(id));

  if (invalidIds.length > 0) {
    return NextResponse.json(
      { error: `Seats not found: ${invalidIds.join(", ")}` },
      { status: 404 }
    );
  }

  // Perform batch update using a transaction
  const results: { id: string; success: boolean; error?: string }[] = [];

  for (const update of updates) {
    const { error } = await supabase
      .from("seats")
      .update({
        position_x: update.position_x,
        position_y: update.position_y,
      })
      .eq("id", update.id)
      .eq("organization_id", profile.organization_id);

    if (error) {
      results.push({ id: update.id, success: false, error: error.message });
    } else {
      results.push({ id: update.id, success: true });
    }
  }

  const failed = results.filter((r) => !r.success);
  if (failed.length > 0) {
    return NextResponse.json(
      { error: "Some updates failed", results },
      { status: 207 } // Multi-Status
    );
  }

  return NextResponse.json({ success: true, updated: results.length });
}
