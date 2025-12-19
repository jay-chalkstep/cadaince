import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/onboarding - Check onboarding status
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Check if user has a profile with an organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("clerk_id", userId)
    .single();

  if (!profile || !profile.organization_id) {
    return NextResponse.json({
      needsOnboarding: true,
      step: 1,
      organizationId: null,
    });
  }

  // Get organization details
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, onboarding_completed_at")
    .eq("id", profile.organization_id)
    .single();

  if (!org?.onboarding_completed_at) {
    // Org exists but onboarding not complete - determine step
    const step = await determineCurrentStep(supabase, profile.organization_id);
    return NextResponse.json({
      needsOnboarding: true,
      step,
      organizationId: profile.organization_id,
    });
  }

  return NextResponse.json({
    needsOnboarding: false,
    organizationId: profile.organization_id,
  });
}

async function determineCurrentStep(supabase: ReturnType<typeof createAdminClient>, orgId: string): Promise<number> {
  // Check pillars
  const { count: pillarCount } = await supabase
    .from("pillars")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId);

  if (!pillarCount || pillarCount === 0) return 2;

  // Check team members (besides the admin who created the org)
  const { count: teamCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId);

  if (!teamCount || teamCount <= 1) return 3;

  // Check VTO
  const { data: vto } = await supabase
    .from("vto")
    .select("id")
    .eq("organization_id", orgId)
    .single();

  if (!vto) return 4;

  // Check metrics
  const { count: metricCount } = await supabase
    .from("metrics")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId);

  if (!metricCount || metricCount === 0) return 5;

  return 6; // Ready to complete
}

// POST /api/onboarding - Handle step submissions
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const body = await req.json();
  const { step, data } = body;

  try {
    switch (step) {
      case 1:
        return await handleStepOrganization(supabase, userId, data);
      case 2:
        return await handleStepPillars(supabase, data);
      case 3:
        return await handleStepTeam(supabase, data);
      case 4:
        return await handleStepVTO(supabase, data);
      case 5:
        return await handleStepMetrics(supabase, data);
      case 6:
        return await handleStepComplete(supabase, data);
      default:
        return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    }
  } catch (error) {
    console.error(`Error processing step ${step}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process step" },
      { status: 500 }
    );
  }
}

async function handleStepOrganization(
  supabase: ReturnType<typeof createAdminClient>,
  clerkUserId: string,
  data: { name: string; slug: string; logoUrl?: string }
) {
  const { name, slug, logoUrl } = data;

  if (!name || !slug) {
    return NextResponse.json(
      { error: "Name and slug are required" },
      { status: 400 }
    );
  }

  // Check if slug is unique
  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "This slug is already taken" },
      { status: 400 }
    );
  }

  // Create organization
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name,
      slug,
      logo_url: logoUrl || null,
    })
    .select()
    .single();

  if (orgError) {
    throw new Error(orgError.message);
  }

  // Check if user profile exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_id", clerkUserId)
    .single();

  if (existingProfile) {
    // Update existing profile with organization
    await supabase
      .from("profiles")
      .update({
        organization_id: org.id,
        access_level: "admin",
      })
      .eq("id", existingProfile.id);
  } else {
    // Get user info from Clerk (we'll use placeholder for now)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        clerk_id: clerkUserId,
        email: `${clerkUserId}@pending.local`, // Will be updated by webhook
        full_name: "Admin",
        role: "Administrator",
        access_level: "admin",
        organization_id: org.id,
        status: "active",
        activated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (profileError) {
      throw new Error(profileError.message);
    }
  }

  return NextResponse.json({ organizationId: org.id, step: 2 });
}

async function handleStepPillars(
  supabase: ReturnType<typeof createAdminClient>,
  data: { organizationId: string; pillars: Array<{ name: string; slug: string; color: string; sortOrder: number }> }
) {
  const { organizationId, pillars } = data;

  if (!organizationId || !pillars?.length) {
    return NextResponse.json(
      { error: "Organization ID and pillars are required" },
      { status: 400 }
    );
  }

  // Delete existing pillars for this org (in case of re-doing step)
  await supabase
    .from("pillars")
    .delete()
    .eq("organization_id", organizationId);

  // Insert new pillars
  const pillarRecords = pillars.map((p) => ({
    name: p.name,
    slug: p.slug,
    color: p.color,
    sort_order: p.sortOrder,
    organization_id: organizationId,
  }));

  const { data: createdPillars, error } = await supabase
    .from("pillars")
    .insert(pillarRecords)
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return NextResponse.json({
    pillars: createdPillars,
    step: 3,
  });
}

async function handleStepTeam(
  supabase: ReturnType<typeof createAdminClient>,
  data: {
    organizationId: string;
    members: Array<{
      email: string;
      fullName: string;
      title?: string;
      accessLevel: string;
      pillarId?: string;
      isPillarLead?: boolean;
    }>;
  }
) {
  const { organizationId, members } = data;

  if (!organizationId) {
    return NextResponse.json(
      { error: "Organization ID is required" },
      { status: 400 }
    );
  }

  const createdMembers = [];

  for (const member of members) {
    // Check if email already exists in this org
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", member.email)
      .eq("organization_id", organizationId)
      .single();

    if (existing) {
      continue; // Skip existing members
    }

    const { data: newMember, error } = await supabase
      .from("profiles")
      .insert({
        clerk_id: `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        email: member.email,
        full_name: member.fullName,
        title: member.title,
        role: member.title || "Team Member",
        access_level: member.accessLevel,
        pillar_id: member.pillarId || null,
        is_pillar_lead: member.isPillarLead || false,
        organization_id: organizationId,
        status: "invited",
        invited_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating team member:", error);
      continue;
    }

    createdMembers.push(newMember);
  }

  return NextResponse.json({
    members: createdMembers,
    step: 4,
  });
}

async function handleStepVTO(
  supabase: ReturnType<typeof createAdminClient>,
  data: {
    organizationId: string;
    vto: {
      coreValues?: Array<{ value: string; description: string }>;
      purpose?: string;
      niche?: string;
      tenYearTarget?: string;
      targetMarket?: string;
      threeUniques?: string[];
      guarantee?: string;
      threeYearPicture?: string;
      oneYearPlan?: string;
    };
  }
) {
  const { organizationId, vto } = data;

  if (!organizationId) {
    return NextResponse.json(
      { error: "Organization ID is required" },
      { status: 400 }
    );
  }

  // Check if VTO exists
  const { data: existing } = await supabase
    .from("vto")
    .select("id")
    .eq("organization_id", organizationId)
    .single();

  const vtoData = {
    organization_id: organizationId,
    core_values: vto.coreValues || [],
    purpose: vto.purpose || null,
    niche: vto.niche || null,
    ten_year_target: vto.tenYearTarget || null,
    target_market: vto.targetMarket || null,
    three_uniques: vto.threeUniques || [],
    guarantee: vto.guarantee || null,
    three_year_description: vto.threeYearPicture || null,
    one_year_goals: vto.oneYearPlan ? [{ goal: vto.oneYearPlan }] : [],
  };

  if (existing) {
    await supabase
      .from("vto")
      .update(vtoData)
      .eq("id", existing.id);
  } else {
    await supabase.from("vto").insert(vtoData);
  }

  return NextResponse.json({ step: 5 });
}

async function handleStepMetrics(
  supabase: ReturnType<typeof createAdminClient>,
  data: {
    organizationId: string;
    metrics: Array<{
      name: string;
      ownerId: string;
      pillarId?: string;
      goal?: number;
      unit?: string;
    }>;
  }
) {
  const { organizationId, metrics } = data;

  if (!organizationId) {
    return NextResponse.json(
      { error: "Organization ID is required" },
      { status: 400 }
    );
  }

  if (metrics && metrics.length > 0) {
    const metricRecords = metrics.map((m, index) => ({
      name: m.name,
      owner_id: m.ownerId,
      goal: m.goal || null,
      unit: m.unit || null,
      organization_id: organizationId,
      display_order: index + 1,
      source: "manual",
    }));

    await supabase.from("metrics").insert(metricRecords);
  }

  return NextResponse.json({ step: 6 });
}

async function handleStepComplete(
  supabase: ReturnType<typeof createAdminClient>,
  data: { organizationId: string }
) {
  const { organizationId } = data;

  if (!organizationId) {
    return NextResponse.json(
      { error: "Organization ID is required" },
      { status: 400 }
    );
  }

  await supabase
    .from("organizations")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", organizationId);

  return NextResponse.json({ completed: true });
}
