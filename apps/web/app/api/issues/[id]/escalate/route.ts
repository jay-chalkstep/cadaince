import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/issues/:id/escalate - Escalate an issue to parent team
 *
 * Creates a linked copy of the issue in the parent team.
 * The original issue is marked as "escalated" and links to the new copy.
 * The escalated issue starts fresh as "open" in the parent team.
 */
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
    .select("id, organization_id, access_level")
    .eq("clerk_id", userId)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Get the issue with its team info
  const { data: issue, error: issueError } = await supabase
    .from("issues")
    .select(`
      id,
      organization_id,
      team_id,
      title,
      description,
      priority,
      status,
      issue_level,
      created_by,
      escalated_to_issue_id,
      team:teams!issues_team_id_fkey(
        id,
        name,
        parent_team_id,
        parent_team:teams!teams_parent_team_id_fkey(
          id,
          name
        )
      )
    `)
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (issueError || !issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  // Check if already escalated
  if (issue.escalated_to_issue_id) {
    return NextResponse.json(
      { error: "Issue has already been escalated" },
      { status: 400 }
    );
  }

  // Check if issue has a team
  if (!issue.team_id || !issue.team) {
    return NextResponse.json(
      { error: "Issue must belong to a team to be escalated" },
      { status: 400 }
    );
  }

  // Get parent team - handle both array and object formats from Supabase
  const teamData = Array.isArray(issue.team) ? issue.team[0] : issue.team;
  const parentTeamData = teamData?.parent_team
    ? (Array.isArray(teamData.parent_team) ? teamData.parent_team[0] : teamData.parent_team)
    : null;

  const team = {
    id: teamData?.id as string,
    parent_team_id: teamData?.parent_team_id as string | null,
    parent_team: parentTeamData as { id: string; name: string } | null,
  };

  if (!team.parent_team_id || !team.parent_team) {
    return NextResponse.json(
      { error: "Cannot escalate: no parent team exists" },
      { status: 400 }
    );
  }

  // Determine new issue level
  let newIssueLevel = issue.issue_level;
  if (issue.issue_level === "individual") {
    newIssueLevel = "pillar";
  } else if (issue.issue_level === "pillar") {
    newIssueLevel = "company";
  }

  // Create escalated copy in parent team
  const { data: escalatedIssue, error: createError } = await supabase
    .from("issues")
    .insert({
      organization_id: issue.organization_id,
      team_id: team.parent_team_id,
      title: issue.title,
      description: issue.description,
      priority: issue.priority,
      status: "open",
      issue_level: newIssueLevel,
      created_by: issue.created_by,
      escalated_from_id: id,
      escalated_at: new Date().toISOString(),
      escalated_by_id: profile.id,
      original_team_id: issue.team_id,
    })
    .select(`
      id,
      title,
      status,
      issue_level,
      team:teams!issues_team_id_fkey(id, name)
    `)
    .single();

  if (createError || !escalatedIssue) {
    console.error("Error creating escalated issue:", createError);
    return NextResponse.json(
      { error: "Failed to create escalated issue" },
      { status: 500 }
    );
  }

  // Update original issue to link to escalated copy and mark as escalated
  const { error: updateError } = await supabase
    .from("issues")
    .update({
      escalated_to_issue_id: escalatedIssue.id,
      status: "escalated",
    })
    .eq("id", id);

  if (updateError) {
    console.error("Error updating original issue:", updateError);
    // Try to clean up the escalated issue
    await supabase.from("issues").delete().eq("id", escalatedIssue.id);
    return NextResponse.json(
      { error: "Failed to update original issue" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    original_issue_id: id,
    escalated_issue: escalatedIssue,
    escalated_to_team: team.parent_team,
  });
}

/**
 * GET /api/issues/:id/escalate - Get escalation chain for an issue
 *
 * Returns the full escalation history: where this issue came from
 * and where it was escalated to.
 */
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

  // Get the issue
  const { data: issue, error } = await supabase
    .from("issues")
    .select(`
      id,
      title,
      status,
      team_id,
      escalated_from_id,
      escalated_to_issue_id,
      original_team_id,
      escalated_at,
      escalated_by_id,
      team:teams!issues_team_id_fkey(id, name, level),
      original_team:teams!issues_original_team_id_fkey(id, name, level)
    `)
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .single();

  if (error || !issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  // Build escalation chain
  const chain: Array<{
    id: string;
    title: string;
    status: string;
    team: { id: string; name: string; level: number } | null;
    direction: "from" | "current" | "to";
  }> = [];

  // Add "escalated from" issues (walk down the chain)
  let currentFromId = issue.escalated_from_id;
  const fromIssues: typeof chain = [];
  while (currentFromId) {
    const { data: fromIssue } = await supabase
      .from("issues")
      .select(`
        id,
        title,
        status,
        escalated_from_id,
        team:teams!issues_team_id_fkey(id, name, level)
      `)
      .eq("id", currentFromId)
      .eq("organization_id", profile.organization_id)
      .single();

    if (!fromIssue) break;

    fromIssues.unshift({
      id: fromIssue.id,
      title: fromIssue.title,
      status: fromIssue.status,
      team: fromIssue.team as { id: string; name: string; level: number } | null,
      direction: "from",
    });

    currentFromId = fromIssue.escalated_from_id;
  }

  chain.push(...fromIssues);

  // Add current issue
  chain.push({
    id: issue.id,
    title: issue.title,
    status: issue.status,
    team: issue.team as { id: string; name: string; level: number } | null,
    direction: "current",
  });

  // Add "escalated to" issues (walk up the chain)
  let currentToId = issue.escalated_to_issue_id;
  while (currentToId) {
    const { data: toIssue } = await supabase
      .from("issues")
      .select(`
        id,
        title,
        status,
        escalated_to_issue_id,
        team:teams!issues_team_id_fkey(id, name, level)
      `)
      .eq("id", currentToId)
      .eq("organization_id", profile.organization_id)
      .single();

    if (!toIssue) break;

    chain.push({
      id: toIssue.id,
      title: toIssue.title,
      status: toIssue.status,
      team: toIssue.team as { id: string; name: string; level: number } | null,
      direction: "to",
    });

    currentToId = toIssue.escalated_to_issue_id;
  }

  return NextResponse.json({
    issue_id: id,
    chain,
    original_team: issue.original_team,
    escalated_at: issue.escalated_at,
  });
}
