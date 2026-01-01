import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/rocks/cascade - Get rocks with cascade hierarchy for visualization
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const { searchParams } = new URL(req.url);
  const level = searchParams.get("level") || "company";
  const quarterId = searchParams.get("quarter_id");
  const teamId = searchParams.get("team_id");

  // Build query for rocks at the specified level
  let query = supabase
    .from("rocks")
    .select(`
      id,
      title,
      status,
      rock_level,
      parent_rock_id,
      team_id,
      owner:profiles!owner_id(id, full_name, avatar_url),
      team:teams!team_id(id, name)
    `)
    .eq("organization_id", profile.organization_id)
    .eq("rock_level", level)
    .order("title", { ascending: true });

  if (quarterId) {
    query = query.eq("quarter_id", quarterId);
  }

  if (teamId) {
    query = query.eq("team_id", teamId);
  }

  const { data: rocks, error } = await query;

  if (error) {
    console.error("Error fetching cascade rocks:", error);
    return NextResponse.json({ error: "Failed to fetch rocks" }, { status: 500 });
  }

  // Get children counts for each rock
  const rockIds = rocks?.map((r) => r.id) || [];

  if (rockIds.length === 0) {
    return NextResponse.json({ rocks: [] });
  }

  // Get child rocks to calculate stats
  const { data: childRocks } = await supabase
    .from("rocks")
    .select("id, parent_rock_id, status")
    .in("parent_rock_id", rockIds);

  // Calculate children stats per parent rock
  const childStats = new Map<string, { count: number; on_track: number }>();

  (childRocks || []).forEach((child) => {
    if (child.parent_rock_id) {
      const current = childStats.get(child.parent_rock_id) || { count: 0, on_track: 0 };
      current.count++;
      if (child.status === "on_track" || child.status === "complete") {
        current.on_track++;
      }
      childStats.set(child.parent_rock_id, current);
    }
  });

  // Build response with cascade info
  const rocksWithCascade = (rocks || []).map((rock) => {
    const stats = childStats.get(rock.id) || { count: 0, on_track: 0 };
    return {
      id: rock.id,
      title: rock.title,
      status: rock.status,
      rock_level: rock.rock_level,
      owner: rock.owner,
      team: rock.team,
      children_count: stats.count,
      children_on_track: stats.on_track,
    };
  });

  return NextResponse.json({ rocks: rocksWithCascade });
}
