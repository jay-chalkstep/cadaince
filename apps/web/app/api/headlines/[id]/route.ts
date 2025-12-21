import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/headlines/:id - Get single headline
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

  const { data: headline, error } = await supabase
    .from("headlines")
    .select(`
      *,
      created_by_profile:profiles!headlines_created_by_fkey(
        id, full_name, avatar_url
      ),
      mentioned_member:profiles!headlines_mentioned_member_id_fkey(
        id, full_name, avatar_url
      )
    `)
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (error || !headline) {
    return NextResponse.json({ error: "Headline not found" }, { status: 404 });
  }

  return NextResponse.json(headline);
}

// DELETE /api/headlines/:id - Delete headline (creator only)
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Check if headline exists and user is creator or admin
  const { data: headline } = await supabase
    .from("headlines")
    .select("id, created_by")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!headline) {
    return NextResponse.json({ error: "Headline not found" }, { status: 404 });
  }

  const isCreator = headline.created_by === profile.id;
  const isAdmin = profile.access_level === "admin";

  if (!isCreator && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("headlines")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting headline:", error);
    return NextResponse.json({ error: "Failed to delete headline" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
