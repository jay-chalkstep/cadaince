import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import crypto from "crypto";

// POST /api/team/invite - Send an invitation to a new team member
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile || profile.access_level !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const {
    email,
    full_name,
    title,
    role,
    access_level,
    pillar_id,
    is_pillar_lead,
  } = body;

  if (!email || !full_name) {
    return NextResponse.json(
      { error: "Email and full_name are required" },
      { status: 400 }
    );
  }

  // Check if email already exists in profiles
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("email", email)
    .single();

  if (existingProfile && existingProfile.status === "active") {
    return NextResponse.json(
      { error: "A team member with this email already exists" },
      { status: 400 }
    );
  }

  // Check if there's a pending invitation
  const { data: existingInvite } = await supabase
    .from("team_invitations")
    .select("id, expires_at")
    .eq("email", email)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (existingInvite) {
    return NextResponse.json(
      { error: "A pending invitation already exists for this email" },
      { status: 400 }
    );
  }

  // Generate invitation token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

  // Create invitation record
  const { data: invitation, error: inviteError } = await supabase
    .from("team_invitations")
    .insert({
      email,
      role: access_level || "slt",
      pillar_id,
      invited_by: profile.id,
      token,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (inviteError) {
    console.error("Error creating invitation:", inviteError);
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
  }

  // Create a placeholder profile for the invited user
  let profileId = existingProfile?.id;

  if (!existingProfile) {
    const { data: newProfile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        clerk_id: `pending_${token}`,
        email,
        full_name,
        title,
        role: title || "Team Member",
        access_level: access_level || "slt",
        pillar_id,
        is_pillar_lead: is_pillar_lead || false,
        status: "invited",
        invited_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (profileError) {
      console.error("Error creating profile:", profileError);
      // Clean up invitation
      await supabase.from("team_invitations").delete().eq("id", invitation.id);
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
    }

    profileId = newProfile.id;
  } else {
    // Update existing inactive profile
    await supabase
      .from("profiles")
      .update({
        full_name,
        title,
        role: title || "Team Member",
        access_level: access_level || "slt",
        pillar_id,
        is_pillar_lead: is_pillar_lead || false,
        status: "invited",
        invited_at: new Date().toISOString(),
      })
      .eq("id", existingProfile.id);
  }

  // TODO: Send invitation email via Clerk or custom email service
  // For now, return the invitation details
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/sign-up?invitation=${token}`;

  return NextResponse.json({
    invitation: {
      id: invitation.id,
      email,
      token,
      expires_at: expiresAt.toISOString(),
      invite_url: inviteUrl,
    },
    profile_id: profileId,
  }, { status: 201 });
}
