import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/accountability-chart/seats/:id/descendants
// Returns all descendant seats of a given seat (for circular hierarchy prevention)
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Verify seat exists in this org
  const { data: seat } = await supabase
    .from("seats")
    .select("id")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!seat) {
    return NextResponse.json({ error: "Seat not found" }, { status: 404 });
  }

  // Get all descendants using the existing database function
  const { data: descendants, error } = await supabase.rpc("get_seat_descendants", {
    p_seat_id: id,
  });

  if (error) {
    console.error("Error fetching descendants:", error);
    return NextResponse.json({ error: "Failed to fetch descendants" }, { status: 500 });
  }

  return NextResponse.json(descendants || []);
}
