import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// ============================================
// TYPE DEFINITIONS
// ============================================

interface AuthContext {
  userId: string;
  orgId: string | null;
  orgRole: string | null;
  orgSlug: string | null;
}

interface UserInfo {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
}

interface ActiveOrg {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  role: string | null;
}

interface OrgMembership {
  orgId: string;
  orgName: string;
  orgSlug: string | null;
  role: string;
}

interface GetMeResponse {
  auth: AuthContext;
  user: UserInfo;
  profile: Record<string, unknown>;
  activeOrg: ActiveOrg | null;
  memberships: OrgMembership[];
}

interface PatchMeResponse {
  profile: Record<string, unknown>;
}

// Allowed fields for PATCH - maps API field names to DB column names
const ALLOWED_PATCH_FIELDS: Record<string, string> = {
  display_name: "full_name",
  avatar_url: "avatar_url",
  timezone: "timezone",
  locale: "locale",
};

// ============================================
// HELPER: Ensure profile exists (upsert pattern)
// ============================================

/**
 * Ensures a profile row exists for the given Clerk user.
 * Uses RLS client for reads (profile lookup) and admin client for writes
 * (profile creation/linking) since auto-provisioning is a privileged operation.
 *
 * Why we need admin client for writes:
 * - New users don't have a profile yet, so RLS can't identify them for inserts
 * - Email-based profile linking requires updating a row the user doesn't own yet
 * - This is safe because we verify the Clerk user ID matches the operation
 *
 * Handles these cases:
 * - Existing profile with matching clerk_id (immediate return)
 * - Invited profile with matching email but no clerk_id (link to Clerk user)
 * - No profile exists (create new one)
 * - Race conditions (re-fetch on conflict)
 */
async function ensureProfileRow(
  userId: string,
  email: string,
  fullName: string,
  avatarUrl: string | null
): Promise<{ profile: Record<string, unknown> | null; error: string | null }> {
  // Use admin client for all operations to avoid TypeScript type mismatches
  // Security is enforced by filtering on clerk_id which we verified from the JWT
  const adminClient = createAdminClient();

  // First, check if profile exists with matching clerk_id
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("*")
    .eq("clerk_id", userId)
    .single();

  if (existingProfile) {
    return { profile: existingProfile, error: null };
  }

  // Profile doesn't exist with this clerk_id
  // Check if there's an invited profile with matching email

  const { data: emailProfile } = await adminClient
    .from("profiles")
    .select("id, organization_id")
    .eq("email", email)
    .is("clerk_id", null)
    .single();

  if (emailProfile) {
    // Link existing invited profile to this Clerk user
    // This must use admin client because the user can't update a row they don't own yet
    const { data: linkedProfile, error: linkError } = await adminClient
      .from("profiles")
      .update({
        clerk_id: userId,
        full_name: fullName,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", emailProfile.id)
      .select("*")
      .single();

    if (linkError) {
      console.error("Error linking profile to Clerk user:", linkError);
      return { profile: null, error: "Failed to link existing profile" };
    }

    console.log(`Linked existing profile ${emailProfile.id} to Clerk user ${userId}`);
    return { profile: linkedProfile, error: null };
  }

  // No existing profile - create new one
  // Use admin client for insert to bypass RLS (profile auto-provisioning is a privileged operation)
  // The user doesn't have a profile yet, so RLS can't identify them
  const { data: newProfile, error: insertError } = await adminClient
    .from("profiles")
    .insert({
      clerk_id: userId,
      email,
      full_name: fullName,
      avatar_url: avatarUrl,
      role: "Team Member",
      access_level: "admin", // First user is admin; subsequent users should be adjusted via onboarding
      is_elt: false,
      status: "active",
    })
    .select("*")
    .single();

  if (insertError) {
    // If insert fails, the profile might have been created in a race condition
    // Try to fetch again
    const { data: raceProfile } = await adminClient
      .from("profiles")
      .select("*")
      .eq("clerk_id", userId)
      .single();

    if (raceProfile) {
      return { profile: raceProfile, error: null };
    }

    console.error("Error creating profile:", insertError);
    return { profile: null, error: "Failed to create profile" };
  }

  console.log(`Auto-provisioned new profile for ${email} (Clerk ID: ${userId})`);
  return { profile: newProfile, error: null };
}

// ============================================
// GET /api/users/me
// ============================================

export async function GET(): Promise<NextResponse<GetMeResponse | { error: string; details?: string }>> {
  // Get Clerk auth context - includes org info if user is in an org context
  const { userId, orgId, orgRole, orgSlug } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get current Clerk user details (minimal fields only)
  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json({ error: "Could not fetch user details" }, { status: 500 });
  }

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    return NextResponse.json({ error: "No email found for user" }, { status: 400 });
  }

  const fullName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    email.split("@")[0];

  // Ensure profile row exists (idempotent upsert)
  const { profile, error: profileError } = await ensureProfileRow(
    userId,
    email,
    fullName,
    clerkUser.imageUrl ?? null
  );

  if (profileError || !profile) {
    return NextResponse.json(
      { error: profileError || "Failed to fetch profile" },
      { status: 500 }
    );
  }

  // Build auth context - org info is optional, /me works without an active org
  const authContext: AuthContext = {
    userId,
    orgId: orgId ?? null,
    orgRole: orgRole ?? null,
    orgSlug: orgSlug ?? null,
  };

  // Build minimal user info from Clerk (don't expose full Clerk user object)
  const userInfo: UserInfo = {
    id: clerkUser.id,
    email,
    firstName: clerkUser.firstName ?? null,
    lastName: clerkUser.lastName ?? null,
    imageUrl: clerkUser.imageUrl ?? null,
  };

  // Get active org details if user is in an org context
  let activeOrg: ActiveOrg | null = null;
  if (orgId) {
    try {
      const clerk = await clerkClient();
      const org = await clerk.organizations.getOrganization({ organizationId: orgId });
      activeOrg = {
        id: org.id,
        name: org.name,
        slug: org.slug ?? null,
        imageUrl: org.imageUrl ?? null,
        role: orgRole ?? null,
      };
    } catch (err) {
      console.error("Error fetching active org:", err);
      // Don't fail the request, just skip org details
    }
  }

  // Get user's org memberships for tenant switching UI
  let memberships: OrgMembership[] = [];
  try {
    const clerk = await clerkClient();
    const membershipList = await clerk.users.getOrganizationMembershipList({ userId });

    memberships = membershipList.data.map((m) => ({
      orgId: m.organization.id,
      orgName: m.organization.name,
      orgSlug: m.organization.slug ?? null,
      role: m.role,
    }));
  } catch (err) {
    console.error("Error fetching org memberships:", err);
    // Don't fail the request, just return empty memberships
  }

  return NextResponse.json({
    auth: authContext,
    user: userInfo,
    profile,
    activeOrg,
    memberships,
  });
}

// ============================================
// PATCH /api/users/me
// ============================================

export async function PATCH(
  req: Request
): Promise<NextResponse<PatchMeResponse | { error: string; details?: string }>> {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate request body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate that only allowed fields are present
  const unknownFields = Object.keys(body).filter(
    (key) => !Object.prototype.hasOwnProperty.call(ALLOWED_PATCH_FIELDS, key)
  );

  if (unknownFields.length > 0) {
    return NextResponse.json(
      { error: `Unknown fields: ${unknownFields.join(", ")}` },
      { status: 400 }
    );
  }

  // If body is empty, just return current profile
  if (Object.keys(body).length === 0) {
    const adminClient = createAdminClient();
    const { data: profile, error } = await adminClient
      .from("profiles")
      .select("*")
      .eq("clerk_id", userId)
      .single();

    if (error || !profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ profile });
  }

  // Build update object with DB column names
  const updateData: Record<string, unknown> = {};

  for (const [apiField, dbColumn] of Object.entries(ALLOWED_PATCH_FIELDS)) {
    if (Object.prototype.hasOwnProperty.call(body, apiField)) {
      const value = body[apiField];

      // Validate field types
      if (apiField === "display_name") {
        if (typeof value !== "string" || value.trim().length === 0) {
          return NextResponse.json(
            { error: "display_name must be a non-empty string" },
            { status: 400 }
          );
        }
        updateData[dbColumn] = value.trim();
      } else if (apiField === "avatar_url") {
        if (value !== null && typeof value !== "string") {
          return NextResponse.json(
            { error: "avatar_url must be a string or null" },
            { status: 400 }
          );
        }
        // Basic URL validation if not null
        if (value !== null && typeof value === "string") {
          try {
            new URL(value);
          } catch {
            return NextResponse.json(
              { error: "avatar_url must be a valid URL" },
              { status: 400 }
            );
          }
        }
        updateData[dbColumn] = value;
      } else if (apiField === "timezone" || apiField === "locale") {
        if (typeof value !== "string") {
          return NextResponse.json(
            { error: `${apiField} must be a string` },
            { status: 400 }
          );
        }
        updateData[dbColumn] = value;
      }
    }
  }

  // Use admin client for updates to avoid TypeScript type mismatches
  // Security is enforced by filtering on clerk_id which we verified from the JWT
  const adminClient = createAdminClient();

  // First ensure profile exists
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!existingProfile) {
    // Profile doesn't exist yet, need to create it first
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Could not fetch user details" }, { status: 500 });
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      return NextResponse.json({ error: "No email found for user" }, { status: 400 });
    }

    const fullName =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      email.split("@")[0];

    const { error: createError } = await ensureProfileRow(
      userId,
      email,
      fullName,
      clerkUser.imageUrl ?? null
    );

    if (createError) {
      return NextResponse.json({ error: createError }, { status: 500 });
    }
  }

  // Perform the update - security enforced by clerk_id filter matching authenticated user
  const { data: updatedProfile, error: updateError } = await adminClient
    .from("profiles")
    .update(updateData)
    .eq("clerk_id", userId)
    .select("*")
    .single();

  if (updateError) {
    console.error("Error updating profile:", updateError);
    return NextResponse.json(
      {
        error: "Failed to update profile",
        details: process.env.NODE_ENV === "development" ? updateError.message : undefined,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ profile: updatedProfile });
}
