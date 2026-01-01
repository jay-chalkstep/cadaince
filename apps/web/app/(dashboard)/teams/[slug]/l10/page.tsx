"use client";

import { Video, ArrowLeft, Loader2, Calendar, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamBreadcrumb } from "@/components/team/team-switcher";
import { useTeamContext } from "@/components/team/team-context-provider";

export default function TeamL10Page() {
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
        <Video className="h-12 w-12 text-muted-foreground mb-4" />
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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Video className="h-6 w-6" />
              {currentTeam.name} L10 Meeting
            </h1>
            {currentTeam.l10_required ? (
              <Badge>Required</Badge>
            ) : (
              <Badge variant="secondary">Optional</Badge>
            )}
          </div>
          <Button>
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Meeting
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Next Meeting */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Next Meeting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No upcoming L10 meetings scheduled</p>
              <Button variant="outline" className="mt-4">
                Schedule First Meeting
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Meeting History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Video className="h-5 w-5" />
              Recent Meetings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No previous meetings</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* L10 Status Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About L10 Meetings</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <p className="text-muted-foreground">
            L10 (Level 10) meetings are weekly team meetings designed to solve
            issues, review the scorecard, and ensure alignment. Each meeting
            follows a structured agenda:
          </p>
          <ul className="text-muted-foreground mt-2 space-y-1">
            <li>Segue (5 min) - Good news and personal/professional wins</li>
            <li>Scorecard Review (5 min) - Check key metrics</li>
            <li>Rock Review (5 min) - Quarterly priority status</li>
            <li>Headlines (5 min) - Customer and employee news</li>
            <li>To-Do List (5 min) - Review weekly action items</li>
            <li>IDS (60 min) - Identify, Discuss, Solve issues</li>
            <li>Conclude (5 min) - Recap and rate the meeting</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
