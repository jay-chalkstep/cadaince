"use client";

import { useState, useEffect } from "react";
import { Target, Filter } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GoalsList } from "@/components/goals/goals-list";

interface Pillar {
  id: string;
  name: string;
  color: string;
}

export default function GoalsPage() {
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [selectedPillarId, setSelectedPillarId] = useState<string>("all");
  const [tab, setTab] = useState<"my" | "pillar">("my");

  useEffect(() => {
    async function fetchPillars() {
      try {
        const res = await fetch("/api/pillars");
        if (res.ok) {
          const data = await res.json();
          setPillars(data);
        }
      } catch (error) {
        console.error("Failed to fetch pillars:", error);
      }
    }
    fetchPillars();
  }, []);

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
            Track personal goals that support rocks
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as "my" | "pillar")}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="my">My Goals</TabsTrigger>
            <TabsTrigger value="pillar">Pillar Goals</TabsTrigger>
          </TabsList>

          {tab === "pillar" && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedPillarId} onValueChange={setSelectedPillarId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by pillar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pillars</SelectItem>
                  {pillars.map((pillar) => (
                    <SelectItem key={pillar.id} value={pillar.id}>
                      {pillar.name}
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

        <TabsContent value="pillar" className="mt-6">
          <GoalsList
            pillarId={selectedPillarId === "all" ? undefined : selectedPillarId}
            showCreateButton
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
