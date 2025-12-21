import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/headlines/:id/react - Add/toggle reaction
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const body = await req.json();
  const { emoji } = body;

  if (!emoji) {
    return NextResponse.json({ error: "Emoji is required" }, { status: 400 });
  }

  // Get current headline
  const { data: headline, error: fetchError } = await supabase
    .from("headlines")
    .select("id, reactions")
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (fetchError || !headline) {
    return NextResponse.json({ error: "Headline not found" }, { status: 404 });
  }

  // Update reactions
  const reactions = (headline.reactions as Record<string, string[]>) || {};
  const emojiReactions = reactions[emoji] || [];
  const userIndex = emojiReactions.indexOf(profile.id);

  if (userIndex > -1) {
    // Remove reaction (toggle off)
    emojiReactions.splice(userIndex, 1);
    if (emojiReactions.length === 0) {
      delete reactions[emoji];
    } else {
      reactions[emoji] = emojiReactions;
    }
  } else {
    // Add reaction
    reactions[emoji] = [...emojiReactions, profile.id];
  }

  const { data: updated, error } = await supabase
    .from("headlines")
    .update({ reactions })
    .eq("id", id)
    .select("reactions")
    .single();

  if (error) {
    console.error("Error updating reactions:", error);
    return NextResponse.json({ error: "Failed to update reactions" }, { status: 500 });
  }

  return NextResponse.json({ reactions: updated.reactions });
}
