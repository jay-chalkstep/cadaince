"use client";

import { useEffect, useState } from "react";
import { Plus, Mountain, LayoutList, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RockDetailSheet } from "@/components/rocks/rock-detail-sheet";
import { CreateRockDialog } from "@/components/rocks/create-rock-dialog";
import { RockCascadeTree, CascadeRock } from "@/components/rocks/rock-cascade-tree";

interface Rock {
  id: string;
  name: string;
  title?: string;
  description: string | null;
  status: "not_started" | "on_track" | "off_track" | "at_risk" | "complete";
  quarter: number;
  year: number;
  rock_level?: string;
  owner: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  pillar: {
    id: string;
    name: string;
  } | null;
  team?: {
    id: string;
    name: string;
    level?: number;
  } | null;
}

interface RocksListProps {
  teamId?: string;
  showTeamBadge?: boolean;
  showHeader?: boolean;
  showCascadeView?: boolean;
  compact?: boolean;
}

const statusConfig = {
  not_started: { label: "Not Started", color: "bg-gray-500" },
  on_track: { label: "On Track", color: "bg-green-600" },
  off_track: { label: "Off Track", color: "bg-red-600" },
  at_risk: { label: "At Risk", color: "bg-yellow-600" },
  complete: { label: "Complete", color: "bg-blue-600" },
};

const getRockName = (rock: Rock) => rock.title || rock.name;

export function RocksList({
  teamId,
  showTeamBadge = false,
  showHeader = true,
  showCascadeView = true,
  compact = false,
}: RocksListProps) {
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRock, setSelectedRock] = useState<Rock | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [view, setView] = useState<"list" | "cascade">("list");

  // Default to current quarter/year
  const now = new Date();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
  const currentYear = now.getFullYear();

  const [quarter, setQuarter] = useState(currentQuarter.toString());
  const [year, setYear] = useState(currentYear.toString());

  const fetchRocks = async () => {
    setLoading(true);
    try {
      let url = `/api/rocks?quarter=${quarter}&year=${year}`;
      if (teamId) {
        url += `&team_id=${teamId}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setRocks(data);
      }
    } catch (error) {
      console.error("Failed to fetch rocks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRocks();
  }, [quarter, year, teamId]);

  const handleRockClick = (rock: Rock) => {
    setSelectedRock(rock);
    setSheetOpen(true);
  };

  const handleCascadeRockClick = (rock: CascadeRock) => {
    setSelectedRock({
      id: rock.id,
      name: rock.title,
      title: rock.title,
      description: null,
      status: rock.status,
      quarter: parseInt(quarter),
      year: parseInt(year),
      rock_level: rock.rock_level,
      owner: rock.owner || null,
      pillar: null,
      team: rock.team || null,
    });
    setSheetOpen(true);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const groupedRocks = rocks.reduce((acc, rock) => {
    const status = rock.status;
    if (!acc[status]) acc[status] = [];
    acc[status].push(rock);
    return acc;
  }, {} as Record<string, Rock[]>);

  const statusOrder: Rock["status"][] = ["on_track", "not_started", "off_track", "complete"];

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Rocks</h2>
            <p className="text-sm text-muted-foreground">
              Quarterly priorities and initiatives
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Select value={quarter} onValueChange={setQuarter}>
                <SelectTrigger className={compact ? "w-20 h-8" : "w-24"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1</SelectItem>
                  <SelectItem value="2">Q2</SelectItem>
                  <SelectItem value="3">Q3</SelectItem>
                  <SelectItem value="4">Q4</SelectItem>
                </SelectContent>
              </Select>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className={compact ? "w-24 h-8" : "w-28"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={(currentYear - 1).toString()}>{currentYear - 1}</SelectItem>
                  <SelectItem value={currentYear.toString()}>{currentYear}</SelectItem>
                  <SelectItem value={(currentYear + 1).toString()}>{currentYear + 1}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size={compact ? "sm" : "default"} onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Rock
            </Button>
          </div>
        </div>
      )}

      {showCascadeView ? (
        <Tabs value={view} onValueChange={(v) => setView(v as "list" | "cascade")}>
          <TabsList className={compact ? "h-8" : ""}>
            <TabsTrigger value="list" className={compact ? "text-xs h-7 gap-1" : "gap-2"}>
              <LayoutList className={compact ? "h-3 w-3" : "h-4 w-4"} />
              List
            </TabsTrigger>
            <TabsTrigger value="cascade" className={compact ? "text-xs h-7 gap-1" : "gap-2"}>
              <GitBranch className={compact ? "h-3 w-3" : "h-4 w-4"} />
              Cascade
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cascade" className="mt-4">
            <RockCascadeTree onRockClick={handleCascadeRockClick} />
          </TabsContent>

          <TabsContent value="list" className="mt-4">
            {renderRocksList()}
          </TabsContent>
        </Tabs>
      ) : (
        renderRocksList()
      )}

      <RockDetailSheet
        rock={selectedRock}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdate={fetchRocks}
      />

      <CreateRockDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={fetchRocks}
        defaultQuarter={parseInt(quarter)}
        defaultYear={parseInt(year)}
        defaultTeamId={teamId}
      />
    </div>
  );

  function renderRocksList() {
    if (loading) {
      return (
        <div className={`grid gap-4 ${compact ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"}`}>
          {Array.from({ length: compact ? 4 : 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (rocks.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Mountain className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No rocks for Q{quarter} {year}</p>
            <p className="text-sm text-muted-foreground mb-4">
              {teamId ? "This team has no rocks for this quarter." : "Create your first rock to get started."}
            </p>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Rock
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {statusOrder.map((status) => {
          const statusRocks = groupedRocks[status] || [];
          if (statusRocks.length === 0) return null;

          return (
            <div key={status}>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className={statusConfig[status].color + " text-white border-0"}>
                  {statusConfig[status].label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {statusRocks.length} rock{statusRocks.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className={`grid gap-4 ${compact ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"}`}>
                {statusRocks.map((rock) => (
                  <Card
                    key={rock.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleRockClick(rock)}
                  >
                    <CardHeader className={compact ? "pb-2 pt-3 px-3" : "pb-3"}>
                      <div className="flex items-start justify-between">
                        <CardTitle className={`font-medium line-clamp-2 ${compact ? "text-sm" : "text-base"}`}>
                          {getRockName(rock)}
                        </CardTitle>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {rock.pillar && (
                          <Badge variant="secondary" className="w-fit text-xs">
                            {rock.pillar.name}
                          </Badge>
                        )}
                        {showTeamBadge && rock.team && (
                          <Badge variant="outline" className="w-fit text-xs">
                            {rock.team.name}
                          </Badge>
                        )}
                        {rock.rock_level && rock.rock_level !== "company" && (
                          <Badge variant="outline" className="w-fit text-xs capitalize">
                            {rock.rock_level}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className={compact ? "pb-3 px-3" : ""}>
                      {!compact && rock.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {rock.description}
                        </p>
                      )}
                      {rock.owner && (
                        <div className="flex items-center gap-2">
                          <Avatar className={compact ? "h-5 w-5" : "h-6 w-6"}>
                            <AvatarImage src={rock.owner.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(rock.owner.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className={`text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>
                            {rock.owner.full_name}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
}
