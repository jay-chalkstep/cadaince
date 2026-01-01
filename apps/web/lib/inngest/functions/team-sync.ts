import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Determines the hierarchy level for a seat based on its position in the tree.
 * Level 1: ELT (visionary/integrator) or root seats with no parent
 * Level 2: Direct children of Level 1
 * Level 3: Direct children of Level 2
 * Level 4: All others (capped)
 */
function determineLevel(
  seat: { id: string; parent_seat_id: string | null; eos_role: string | null },
  allSeats: Array<{ id: string; parent_seat_id: string | null; eos_role: string | null }>
): number {
  // ELT roles are always level 1
  if (seat.eos_role === "visionary" || seat.eos_role === "integrator") {
    return 1;
  }

  // No parent = level 1 (root seat)
  if (!seat.parent_seat_id) {
    return 1;
  }

  // Count ancestors to determine level
  let level = 1;
  let currentParentId: string | null = seat.parent_seat_id;

  while (currentParentId && level < 4) {
    const parent = allSeats.find((s) => s.id === currentParentId);
    if (!parent) break;

    level++;
    currentParentId = parent.parent_seat_id;

    // If we hit a root or ELT seat, stop counting
    if (!currentParentId || parent.eos_role === "visionary" || parent.eos_role === "integrator") {
      break;
    }
  }

  return Math.min(level + 1, 4); // +1 because we count from parent, capped at 4
}

/**
 * Generates a URL-safe slug from a name.
 */
function generateSlug(name: string, seatId: string): string {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  // Add seat ID suffix for uniqueness
  return `${baseSlug || "team"}-${seatId.slice(0, 8)}`;
}

/**
 * Sync teams from Accountability Chart when seats change.
 *
 * Teams are derived from seats - each seat becomes a team.
 * This function:
 * 1. Creates teams for new seats
 * 2. Updates parent relationships based on seat hierarchy
 * 3. Removes orphaned teams when seats are deleted
 * 4. Recalculates levels based on hierarchy depth
 */
export const syncTeamsFromAC = inngest.createFunction(
  {
    id: "sync-teams-from-accountability-chart",
    retries: 3,
    concurrency: { limit: 1, key: "event.data.organization_id" },
  },
  { event: "accountability-chart/changed" },
  async ({ event, step }) => {
    const { organization_id } = event.data as {
      organization_id: string;
      action?: "seat_created" | "seat_updated" | "seat_deleted";
      seat_id?: string;
    };

    const supabase = createAdminClient();

    // Step 1: Get all seats with hierarchy
    const seats = await step.run("fetch-seats", async () => {
      const { data, error } = await supabase
        .from("seats")
        .select("id, name, parent_seat_id, pillar_id, eos_role")
        .eq("organization_id", organization_id);

      if (error) {
        console.error("Error fetching seats:", error);
        throw new Error(`Failed to fetch seats: ${error.message}`);
      }
      return data || [];
    });

    // Step 2: Get existing teams
    const existingTeams = await step.run("fetch-existing-teams", async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, anchor_seat_id, name, slug")
        .eq("organization_id", organization_id);

      if (error) {
        console.error("Error fetching teams:", error);
        throw new Error(`Failed to fetch teams: ${error.message}`);
      }
      return data || [];
    });

    const existingAnchorIds = new Set(existingTeams.map((t) => t.anchor_seat_id));
    const seatIds = new Set(seats.map((s) => s.id));

    // Step 3: Create missing teams
    const newTeamsCreated = await step.run("create-missing-teams", async () => {
      const newTeams = seats
        .filter((s) => !existingAnchorIds.has(s.id))
        .map((seat) => {
          const level = determineLevel(seat, seats);
          const name = seat.name || "Team";
          return {
            organization_id,
            anchor_seat_id: seat.id,
            name,
            slug: generateSlug(name, seat.id),
            level,
            is_elt: seat.eos_role === "visionary" || seat.eos_role === "integrator",
            l10_required: level <= 2, // Required for ELT (1) and Pillar (2)
          };
        });

      if (newTeams.length > 0) {
        const { error } = await supabase.from("teams").insert(newTeams);
        if (error) {
          console.error("Error creating teams:", error);
          throw new Error(`Failed to create teams: ${error.message}`);
        }
      }

      return newTeams.length;
    });

    // Step 4: Refresh teams list and update parent relationships
    await step.run("update-parent-relationships", async () => {
      const { data: allTeams, error: fetchError } = await supabase
        .from("teams")
        .select("id, anchor_seat_id")
        .eq("organization_id", organization_id);

      if (fetchError || !allTeams) {
        throw new Error(`Failed to fetch teams: ${fetchError?.message}`);
      }

      const seatToTeam = new Map(allTeams.map((t) => [t.anchor_seat_id, t.id]));

      // Update each team's parent relationship
      for (const seat of seats) {
        if (seat.parent_seat_id) {
          const teamId = seatToTeam.get(seat.id);
          const parentTeamId = seatToTeam.get(seat.parent_seat_id);

          if (teamId && parentTeamId) {
            const { error } = await supabase
              .from("teams")
              .update({ parent_team_id: parentTeamId })
              .eq("id", teamId);

            if (error) {
              console.error(`Error updating parent for team ${teamId}:`, error);
            }
          }
        }
      }
    });

    // Step 5: Recalculate levels for all teams
    await step.run("recalculate-levels", async () => {
      // Use recursive CTE in SQL for accurate depth calculation
      const { error } = await supabase.rpc("recalculate_team_levels", {
        p_organization_id: organization_id,
      });

      // If the function doesn't exist, fall back to JS calculation
      if (error && error.code === "42883") {
        // Function not found - calculate manually
        const { data: allTeams } = await supabase
          .from("teams")
          .select("id, anchor_seat_id, parent_team_id")
          .eq("organization_id", organization_id);

        if (allTeams) {
          // Build adjacency map
          const childrenMap = new Map<string | null, typeof allTeams>();
          for (const team of allTeams) {
            const siblings = childrenMap.get(team.parent_team_id) || [];
            siblings.push(team);
            childrenMap.set(team.parent_team_id, siblings);
          }

          // BFS to calculate levels
          const updates: Array<{ id: string; level: number }> = [];
          const queue: Array<{ team: (typeof allTeams)[0]; level: number }> = [];

          // Start with root teams
          const roots = childrenMap.get(null) || [];
          for (const root of roots) {
            queue.push({ team: root, level: 1 });
          }

          while (queue.length > 0) {
            const { team, level } = queue.shift()!;
            updates.push({ id: team.id, level: Math.min(level, 4) });

            const children = childrenMap.get(team.id) || [];
            for (const child of children) {
              queue.push({ team: child, level: level + 1 });
            }
          }

          // Apply updates
          for (const update of updates) {
            await supabase
              .from("teams")
              .update({
                level: update.level,
                l10_required: update.level <= 2,
              })
              .eq("id", update.id);
          }
        }
      } else if (error) {
        console.error("Error recalculating levels:", error);
      }
    });

    // Step 6: Remove orphaned teams (seats deleted)
    const orphanedTeamsRemoved = await step.run("remove-orphaned-teams", async () => {
      const orphanedTeams = existingTeams.filter((t) => !seatIds.has(t.anchor_seat_id));

      let removed = 0;
      for (const team of orphanedTeams) {
        // First, clear any references to this team
        await supabase.from("rocks").update({ team_id: null }).eq("team_id", team.id);
        await supabase.from("issues").update({ team_id: null }).eq("team_id", team.id);
        await supabase.from("todos").update({ team_id: null }).eq("team_id", team.id);
        await supabase.from("headlines").update({ team_id: null }).eq("team_id", team.id);
        await supabase.from("metrics").update({ team_id: null }).eq("team_id", team.id);
        await supabase.from("individual_goals").delete().eq("team_id", team.id);

        // Clear child team references
        await supabase.from("teams").update({ parent_team_id: null }).eq("parent_team_id", team.id);

        // Delete the team
        const { error } = await supabase.from("teams").delete().eq("id", team.id);
        if (!error) {
          removed++;
        }
      }

      return removed;
    });

    return {
      synced: true,
      organization_id,
      newTeamsCreated,
      orphanedTeamsRemoved,
      totalSeats: seats.length,
    };
  }
);

// Export all team sync functions
export const teamSyncFunctions = [syncTeamsFromAC];
