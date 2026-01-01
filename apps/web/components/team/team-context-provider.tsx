"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { usePathname } from "next/navigation";

/**
 * Team data structure from the API
 */
export interface Team {
  id: string;
  name: string;
  slug: string;
  level: number;
  is_elt: boolean;
  l10_required: boolean;
  parent_team_id: string | null;
  anchor_seat_id: string;
  settings: Record<string, unknown>;
  created_at: string;
  anchor_seat?: {
    id: string;
    name: string;
    eos_role: string | null;
    pillar?: {
      id: string;
      name: string;
      color: string;
    } | null;
  };
  parent_team?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  children?: Team[];
}

/**
 * Team hierarchy with flat and tree views
 */
export interface TeamHierarchy {
  teams: Team[];
  flat: Team[];
}

/**
 * Team context value
 */
interface TeamContextValue {
  // Current team (from URL or selection)
  currentTeam: Team | null;
  setCurrentTeam: (team: Team | null) => void;

  // All teams in the organization
  teams: Team[];
  teamsLoading: boolean;
  teamsError: string | null;

  // Hierarchy helpers
  getTeamById: (id: string) => Team | undefined;
  getTeamBySlug: (slug: string) => Team | undefined;
  getTeamAncestors: (teamId: string) => Team[];
  getTeamDescendants: (teamId: string) => Team[];
  getChildTeams: (teamId: string) => Team[];
  getRootTeams: () => Team[];

  // Refresh teams data
  refreshTeams: () => Promise<void>;

  // Team membership
  isTeamMember: boolean;
  isTeamLead: boolean;

  // Computed properties
  eltTeam: Team | null;
  teamHierarchy: Team[]; // Ancestors of current team
}

const TeamContext = createContext<TeamContextValue | undefined>(undefined);

interface TeamContextProviderProps {
  children: ReactNode;
}

/**
 * TeamContextProvider - Provides team context throughout the app
 *
 * Features:
 * - Fetches and caches all org teams
 * - Syncs current team from URL (/teams/[slug])
 * - Provides hierarchy navigation helpers
 * - Tracks team membership and lead status
 */
export function TeamContextProvider({ children }: TeamContextProviderProps) {
  const pathname = usePathname();

  // State
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [isTeamLead, setIsTeamLead] = useState(false);

  // Fetch all teams
  const fetchTeams = useCallback(async () => {
    try {
      setTeamsLoading(true);
      setTeamsError(null);

      const res = await fetch("/api/teams?hierarchy=true");
      if (!res.ok) {
        throw new Error("Failed to fetch teams");
      }

      const data: TeamHierarchy = await res.json();
      setTeams(data.flat || []);
    } catch (err) {
      console.error("Error fetching teams:", err);
      setTeamsError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setTeamsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Sync current team from URL
  useEffect(() => {
    if (teams.length === 0) return;

    // Check if we're on a team page: /teams/[slug]
    const teamMatch = pathname.match(/^\/teams\/([^/]+)/);
    if (teamMatch) {
      const slug = teamMatch[1];
      const team = teams.find((t) => t.slug === slug);
      if (team && team.id !== currentTeam?.id) {
        setCurrentTeam(team);
      }
    }
  }, [pathname, teams, currentTeam?.id]);

  // Fetch membership status when current team changes
  useEffect(() => {
    if (!currentTeam) {
      setIsTeamMember(false);
      setIsTeamLead(false);
      return;
    }

    const fetchMembership = async () => {
      try {
        const res = await fetch(`/api/teams/${currentTeam.id}/members`);
        if (res.ok) {
          const data = await res.json();
          // Check if current user is in the members list
          // This assumes the API returns the current user's membership status
          setIsTeamMember(data.members?.length > 0);
          setIsTeamLead(data.members?.some((m: { is_lead: boolean }) => m.is_lead) || false);
        }
      } catch {
        // Ignore errors - default to false
      }
    };

    fetchMembership();
  }, [currentTeam]);

  // Helper functions
  const getTeamById = useCallback(
    (id: string) => teams.find((t) => t.id === id),
    [teams]
  );

  const getTeamBySlug = useCallback(
    (slug: string) => teams.find((t) => t.slug === slug),
    [teams]
  );

  const getTeamAncestors = useCallback(
    (teamId: string): Team[] => {
      const ancestors: Team[] = [];
      let current = teams.find((t) => t.id === teamId);

      while (current?.parent_team_id) {
        const parent = teams.find((t) => t.id === current!.parent_team_id);
        if (parent) {
          ancestors.unshift(parent);
          current = parent;
        } else {
          break;
        }
      }

      return ancestors;
    },
    [teams]
  );

  const getTeamDescendants = useCallback(
    (teamId: string): Team[] => {
      const descendants: Team[] = [];
      const queue = teams.filter((t) => t.parent_team_id === teamId);

      while (queue.length > 0) {
        const team = queue.shift()!;
        descendants.push(team);
        const children = teams.filter((t) => t.parent_team_id === team.id);
        queue.push(...children);
      }

      return descendants;
    },
    [teams]
  );

  const getChildTeams = useCallback(
    (teamId: string) => teams.filter((t) => t.parent_team_id === teamId),
    [teams]
  );

  const getRootTeams = useCallback(
    () => teams.filter((t) => !t.parent_team_id),
    [teams]
  );

  // Computed values
  const eltTeam = teams.find((t) => t.is_elt) || null;

  const teamHierarchy = currentTeam ? getTeamAncestors(currentTeam.id) : [];

  const value: TeamContextValue = {
    currentTeam,
    setCurrentTeam,
    teams,
    teamsLoading,
    teamsError,
    getTeamById,
    getTeamBySlug,
    getTeamAncestors,
    getTeamDescendants,
    getChildTeams,
    getRootTeams,
    refreshTeams: fetchTeams,
    isTeamMember,
    isTeamLead,
    eltTeam,
    teamHierarchy,
  };

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

/**
 * Hook to access team context
 */
export function useTeamContext() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error("useTeamContext must be used within a TeamContextProvider");
  }
  return context;
}

/**
 * Hook to get the current team (throws if not in team context)
 */
export function useCurrentTeam() {
  const { currentTeam } = useTeamContext();
  return currentTeam;
}

/**
 * Hook to get all teams
 */
export function useTeams() {
  const { teams, teamsLoading, teamsError, refreshTeams } = useTeamContext();
  return { teams, loading: teamsLoading, error: teamsError, refresh: refreshTeams };
}

/**
 * Get level label for display
 */
export function getTeamLevelLabel(level: number): string {
  switch (level) {
    case 1:
      return "ELT";
    case 2:
      return "Pillar";
    case 3:
      return "Department";
    case 4:
      return "Team";
    default:
      return "Team";
  }
}

/**
 * Get level color for badges
 */
export function getTeamLevelColor(level: number): string {
  switch (level) {
    case 1:
      return "bg-purple-100 text-purple-800";
    case 2:
      return "bg-blue-100 text-blue-800";
    case 3:
      return "bg-green-100 text-green-800";
    case 4:
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
