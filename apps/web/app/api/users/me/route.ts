import { auth, currentUser } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Try to fetch existing profile
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(`
      *,
      pillar:pillars(id, name)
    `)
    .eq("clerk_id", userId)
    .single();

  // Profile exists - return it
  if (profile) {
    return NextResponse.json(profile);
  }

  // Handle the "not found" case by auto-provisioning
  if (error?.code === "PGRST116") {
    console.log("Profile not found for clerk_id, attempting auto-provision:", userId);

    try {
      // Fetch Clerk user details
      const clerkUser = await currentUser();

      if (!clerkUser) {
        console.error("Could not fetch Clerk user for auto-provision:", userId);
        return NextResponse.json(
          { error: "Could not fetch user details" },
          { status: 500 }
        );
      }

      const email = clerkUser.emailAddresses[0]?.emailAddress;
      if (!email) {
        console.error("No email found for Clerk user:", userId);
        return NextResponse.json(
          { error: "No email found for user" },
          { status: 400 }
        );
      }

      const fullName =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        email.split("@")[0];

      // Check if there's an existing profile with this email (from seed data or invite)
      const { data: existingByEmail } = await supabase
        .from("profiles")
        .select("id, organization_id")
        .eq("email", email)
        .single();

      if (existingByEmail) {
        // Link existing profile to this Clerk user
        const { data: updatedProfile, error: updateError } = await supabase
          .from("profiles")
          .update({
            clerk_id: userId,
            full_name: fullName,
            avatar_url: clerkUser.imageUrl ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingByEmail.id)
          .select(`
            *,
            pillar:pillars(id, name)
          `)
          .single();

        if (updateError) {
          console.error("Error linking profile to Clerk user:", updateError);
          return NextResponse.json(
            { error: "Failed to link profile" },
            { status: 500 }
          );
        }

        console.log(`Linked existing profile ${existingByEmail.id} to Clerk user ${userId}`);
        return NextResponse.json(updatedProfile);
      }

      // Create new profile (no organization yet - onboarding will handle that)
      const { data: newProfile, error: insertError } = await supabase
        .from("profiles")
        .insert({
          clerk_id: userId,
          email,
          full_name: fullName,
          avatar_url: clerkUser.imageUrl ?? null,
          role: "Team Member",
          access_level: "admin", // First user is admin
          is_elt: false,
          status: "active",
        })
        .select(`
          *,
          pillar:pillars(id, name)
        `)
        .single();

      if (insertError) {
        console.error("Error creating profile:", insertError);
        return NextResponse.json(
          { error: "Failed to create profile" },
          { status: 500 }
        );
      }

      console.log(`Auto-provisioned new profile for ${email} (Clerk ID: ${userId})`);
      return NextResponse.json(newProfile);
    } catch (provisionError) {
      console.error("Error during auto-provision:", provisionError);
      return NextResponse.json(
        { error: "Failed to provision user" },
        { status: 500 }
      );
    }
  }

  // For other errors (not "not found"), return 500
  console.error("Error fetching profile:", {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
    clerkUserId: userId,
  });

  return NextResponse.json(
    {
      error: "Failed to fetch profile",
      details: process.env.NODE_ENV === "development" ? error?.message : undefined,
    },
    { status: 500 }
  );
}
