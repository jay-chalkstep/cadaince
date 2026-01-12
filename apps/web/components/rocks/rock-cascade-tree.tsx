"use client";

import { useState, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  CircleDot,
  Loader2,
  ArrowDownRight,
  Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface CascadeRock {
  id: string;
  title: string;
  status: "not_started" | "on_track" | "off_track" | "at_risk" | "complete";
  rock_level: "company" | "pillar" | "individual";
  owner?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  team?: {
    id: string;
    name: string;
  } | null;
  children_count: number;
  children_on_track: number;
  children?: CascadeRock[];
}

/**
 * Get status color for rock
 */
function getStatusColor(status: string): string {
  switch (status) {
    case "on_track":
      return "bg-green-100 text-green-800";
    case "off_track":
      return "bg-red-100 text-red-800";
    case "at_risk":
      return "bg-amber-100 text-amber-800";
    case "complete":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/**
 * Get pillar badge color based on pillar name
 * Uses a hash of the name to pick a consistent color
 */
function getPillarColor(pillarName: string): string {
  const colors = [
    "bg-blue-100 text-blue-800",
    "bg-purple-100 text-purple-800",
    "bg-emerald-100 text-emerald-800",
    "bg-amber-100 text-amber-800",
    "bg-pink-100 text-pink-800",
    "bg-cyan-100 text-cyan-800",
    "bg-indigo-100 text-indigo-800",
  ];
  // Simple hash to pick consistent color for same pillar name
  let hash = 0;
  for (let i = 0; i < pillarName.length; i++) {
    hash = pillarName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

interface RockCascadeNodeProps {
  rock: CascadeRock;
  depth: number;
  onRockClick?: (rock: CascadeRock) => void;
}

function RockCascadeNode({ rock, depth, onRockClick }: RockCascadeNodeProps) {
  const [open, setOpen] = useState(depth < 1);
  const [children, setChildren] = useState<CascadeRock[]>(rock.children || []);
  const [loading, setLoading] = useState(false);

  const hasChildren = rock.children_count > 0;
  const progressPercent =
    rock.children_count > 0
      ? Math.round((rock.children_on_track / rock.children_count) * 100)
      : null;

  // Fetch children when expanded
  useEffect(() => {
    if (open && hasChildren && children.length === 0) {
      const fetchChildren = async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/rocks/${rock.id}/children`);
          if (res.ok) {
            const data = await res.json();
            setChildren(data.children || []);
          }
        } catch (error) {
          console.error("Failed to fetch rock children:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchChildren();
    }
  }, [open, hasChildren, children.length, rock.id]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "group flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50 transition-colors",
          depth === 0 && "bg-muted/30"
        )}
        style={{ paddingLeft: `${12 + depth * 24}px` }}
      >
        {/* Expand/collapse button */}
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-5 w-5 p-0 hover:bg-transparent shrink-0",
              !hasChildren && "invisible"
            )}
          >
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>

        {/* Rock icon */}
        <CircleDot className="h-4 w-4 shrink-0 text-muted-foreground" />

        {/* Title and owner */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => onRockClick?.(rock)}
        >
          <div className="font-medium truncate">{rock.title}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            {rock.owner && <span>{rock.owner.full_name}</span>}
            {rock.team && (
              <>
                {rock.owner && <span>•</span>}
                <span className="flex items-center gap-1">
                  <Users2 className="h-3 w-3" />
                  {rock.team.name}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Progress indicator for parent rocks */}
        {progressPercent !== null && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-16 flex items-center gap-1">
                  <Progress value={progressPercent} className="h-1.5" />
                  <span className="text-[10px] text-muted-foreground">
                    {progressPercent}%
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {rock.children_on_track} of {rock.children_count} child rocks on
                track
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Status badge */}
        <Badge
          variant="secondary"
          className={cn("shrink-0 text-[10px]", getStatusColor(rock.status))}
        >
          {rock.status.replace("_", " ")}
        </Badge>

        {/* Pillar badge - show for pillar rocks */}
        {rock.team && rock.rock_level === "pillar" && (
          <Badge
            variant="secondary"
            className={cn("shrink-0 text-[10px]", getPillarColor(rock.team.name))}
          >
            {rock.team.name}
          </Badge>
        )}

        {/* Owner badge - show for individual rocks */}
        {rock.owner && rock.rock_level === "individual" && (
          <Badge
            variant="secondary"
            className="shrink-0 text-[10px] bg-slate-100 text-slate-800"
          >
            {rock.owner.full_name}
          </Badge>
        )}
      </div>

      {/* Children */}
      <CollapsibleContent>
        {loading ? (
          <div
            className="flex items-center gap-2 py-2 text-sm text-muted-foreground"
            style={{ paddingLeft: `${36 + depth * 24}px` }}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading child rocks...
          </div>
        ) : (
          children.map((child) => (
            <RockCascadeNode
              key={child.id}
              rock={child}
              depth={depth + 1}
              onRockClick={onRockClick}
            />
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface RockCascadeTreeProps {
  quarterId?: string;
  className?: string;
  onRockClick?: (rock: CascadeRock) => void;
}

/**
 * RockCascadeTree - Shows hierarchical view of rocks (Company → Pillar → Individual)
 */
export function RockCascadeTree({
  quarterId,
  className,
  onRockClick,
}: RockCascadeTreeProps) {
  const [rocks, setRocks] = useState<CascadeRock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRocks = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("level", "company");
        if (quarterId) {
          params.set("quarter_id", quarterId);
        }

        const res = await fetch(`/api/rocks/cascade?${params}`);
        if (!res.ok) throw new Error("Failed to fetch rocks");

        const data = await res.json();
        setRocks(data.rocks || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchRocks();
  }, [quarterId]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("text-center py-8 text-destructive", className)}>
        Error: {error}
      </div>
    );
  }

  if (rocks.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <CircleDot className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No company rocks found</p>
        <p className="text-sm mt-1">
          Create company rocks to see the cascade view
        </p>
      </div>
    );
  }

  return (
    <div className={cn("border rounded-lg divide-y", className)}>
      {rocks.map((rock) => (
        <RockCascadeNode
          key={rock.id}
          rock={rock}
          depth={0}
          onRockClick={onRockClick}
        />
      ))}
    </div>
  );
}

interface RockChildrenIndicatorProps {
  rockId: string;
  childrenCount: number;
  childrenOnTrack: number;
  className?: string;
}

/**
 * RockChildrenIndicator - Shows cascade status for a single rock
 */
export function RockChildrenIndicator({
  rockId,
  childrenCount,
  childrenOnTrack,
  className,
}: RockChildrenIndicatorProps) {
  if (childrenCount === 0) return null;

  const progressPercent = Math.round((childrenOnTrack / childrenCount) * 100);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-1.5 text-muted-foreground",
              className
            )}
          >
            <ArrowDownRight className="h-3 w-3" />
            <span className="text-xs">
              {childrenOnTrack}/{childrenCount}
            </span>
            <Progress value={progressPercent} className="w-12 h-1.5" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {childrenOnTrack} of {childrenCount} supporting rocks on track (
            {progressPercent}%)
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
