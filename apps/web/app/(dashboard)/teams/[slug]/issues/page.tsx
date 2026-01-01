"use client";

import { MessageSquare, ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TeamBreadcrumb } from "@/components/team/team-switcher";
import { useTeamContext } from "@/components/team/team-context-provider";
import { IssuesList } from "@/components/issues/issues-list";

export default function TeamIssuesPage() {
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
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
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
              <MessageSquare className="h-6 w-6" />
              {currentTeam.name} Issues
            </h1>
            <p className="text-muted-foreground mt-1">
              Issues owned by this team
            </p>
          </div>
        </div>
      </div>

      {/* Issues List */}
      <IssuesList
        teamId={currentTeam.id}
        showHeader={false}
      />
    </div>
  );
}
