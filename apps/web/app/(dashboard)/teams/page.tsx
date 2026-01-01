"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users2, LayoutGrid, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TeamTree, TeamGrid } from "@/components/team/team-tree";
import { useTeamContext, Team } from "@/components/team/team-context-provider";

export default function TeamsPage() {
  const router = useRouter();
  const { teams, teamsLoading, teamsError } = useTeamContext();
  const [view, setView] = useState<"tree" | "grid">("tree");

  const handleTeamClick = (team: Team) => {
    router.push(`/teams/${team.slug}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users2 className="h-6 w-6" />
            Teams
          </h1>
          <p className="text-muted-foreground mt-1">
            View your organization&apos;s team hierarchy
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as "tree" | "grid")}
        >
          <ToggleGroupItem value="tree" aria-label="Tree view">
            <LayoutList className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Content */}
      {teamsLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Loading teams...
        </div>
      ) : teamsError ? (
        <div className="flex items-center justify-center py-12 text-destructive">
          Error: {teamsError}
        </div>
      ) : teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium">No teams found</h2>
          <p className="text-muted-foreground mt-1 max-w-md">
            Teams are created automatically from your Accountability Chart.
            Make sure you have seats defined in your org chart.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/accountability-chart")}
          >
            Go to Accountability Chart
          </Button>
        </div>
      ) : view === "tree" ? (
        <TeamTree onTeamClick={handleTeamClick} showMemberAvatars />
      ) : (
        <TeamGrid teams={teams} onTeamClick={handleTeamClick} />
      )}
    </div>
  );
}
