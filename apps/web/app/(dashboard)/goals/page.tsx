"use client";

import { useState } from "react";
import { Target, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GoalsList } from "@/components/goals/goals-list";
import { useTeamContext } from "@/components/team/team-context-provider";

export default function GoalsPage() {
  const { teams, currentTeam } = useTeamContext();
  const [selectedTeamId, setSelectedTeamId] = useState<string>("all");
  const [tab, setTab] = useState<"my" | "team">("my");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Target className="h-6 w-6" />
            Individual Goals
          </h1>
          <p className="text-muted-foreground mt-1">
            Track personal goals that support team rocks
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as "my" | "team")}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="my">My Goals</TabsTrigger>
            <TabsTrigger value="team">Team Goals</TabsTrigger>
          </TabsList>

          {tab === "team" && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <TabsContent value="my" className="mt-6">
          <GoalsList myGoals showCreateButton />
        </TabsContent>

        <TabsContent value="team" className="mt-6">
          <GoalsList
            teamId={selectedTeamId === "all" ? undefined : selectedTeamId}
            showCreateButton
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
