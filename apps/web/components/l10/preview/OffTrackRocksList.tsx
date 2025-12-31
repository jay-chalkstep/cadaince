"use client";

import { useState, useCallback } from "react";
import { Target, AlertCircle, XCircle, Loader2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PreviewSection } from "./PreviewSection";
import { RockDetailSheet } from "@/components/rocks/rock-detail-sheet";

interface OffTrackRock {
  id: string;
  title: string;
  status: string;
  due_date: string;
  owner: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

interface FullRock {
  id: string;
  name: string;
  title?: string;
  description: string | null;
  status: "not_started" | "on_track" | "off_track" | "complete";
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

interface OffTrackRocksListProps {
  rocks: OffTrackRock[];
  onRockUpdated?: () => void;
}

export function OffTrackRocksList({ rocks, onRockUpdated }: OffTrackRocksListProps) {
  const [selectedRock, setSelectedRock] = useState<FullRock | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loadingRockId, setLoadingRockId] = useState<string | null>(null);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "off_track":
        return {
          label: "Off Track",
          icon: XCircle,
          color: "bg-red-100 text-red-700",
        };
      case "at_risk":
        return {
          label: "At Risk",
          icon: AlertCircle,
          color: "bg-yellow-100 text-yellow-700",
        };
      default:
        return {
          label: status,
          icon: Target,
          color: "bg-gray-100 text-gray-700",
        };
    }
  };

  const getDaysRemaining = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleRockClick = useCallback(async (rock: OffTrackRock) => {
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
    onRockUpdated?.();
  }, [selectedRock, onRockUpdated]);

  return (
    <>
      <PreviewSection
        title="Rocks Off-Track"
        count={rocks.length}
        icon={<Target className="h-4 w-4 text-yellow-600" />}
        defaultExpanded={true}
      >
        <div className="space-y-2">
          {rocks.map((rock) => {
            const owner = Array.isArray(rock.owner) ? rock.owner[0] : rock.owner;
            const config = getStatusConfig(rock.status);
            const StatusIcon = config.icon;
            const daysRemaining = getDaysRemaining(rock.due_date);
            const isLoading = loadingRockId === rock.id;

            return (
              <div
                key={rock.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 hover:border-primary/50 transition-colors cursor-pointer group"
                onClick={() => handleRockClick(rock)}
              >
                <StatusIcon className={`h-5 w-5 shrink-0 ${
                  rock.status === "off_track" ? "text-red-600" : "text-yellow-600"
                }`} />
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
                    {rock.title}
                  </h4>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {owner && (
                      <>
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={owner.avatar_url || undefined} />
                          <AvatarFallback className="text-[8px]">
                            {getInitials(owner.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{owner.full_name}</span>
                      </>
                    )}
                    <span>·</span>
                    <span className={daysRemaining < 0 ? "text-red-500" : ""}>
                      {daysRemaining < 0
                        ? `${Math.abs(daysRemaining)}d overdue`
                        : `${daysRemaining}d left`}
                    </span>
                  </div>
                </div>
                <Badge className={config.color}>
                  {config.label}
                </Badge>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            );
          })}
        </div>
      </PreviewSection>

      <RockDetailSheet
        rock={selectedRock}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdate={handleRockUpdate}
      />
    </>
  );
}
