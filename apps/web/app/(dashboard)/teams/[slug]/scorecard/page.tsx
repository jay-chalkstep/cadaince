"use client";

import { BarChart3, ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TeamBreadcrumb } from "@/components/team/team-switcher";
import { useTeamContext } from "@/components/team/team-context-provider";
import { MetricsList } from "@/components/scorecard/metrics-list";

export default function TeamScorecardPage() {
  const router = useRouter();
  const { currentTeam, teamsLoading } = useTeamContext();

  if (teamsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentTeam) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-medium">Team not found</h2>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/teams")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Teams
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <TeamBreadcrumb />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              {currentTeam.name} Scorecard
            </h1>
            <p className="text-muted-foreground mt-1">
              Key metrics for this team
            </p>
          </div>
        </div>
      </div>

      {/* Metrics List */}
      <MetricsList
        teamId={currentTeam.id}
        showHeader={false}
      />
    </div>
  );
}
