import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { emitIntegrationEvent } from "@/lib/inngest/emit";

// GET /api/rocks - List all rocks with cascade support
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const quarterParam = searchParams.get("quarter"); // Could be "4" or "Q4 2025"
  const yearParam = searchParams.get("year"); // Year like "2025"
  const quarterId = searchParams.get("quarter_id"); // New: UUID
  const status = searchParams.get("status");
  const ownerId = searchParams.get("owner_id");
  const level = searchParams.get("level"); // company, pillar, individual
  const parentId = searchParams.get("parent_id");
  const pillarId = searchParams.get("pillar_id");
  const governanceBodyId = searchParams.get("governance_body_id"); // For company rocks
  const teamId = searchParams.get("team_id"); // DEPRECATED: use pillar_id or governance_body_id
  const includeChildren = searchParams.get("include") === "children";

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

  // Handle quarter/year conversion for filtering
  let quarterFilter: string | null = null;
  let quarterIdFilter: string | null = quarterId;

  if (quarterParam && yearParam) {
    // If quarter is a simple number like "4", convert to "Q4 2025" format
    const quarterNum = parseInt(quarterParam);
    const yearNum = parseInt(yearParam);
    if (!isNaN(quarterNum) && !isNaN(yearNum) && quarterNum >= 1 && quarterNum <= 4) {
      quarterFilter = `Q${quarterNum} ${yearNum}`;

      // Also try to find quarter_id for more accurate filtering
      if (!quarterIdFilter) {
        const { data: quarterRecord } = await supabase
          .from("quarters")
          .select("id")
          .eq("organization_id", profile.organization_id)
          .eq("year", yearNum)
          .eq("quarter", quarterNum)
          .single();

        if (quarterRecord) {
          quarterIdFilter = quarterRecord.id;
        }
      }
    }
  } else if (quarterParam) {
    // Legacy format like "Q4 2025"
    quarterFilter = quarterParam;
  }

  let query = supabase
    .from("rocks")
    .select(`
      *,
      owner:profiles!owner_id(id, full_name, avatar_url, title),
      pillar:pillars!pillar_id(id, name, color),
      parent:rocks!parent_rock_id(id, title, rock_level),
      quarter:quarters!quarter_id(id, year, quarter, planning_status),
      governance_body:governance_bodies!rocks_governance_body_id_fkey(id, name, body_type),
      team:teams!rocks_team_id_fkey(id, name, level)
    `)
    .eq("organization_id", profile.organization_id)
    .order("rock_level", { ascending: true })
    .order("title", { ascending: true });

  // Filter by quarter_id first (preferred), fallback to legacy quarter string
  if (quarterIdFilter) {
    query = query.eq("quarter_id", quarterIdFilter);
  } else if (quarterFilter) {
    query = query.eq("quarter", quarterFilter);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (ownerId) {
    query = query.eq("owner_id", ownerId);
  }

  if (level) {
    query = query.eq("rock_level", level);
  }

  if (parentId) {
    query = query.eq("parent_rock_id", parentId);
  }

  if (pillarId) {
    query = query.eq("pillar_id", pillarId);
  }

  if (governanceBodyId) {
    query = query.eq("governance_body_id", governanceBodyId);
  }

  // DEPRECATED: team_id filter - use pillar_id or governance_body_id instead
  if (teamId) {
    query = query.eq("team_id", teamId);
  }

  const { data: rocks, error } = await query;

  if (error) {
    console.error("Error fetching rocks:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      organizationId: profile.organization_id,
      quarterIdFilter,
      quarterFilter,
    });
    return NextResponse.json(
      {
        error: "Failed to fetch rocks",
        details: process.env.NODE_ENV === "development" ? error.message : undefined
      },
      { status: 500 }
    );
  }

  // If include=children, fetch child rocks for each rock
  if (includeChildren && rocks) {
    const rocksWithChildren = await Promise.all(
      rocks.map(async (rock) => {
        const { data: children } = await supabase
          .from("rocks")
          .select(`
            *,
            owner:profiles!owner_id(id, full_name, avatar_url),
            pillar:pillars!pillar_id(id, name, color)
          `)
          .eq("parent_rock_id", rock.id)
          .order("title", { ascending: true });

        return {
          ...rock,
          children: children || [],
        };
      })
    );
    return NextResponse.json(rocksWithChildren);
  }

  return NextResponse.json(rocks);
}

// POST /api/rocks - Create a new rock with cascade support
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, access_level, is_elt")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const body = await req.json();
  const {
    title,
    name, // Legacy support
    description,
    owner_id,
    status,
    due_date,
    quarter: quarterInput, // Could be string like "Q4 2025" or number like 4
    quarter_id: quarterIdInput, // New: UUID
    year: yearInput, // If quarter is a number, year should also be provided
    rock_level,
    parent_rock_id,
    pillar_id,
    governance_body_id, // For company rocks owned by ELT/SLT
    linked_metric_id,
    team_id, // DEPRECATED: use pillar_id or governance_body_id
  } = body;

  // Handle quarter/year conversion
  let quarter = quarterInput;
  let quarter_id = quarterIdInput;

  // If quarter is a number and year is provided, format as "Q4 2025" for legacy field
  if (typeof quarterInput === 'number' && typeof yearInput === 'number') {
    quarter = `Q${quarterInput} ${yearInput}`;

    // Also try to look up or create the quarter_id
    if (!quarter_id) {
      const { data: existingQuarter } = await supabase
        .from("quarters")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("year", yearInput)
        .eq("quarter", quarterInput)
        .single();

      if (existingQuarter) {
        quarter_id = existingQuarter.id;
      }
    }
  }

  const rockTitle = title || name;

  if (!rockTitle || !owner_id) {
    return NextResponse.json(
      { error: "Title and owner_id are required" },
      { status: 400 }
    );
  }

  // Determine rock level and validate hierarchy
  let determinedLevel = rock_level || "company";

  // If parent_rock_id is provided, validate and determine level
  if (parent_rock_id) {
    const { data: parentRock } = await supabase
      .from("rocks")
      .select("rock_level, organization_id")
      .eq("id", parent_rock_id)
      .single();

    if (!parentRock) {
      return NextResponse.json({ error: "Parent rock not found" }, { status: 400 });
    }

    if (parentRock.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: "Parent rock is in different organization" }, { status: 400 });
    }

    // Determine child level based on parent
    if (parentRock.rock_level === "company") {
      determinedLevel = "pillar";
    } else if (parentRock.rock_level === "pillar") {
      determinedLevel = "individual";
    } else {
      return NextResponse.json(
        { error: "Cannot create child rock under individual rock" },
        { status: 400 }
      );
    }
  }

  // Authorization check based on rock level
  const isAdmin = profile.access_level === "admin";
  const isElt = profile.access_level === "elt" || profile.is_elt;

  // Company rocks require ELT or admin
  if (determinedLevel === "company" && !isAdmin && !isElt) {
    return NextResponse.json(
      { error: "Only ELT can create company rocks" },
      { status: 403 }
    );
  }

  // Pillar rocks require pillar lead, ELT, or admin
  // Individual rocks can be created by the owner, pillar lead, ELT, or admin
  // For now, allow ELT and admin to create any rock
  if (determinedLevel !== "company" && !isAdmin && !isElt) {
    // Check if user is the owner or a pillar lead
    const isOwner = owner_id === profile.id;
    if (!isOwner) {
      // Check if user is pillar lead for the relevant pillar
      if (pillar_id) {
        const { data: membership } = await supabase
          .from("team_member_pillars")
          .select("is_lead")
          .eq("team_member_id", profile.id)
          .eq("pillar_id", pillar_id)
          .single();

        if (!membership?.is_lead) {
          return NextResponse.json(
            { error: "You don't have permission to create rocks in this pillar" },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "You don't have permission to create this rock" },
          { status: 403 }
        );
      }
    }
  }

  // Calculate due_date if not provided but quarter_id is
  let calculatedDueDate = due_date;
  if (!calculatedDueDate && quarter_id) {
    const { data: quarterData } = await supabase
      .from("quarters")
      .select("end_date")
      .eq("id", quarter_id)
      .single();
    if (quarterData) {
      calculatedDueDate = quarterData.end_date;
    }
  }

  // Fallback to end of current quarter
  if (!calculatedDueDate) {
    const now = new Date();
    const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
    const endMonth = currentQuarter * 3;
    calculatedDueDate = new Date(now.getFullYear(), endMonth, 0).toISOString().split("T")[0];
  }

  const { data: rock, error } = await supabase
    .from("rocks")
    .insert({
      organization_id: profile.organization_id,
      title: rockTitle,
      description,
      owner_id,
      status: status || "on_track",
      due_date: calculatedDueDate,
      quarter, // Legacy field
      quarter_id,
      rock_level: determinedLevel,
      parent_rock_id,
      pillar_id,
      governance_body_id: governance_body_id || null, // For company rocks
      linked_metric_id,
      team_id: team_id || null, // DEPRECATED
    })
    .select(`
      *,
      owner:profiles!owner_id(id, full_name, avatar_url, title),
      pillar:pillars!pillar_id(id, name, color),
      parent:rocks!parent_rock_id(id, title, rock_level),
      quarter:quarters!quarter_id(id, year, quarter, planning_status),
      governance_body:governance_bodies!rocks_governance_body_id_fkey(id, name, body_type)
    `)
    .single();

  if (error) {
    console.error("Error creating rock:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      organizationId: profile.organization_id,
    });
    return NextResponse.json(
      {
        error: "Failed to create rock",
        details: process.env.NODE_ENV === "development" ? error.message : undefined
      },
      { status: 500 }
    );
  }

  // Emit integration event for rock creation
  await emitIntegrationEvent("rock/created", {
    organization_id: profile.organization_id,
    rock_id: rock.id,
    title: rock.title,
    owner_id: rock.owner_id,
    status: rock.status,
    rock_level: rock.rock_level,
    parent_rock_id: rock.parent_rock_id || undefined,
    pillar_id: rock.pillar_id || undefined,
  });

  return NextResponse.json(rock, { status: 201 });
}
