"use client";

import { useEffect, useState } from "react";
import { Plus, Mountain, Loader2 } from "lucide-react";
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
import { RockDetailSheet } from "@/components/rocks/rock-detail-sheet";
import { CreateRockDialog } from "@/components/rocks/create-rock-dialog";

interface Rock {
  id: string;
  name: string;
  title?: string;
  description: string | null;
  status: "not_started" | "on_track" | "off_track" | "complete";
  quarter: number;
  year: number;
  owner: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  pillar: {
    id: string;
    name: string;
  } | null;
}

// Helper to get rock display name
const getRockName = (rock: Rock) => rock.title || rock.name;

const statusConfig = {
  not_started: { label: "Not Started", color: "bg-gray-500" },
  on_track: { label: "On Track", color: "bg-green-600" },
  off_track: { label: "Off Track", color: "bg-red-600" },
  complete: { label: "Complete", color: "bg-blue-600" },
};

export default function RocksPage() {
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRock, setSelectedRock] = useState<Rock | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Default to current quarter/year
  const now = new Date();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
  const currentYear = now.getFullYear();

  const [quarter, setQuarter] = useState(currentQuarter.toString());
  const [year, setYear] = useState(currentYear.toString());

  const fetchRocks = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rocks?quarter=${quarter}&year=${year}`);
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
  }, [quarter, year]);

  const handleRockClick = (rock: Rock) => {
    setSelectedRock(rock);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Rocks</h1>
          <p className="text-sm text-muted-foreground">
            Quarterly priorities and major initiatives
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Select value={quarter} onValueChange={setQuarter}>
              <SelectTrigger className="w-24">
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
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={(currentYear - 1).toString()}>{currentYear - 1}</SelectItem>
                <SelectItem value={currentYear.toString()}>{currentYear}</SelectItem>
                <SelectItem value={(currentYear + 1).toString()}>{currentYear + 1}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Rock
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
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
      ) : rocks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mountain className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No rocks for Q{quarter} {year}</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first rock to start tracking quarterly priorities.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Rock
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {statusOrder.map((status) => {
            const statusRocks = groupedRocks[status] || [];
            if (statusRocks.length === 0) return null;

            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline" className={statusConfig[status].color + " text-white border-0"}>
                    {statusConfig[status].label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {statusRocks.length} rock{statusRocks.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {statusRocks.map((rock) => (
                    <Card
                      key={rock.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleRockClick(rock)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base font-medium line-clamp-2">
                            {getRockName(rock)}
                          </CardTitle>
                        </div>
                        {rock.pillar && (
                          <Badge variant="secondary" className="w-fit text-xs">
                            {rock.pillar.name}
                          </Badge>
                        )}
                      </CardHeader>
                      <CardContent>
                        {rock.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {rock.description}
                          </p>
                        )}
                        {rock.owner && (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={rock.owner.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(rock.owner.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-muted-foreground">
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
      />
    </div>
  );
}
