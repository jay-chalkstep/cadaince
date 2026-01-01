"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  Users,
  Building2,
  Briefcase,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useTeamContext,
  Team,
  getTeamLevelLabel,
  getTeamLevelColor,
} from "./team-context-provider";

interface TeamTreeProps {
  className?: string;
  onTeamClick?: (team: Team) => void;
  showMemberAvatars?: boolean;
  expandedByDefault?: boolean;
  highlightTeamId?: string;
}

/**
 * Get icon for team level
 */
function getTeamIcon(level: number) {
  switch (level) {
    case 1:
      return Building2;
    case 2:
      return Briefcase;
    case 3:
      return Users;
    case 4:
      return UserCircle;
    default:
      return Users;
  }
}

interface TeamNodeProps {
  team: Team;
  depth: number;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  onTeamClick?: (team: Team) => void;
  showMemberAvatars: boolean;
  highlightTeamId?: string;
  childTeams: Team[];
}

function TeamNode({
  team,
  depth,
  expandedIds,
  toggleExpanded,
  onTeamClick,
  showMemberAvatars,
  highlightTeamId,
  childTeams,
}: TeamNodeProps) {
  const Icon = getTeamIcon(team.level);
  const hasChildren = childTeams.length > 0;
  const isExpanded = expandedIds.has(team.id);
  const isHighlighted = team.id === highlightTeamId;

  // Get anchor seat assignment for member avatar
  const anchorMember = team.anchor_seat?.assignments?.[0]?.team_member;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer transition-colors",
          isHighlighted && "bg-primary/10 hover:bg-primary/15"
        )}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={() => onTeamClick?.(team)}
      >
        {/* Expand/collapse button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-5 w-5 p-0 hover:bg-transparent",
            !hasChildren && "invisible"
          )}
          onClick={(e) => {
            e.stopPropagation();
            toggleExpanded(team.id);
          }}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>

        {/* Team icon */}
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />

        {/* Team name */}
        <span className="flex-1 truncate font-medium">{team.name}</span>

        {/* Level badge */}
        <Badge
          variant="secondary"
          className={cn("text-[10px] px-1.5", getTeamLevelColor(team.level))}
        >
          {getTeamLevelLabel(team.level)}
        </Badge>

        {/* L10 required indicator */}
        {team.l10_required && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-[10px] px-1">
                  L10
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>L10 meeting required</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Member avatar (team lead) */}
        {showMemberAvatars && anchorMember && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-6 w-6">
                  <AvatarImage
                    src={anchorMember.avatar_url || undefined}
                    alt={anchorMember.full_name}
                  />
                  <AvatarFallback className="text-[10px]">
                    {anchorMember.full_name
                      ?.split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p>{anchorMember.full_name} (Team Lead)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {childTeams.map((child) => (
            <TeamNodeWrapper
              key={child.id}
              team={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
              onTeamClick={onTeamClick}
              showMemberAvatars={showMemberAvatars}
              highlightTeamId={highlightTeamId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamNodeWrapper(props: Omit<TeamNodeProps, "childTeams">) {
  const { getChildTeams } = useTeamContext();
  const childTeams = getChildTeams(props.team.id);
  return <TeamNode {...props} childTeams={childTeams} />;
}

/**
 * TeamTree - Visual tree of all organization teams
 *
 * Features:
 * - Hierarchical display with expand/collapse
 * - Team level indicators
 * - Optional member avatars
 * - Click to navigate
 */
export function TeamTree({
  className,
  onTeamClick,
  showMemberAvatars = false,
  expandedByDefault = true,
  highlightTeamId,
}: TeamTreeProps) {
  const router = useRouter();
  const { teams, teamsLoading, teamsError, getRootTeams, getChildTeams } = useTeamContext();

  // Track expanded nodes
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (expandedByDefault) {
      // Expand all by default
      return new Set(teams.map((t) => t.id));
    }
    // Only expand root teams
    return new Set(getRootTeams().map((t) => t.id));
  });

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleTeamClick = useCallback(
    (team: Team) => {
      if (onTeamClick) {
        onTeamClick(team);
      } else {
        router.push(`/teams/${team.slug}`);
      }
    },
    [onTeamClick, router]
  );

  // Expand/collapse all
  const expandAll = () => setExpandedIds(new Set(teams.map((t) => t.id)));
  const collapseAll = () => setExpandedIds(new Set());

  if (teamsLoading) {
    return (
      <div className={cn("p-4 text-muted-foreground text-center", className)}>
        Loading teams...
      </div>
    );
  }

  if (teamsError) {
    return (
      <div className={cn("p-4 text-destructive text-center", className)}>
        Error: {teamsError}
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className={cn("p-4 text-muted-foreground text-center", className)}>
        No teams found. Teams are created from the Accountability Chart.
      </div>
    );
  }

  const rootTeams = getRootTeams();

  return (
    <div className={className}>
      {/* Controls */}
      <div className="flex items-center justify-end gap-2 mb-2 px-2">
        <Button variant="ghost" size="sm" onClick={expandAll}>
          Expand All
        </Button>
        <Button variant="ghost" size="sm" onClick={collapseAll}>
          Collapse All
        </Button>
      </div>

      {/* Tree */}
      <div className="border rounded-lg">
        {rootTeams.map((team) => (
          <TeamNodeWrapper
            key={team.id}
            team={team}
            depth={0}
            expandedIds={expandedIds}
            toggleExpanded={toggleExpanded}
            onTeamClick={handleTeamClick}
            showMemberAvatars={showMemberAvatars}
            highlightTeamId={highlightTeamId}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * TeamCard - Compact card view of a single team
 */
export function TeamCard({
  team,
  onClick,
  className,
}: {
  team: Team;
  onClick?: () => void;
  className?: string;
}) {
  const Icon = getTeamIcon(team.level);

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors",
        className
      )}
      onClick={onClick}
    >
      <div className="p-2 rounded-md bg-muted">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{team.name}</div>
        {team.anchor_seat?.pillar && (
          <div className="text-sm text-muted-foreground truncate">
            {team.anchor_seat.pillar.name}
          </div>
        )}
      </div>
      <Badge
        variant="secondary"
        className={cn("shrink-0", getTeamLevelColor(team.level))}
      >
        {getTeamLevelLabel(team.level)}
      </Badge>
    </div>
  );
}

/**
 * TeamGrid - Grid view of teams
 */
export function TeamGrid({
  teams,
  onTeamClick,
  className,
}: {
  teams: Team[];
  onTeamClick?: (team: Team) => void;
  className?: string;
}) {
  const router = useRouter();

  const handleClick = (team: Team) => {
    if (onTeamClick) {
      onTeamClick(team);
    } else {
      router.push(`/teams/${team.slug}`);
    }
  };

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
      {teams.map((team) => (
        <TeamCard
          key={team.id}
          team={team}
          onClick={() => handleClick(team)}
        />
      ))}
    </div>
  );
}
