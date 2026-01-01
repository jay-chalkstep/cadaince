import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { emitIntegrationEvent } from "@/lib/inngest/emit";

// GET /api/headlines - List headlines
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const meetingId = searchParams.get("meeting_id");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = parseInt(searchParams.get("offset") || "0");
  const type = searchParams.get("type"); // customer, employee, general

  const supabase = createAdminClient();

  // Get user's organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  let query = supabase
    .from("headlines")
    .select(`
      *,
      created_by_profile:profiles!headlines_created_by_fkey(
        id, full_name, avatar_url, email
      ),
      mentioned_member:profiles!headlines_mentioned_member_id_fkey(
        id, full_name, avatar_url
      ),
      meeting:meetings!headlines_meeting_id_fkey(
        id, scheduled_at, type
      )
    `)
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (meetingId) {
    query = query.eq("meeting_id", meetingId);
  }

  if (type) {
    query = query.eq("headline_type", type);
  }

  const { data: headlines, error } = await query;

  if (error) {
    console.error("Error fetching headlines:", error);
    return NextResponse.json({ error: "Failed to fetch headlines" }, { status: 500 });
  }

  return NextResponse.json(headlines);
}

// POST /api/headlines - Create headline
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const body = await req.json();
  const {
    title,
    description,
    headline_type,
    mentioned_member_id,
    meeting_id,
  } = body;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Validate mentioned_member_id is in same org
  if (mentioned_member_id) {
    const { data: member } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", mentioned_member_id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Mentioned member not found" }, { status: 400 });
    }
  }

  const { data: headline, error } = await supabase
    .from("headlines")
    .insert({
      organization_id: profile.organization_id,
      title,
      description: description || null,
      headline_type: headline_type || "general",
      created_by: profile.id,
      mentioned_member_id: mentioned_member_id || null,
      meeting_id: meeting_id || null,
      shared_at: meeting_id ? new Date().toISOString() : null,
      reactions: {},
    })
    .select(`
      *,
      created_by_profile:profiles!headlines_created_by_fkey(
        id, full_name, avatar_url
      ),
      mentioned_member:profiles!headlines_mentioned_member_id_fkey(
        id, full_name, avatar_url
      )
    `)
    .single();

  if (error) {
    console.error("Error creating headline:", error);
    return NextResponse.json({ error: "Failed to create headline" }, { status: 500 });
  }

  // Emit integration event for headline creation
  await emitIntegrationEvent("headline/created", {
    organization_id: profile.organization_id,
    headline_id: headline.id,
    title: headline.title,
    headline_type: headline.headline_type,
    created_by: profile.id,
    mentioned_member_id: headline.mentioned_member_id,
    mentioned_member_name: headline.mentioned_member?.full_name,
  });

  return NextResponse.json(headline, { status: 201 });
}
