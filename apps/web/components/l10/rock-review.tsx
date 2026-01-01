"use client";

import { useState, useCallback } from "react";
import { CircleDot, CheckCircle2, AlertCircle, XCircle, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RockDetailSheet } from "@/components/rocks/rock-detail-sheet";

interface Rock {
  id: string;
  title: string;
  status: string;
  due_date: string;
  owner?: {
    id: string;
    full_name: string;
  };
}

interface FullRock {
  id: string;
  name: string;
  title?: string;
  description: string | null;
  status: "not_started" | "on_track" | "off_track" | "at_risk" | "complete";
  quarter: number;
  year: number;
  milestone_count?: number;
  milestones_complete?: number;
  owner: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  pillar: {
    id: string;
    name: string;
    color?: string;
  } | null;
}

interface RockReviewProps {
  rocks: Rock[];
  onRockUpdated?: () => void;
}

export function RockReview({ rocks, onRockUpdated }: RockReviewProps) {
  const [selectedRock, setSelectedRock] = useState<FullRock | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loadingRockId, setLoadingRockId] = useState<string | null>(null);

  const handleRockClick = useCallback(async (rock: Rock) => {
    setLoadingRockId(rock.id);
    try {
      const response = await fetch(`/api/rocks/${rock.id}`);
      if (response.ok) {
        const fullRock = await response.json();
        setSelectedRock({
          ...fullRock,
          name: fullRock.title,
          quarter: fullRock.quarter?.quarter || 1,
          year: fullRock.quarter?.year || new Date().getFullYear(),
        });
        setSheetOpen(true);
      }
    } catch (error) {
      console.error("Failed to fetch rock details:", error);
    } finally {
      setLoadingRockId(null);
    }
  }, []);

  const handleRockUpdate = useCallback(() => {
    // Refetch the current rock to update the sheet
    if (selectedRock) {
      fetch(`/api/rocks/${selectedRock.id}`)
        .then((res) => res.json())
        .then((fullRock) => {
          setSelectedRock({
            ...fullRock,
            name: fullRock.title,
            quarter: fullRock.quarter?.quarter || 1,
            year: fullRock.quarter?.year || new Date().getFullYear(),
          });
        })
        .catch(console.error);
    }
    // Notify parent that a rock was updated (in case they want to refresh)
    onRockUpdated?.();
  }, [selectedRock, onRockUpdated]);
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "on_track":
        return {
          label: "On Track",
          color: "bg-green-600",
          icon: CheckCircle2,
        };
      case "at_risk":
        return {
          label: "At Risk",
          color: "bg-yellow-500",
          icon: AlertCircle,
        };
      case "off_track":
        return {
          label: "Off Track",
          color: "bg-red-600",
          icon: XCircle,
        };
      case "complete":
        return {
          label: "Complete",
          color: "bg-blue-600",
          icon: CheckCircle2,
        };
      default:
        return {
          label: "Not Started",
          color: "bg-gray-500",
          icon: CircleDot,
        };
    }
  };

  const getDaysRemaining = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (rocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No rocks to review
      </div>
    );
  }

  // Group by status
  const groupedRocks = rocks.reduce(
    (acc, rock) => {
      const group = rock.status === "complete" ? "complete" : "active";
      acc[group].push(rock);
      return acc;
    },
    { active: [] as Rock[], complete: [] as Rock[] }
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review quarterly rock progress. Update status if needed.
      </p>

      {/* Active Rocks */}
      {groupedRocks.active.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {groupedRocks.active.map((rock) => {
            const config = getStatusConfig(rock.status);
            const daysRemaining = getDaysRemaining(rock.due_date);
            const StatusIcon = config.icon;

            const isLoading = loadingRockId === rock.id;

            return (
              <Card
                key={rock.id}
                className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50 group"
                onClick={() => handleRockClick(rock)}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium line-clamp-2 group-hover:text-primary transition-colors">
                        {rock.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {rock.owner?.full_name || "Unassigned"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`${config.color}`}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {config.label}
                      </Badge>
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Due: {new Date(rock.due_date).toLocaleDateString()}</span>
                    <span
                      className={
                        daysRemaining < 0
                          ? "text-red-500"
                          : daysRemaining < 14
                            ? "text-yellow-500"
                            : ""
                      }
                    >
                      {daysRemaining < 0
                        ? `${Math.abs(daysRemaining)} days overdue`
                        : `${daysRemaining} days remaining`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Completed Rocks */}
      {groupedRocks.complete.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Completed</h4>
          <div className="space-y-2">
            {groupedRocks.complete.map((rock) => {
              const isLoading = loadingRockId === rock.id;
              return (
                <div
                  key={rock.id}
                  className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 cursor-pointer hover:bg-muted transition-colors group"
                  onClick={() => handleRockClick(rock)}
                >
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm flex-1 group-hover:text-primary transition-colors">
                    {rock.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    — {rock.owner?.full_name}
                  </span>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rock Detail Sheet */}
      <RockDetailSheet
        rock={selectedRock}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdate={handleRockUpdate}
      />
    </div>
  );
}
