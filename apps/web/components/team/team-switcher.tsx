"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Users, Building2, Briefcase, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  useTeamContext,
  Team,
  getTeamLevelLabel,
  getTeamLevelColor,
} from "./team-context-provider";

interface TeamSwitcherProps {
  className?: string;
  showAllTeams?: boolean;
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

/**
 * TeamSwitcher - Dropdown to switch between teams
 *
 * Shows current team and allows navigation to other teams.
 * Displays team hierarchy with indentation.
 */
export function TeamSwitcher({ className, showAllTeams = true }: TeamSwitcherProps) {
  const router = useRouter();
  const { currentTeam, teams, teamsLoading, getRootTeams, getChildTeams } = useTeamContext();
  const [open, setOpen] = useState(false);

  const handleSelectTeam = (team: Team) => {
    router.push(`/teams/${team.slug}`);
    setOpen(false);
  };

  // Build hierarchical team list for display
  const renderTeamItem = (team: Team, depth: number = 0) => {
    const Icon = getTeamIcon(team.level);
    const isSelected = currentTeam?.id === team.id;
    const children = getChildTeams(team.id);

    return (
      <div key={team.id}>
        <DropdownMenuItem
          className={cn(
            "flex items-center gap-2 cursor-pointer",
            depth > 0 && `ml-${Math.min(depth * 4, 12)}`
          )}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onSelect={() => handleSelectTeam(team)}
        >
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">{team.name}</span>
          {team.is_elt && (
            <Badge variant="secondary" className="text-[10px] px-1">
              ELT
            </Badge>
          )}
          {isSelected && <Check className="h-4 w-4 shrink-0" />}
        </DropdownMenuItem>
        {children.map((child) => renderTeamItem(child, depth + 1))}
      </div>
    );
  };

  // Current team display
  const CurrentTeamIcon = currentTeam ? getTeamIcon(currentTeam.level) : Users;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between gap-2", className)}
        >
          <CurrentTeamIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {teamsLoading
              ? "Loading..."
              : currentTeam
                ? currentTeam.name
                : "Select team"}
          </span>
          {currentTeam && (
            <Badge
              variant="secondary"
              className={cn("text-[10px] px-1.5", getTeamLevelColor(currentTeam.level))}
            >
              {getTeamLevelLabel(currentTeam.level)}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[280px]" align="start">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Teams
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {teamsLoading ? (
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            Loading teams...
          </div>
        ) : teams.length === 0 ? (
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            No teams found
          </div>
        ) : showAllTeams ? (
          // Show hierarchical view
          getRootTeams().map((team) => renderTeamItem(team))
        ) : (
          // Show flat list
          teams.map((team) => {
            const Icon = getTeamIcon(team.level);
            const isSelected = currentTeam?.id === team.id;
            return (
              <DropdownMenuItem
                key={team.id}
                className="flex items-center gap-2 cursor-pointer"
                onSelect={() => handleSelectTeam(team)}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{team.name}</span>
                <Badge
                  variant="secondary"
                  className={cn("text-[10px] px-1", getTeamLevelColor(team.level))}
                >
                  L{team.level}
                </Badge>
                {isSelected && <Check className="h-4 w-4 shrink-0" />}
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * TeamBreadcrumb - Shows current team's hierarchy path
 */
export function TeamBreadcrumb({ className }: { className?: string }) {
  const router = useRouter();
  const { currentTeam, teamHierarchy } = useTeamContext();

  if (!currentTeam) return null;

  const allTeams = [...teamHierarchy, currentTeam];

  return (
    <nav className={cn("flex items-center gap-1 text-sm", className)}>
      {allTeams.map((team, index) => (
        <div key={team.id} className="flex items-center">
          {index > 0 && (
            <span className="mx-1 text-muted-foreground">/</span>
          )}
          <button
            onClick={() => router.push(`/teams/${team.slug}`)}
            className={cn(
              "hover:text-foreground transition-colors",
              index === allTeams.length - 1
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            )}
          >
            {team.name}
          </button>
        </div>
      ))}
    </nav>
  );
}

/**
 * TeamLevelBadge - Shows team level with appropriate styling
 */
export function TeamLevelBadge({
  level,
  className,
}: {
  level: number;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("text-xs", getTeamLevelColor(level), className)}
    >
      {getTeamLevelLabel(level)}
    </Badge>
  );
}
