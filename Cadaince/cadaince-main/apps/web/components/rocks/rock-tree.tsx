"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Target,
  Building2,
  User,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface Rock {
  id: string;
  title: string;
  description: string | null;
  status: "on_track" | "off_track" | "at_risk" | "complete";
  rock_level: "company" | "pillar" | "individual";
  due_date: string;
  owner: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    title?: string | null;
  } | null;
  pillar: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  children?: Rock[];
}

interface RockTreeProps {
  rocks: Rock[];
  onRockClick?: (rock: Rock) => void;
  expandedIds?: Set<string>;
  onToggleExpand?: (rockId: string) => void;
  showOwner?: boolean;
  showPillar?: boolean;
  defaultExpanded?: boolean;
}

const statusConfig = {
  on_track: {
    label: "On Track",
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
  },
  off_track: {
    label: "Off Track",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-100",
    textColor: "text-red-800",
  },
  at_risk: {
    label: "At Risk",
    icon: AlertCircle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-800",
  },
  complete: {
    label: "Complete",
    icon: CheckCircle2,
    color: "text-muted-foreground",
    bgColor: "bg-gray-100",
    textColor: "text-gray-800",
  },
};

const levelConfig = {
  company: {
    icon: Target,
    label: "Company Rock",
    indent: 0,
  },
  pillar: {
    icon: Building2,
    label: "Pillar Rock",
    indent: 1,
  },
  individual: {
    icon: User,
    label: "Individual Rock",
    indent: 2,
  },
};

function RockTreeNode({
  rock,
  onRockClick,
  isExpanded,
  onToggleExpand,
  showOwner = true,
  showPillar = true,
  depth = 0,
}: {
  rock: Rock;
  onRockClick?: (rock: Rock) => void;
  isExpanded: boolean;
  onToggleExpand: (rockId: string) => void;
  showOwner?: boolean;
  showPillar?: boolean;
  depth?: number;
}) {
  const hasChildren = rock.children && rock.children.length > 0;
  const status = statusConfig[rock.status];
  const level = levelConfig[rock.rock_level];
  const StatusIcon = status.icon;
  const LevelIcon = level.icon;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer",
          depth > 0 && "ml-6"
        )}
        onClick={() => onRockClick?.(rock)}
      >
        {/* Expand/collapse toggle */}
        <div className="w-5 flex-shrink-0">
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(rock.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <Circle className="h-2 w-2 text-muted-foreground/30 mx-auto" />
          )}
        </div>

        {/* Status icon */}
        <StatusIcon className={cn("h-4 w-4 flex-shrink-0", status.color)} />

        {/* Level icon for non-company rocks */}
        {rock.rock_level !== "company" && (
          <LevelIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{rock.title}</p>
          {rock.description && (
            <p className="text-xs text-muted-foreground truncate">{rock.description}</p>
          )}
        </div>

        {/* Pillar badge */}
        {showPillar && rock.pillar && (
          <Badge
            variant="outline"
            className="text-xs flex-shrink-0"
            style={{
              borderColor: rock.pillar.color || undefined,
              color: rock.pillar.color || undefined,
            }}
          >
            {rock.pillar.name}
          </Badge>
        )}

        {/* Status badge */}
        <Badge
          className={cn("text-xs flex-shrink-0", status.bgColor, status.textColor)}
          variant="secondary"
        >
          {status.label}
        </Badge>

        {/* Owner avatar */}
        {showOwner && rock.owner && (
          <Avatar className="h-6 w-6 flex-shrink-0">
            <AvatarImage src={rock.owner.avatar_url || undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(rock.owner.full_name)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="border-l-2 border-muted ml-5">
          {rock.children!.map((child) => (
            <RockTreeNode
              key={child.id}
              rock={child}
              onRockClick={onRockClick}
              isExpanded={true}
              onToggleExpand={onToggleExpand}
              showOwner={showOwner}
              showPillar={showPillar}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function RockTree({
  rocks,
  onRockClick,
  expandedIds: controlledExpandedIds,
  onToggleExpand: controlledOnToggle,
  showOwner = true,
  showPillar = true,
  defaultExpanded = true,
}: RockTreeProps) {
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(
    () => {
      if (defaultExpanded) {
        // Expand all rocks with children
        const ids = new Set<string>();
        const addWithChildren = (rockList: Rock[]) => {
          rockList.forEach((rock) => {
            if (rock.children && rock.children.length > 0) {
              ids.add(rock.id);
              addWithChildren(rock.children);
            }
          });
        };
        addWithChildren(rocks);
        return ids;
      }
      return new Set();
    }
  );

  const expandedIds = controlledExpandedIds ?? internalExpandedIds;
  const handleToggle = controlledOnToggle ?? ((rockId: string) => {
    setInternalExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rockId)) {
        next.delete(rockId);
      } else {
        next.add(rockId);
      }
      return next;
    });
  });

  if (rocks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No rocks found</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {rocks.map((rock) => (
        <RockTreeNode
          key={rock.id}
          rock={rock}
          onRockClick={onRockClick}
          isExpanded={expandedIds.has(rock.id)}
          onToggleExpand={handleToggle}
          showOwner={showOwner}
          showPillar={showPillar}
        />
      ))}
    </div>
  );
}

export function RockTreeSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="flex items-center gap-2 py-2 px-3">
          <div className="h-4 w-4 bg-muted rounded animate-pulse" />
          <div className="h-4 w-4 bg-muted rounded animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-5 w-16 bg-muted rounded animate-pulse" />
          <div className="h-6 w-6 bg-muted rounded-full animate-pulse" />
        </div>
      ))}
    </div>
  );
}
