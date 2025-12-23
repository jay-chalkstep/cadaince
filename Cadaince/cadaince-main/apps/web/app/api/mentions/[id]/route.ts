import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/mentions/[id] - Mark a mention as read
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

  // Get user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Verify mention belongs to this user
  const { data: mention } = await supabase
    .from("mentions")
    .select("id, mentioned_id")
    .eq("id", id)
    .single();

  if (!mention) {
    return NextResponse.json({ error: "Mention not found" }, { status: 404 });
  }

  if (mention.mentioned_id !== profile.id) {
    return NextResponse.json({ error: "Cannot mark other users' mentions as read" }, { status: 403 });
  }

  // Mark as read
  const { error } = await supabase
    .from("mentions")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error marking mention read:", error);
    return NextResponse.json({ error: "Failed to mark mention read" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
