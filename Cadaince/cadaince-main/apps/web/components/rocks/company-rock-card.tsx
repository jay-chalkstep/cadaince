"use client";

import {
  Target,
  Users,
  Building2,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

interface Analytics {
  pillar_rock_count: number;
  pillar_rocks_on_track: number;
  pillar_rocks_off_track: number;
  pillar_rocks_at_risk: number;
  pillar_rocks_complete: number;
  individual_rock_count: number;
  individual_rocks_on_track: number;
  individual_rocks_off_track: number;
  individual_rocks_at_risk: number;
  individual_rocks_complete: number;
  team_members_with_rocks: number;
  team_coverage_percentage: number;
  pillars_involved: number;
  overall_on_track_percentage: number;
}

interface PillarRock {
  id: string;
  title: string;
  status: string;
  pillar: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  individual_rocks: Array<{
    id: string;
    title: string;
    status: string;
    owner: {
      id: string;
      full_name: string;
      avatar_url: string | null;
    } | null;
  }>;
}

interface CompanyRock {
  id: string;
  title: string;
  description: string | null;
  status: "on_track" | "off_track" | "at_risk" | "complete";
  due_date: string;
  owner: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    title?: string | null;
  } | null;
  quarter: {
    id: string;
    year: number;
    quarter: number;
  } | null;
  analytics: Analytics;
  pillar_rocks?: PillarRock[];
}

interface CompanyRockCardProps {
  rock: CompanyRock;
  onClick?: () => void;
  showDetails?: boolean;
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

export function CompanyRockCard({ rock, onClick, showDetails = false }: CompanyRockCardProps) {
  const status = statusConfig[rock.status];
  const StatusIcon = status.icon;
  const analytics = rock.analytics;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card
      className={cn(
        "transition-all",
        onClick && "cursor-pointer hover:shadow-md"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-indigo-600" />
            <div>
              <CardTitle className="text-lg">{rock.title}</CardTitle>
              {rock.description && (
                <CardDescription className="line-clamp-1">{rock.description}</CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className={cn("text-xs", status.bgColor, status.textColor)}
              variant="secondary"
            >
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
            {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Owner and due date */}
        <div className="flex items-center justify-between text-sm">
          {rock.owner && (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={rock.owner.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(rock.owner.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground">{rock.owner.full_name}</span>
            </div>
          )}
          <div className="text-muted-foreground">
            Due: {formatDate(rock.due_date)}
          </div>
        </div>

        {/* Team coverage progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Users className="h-4 w-4" />
              Team Coverage
            </span>
            <span className="font-medium">{analytics.team_coverage_percentage}%</span>
          </div>
          <Progress value={analytics.team_coverage_percentage} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {analytics.team_members_with_rocks} team member{analytics.team_members_with_rocks !== 1 ? "s" : ""} supporting this rock
          </p>
        </div>

        {/* Cascade breakdown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>Pillar Rocks</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{analytics.pillar_rock_count}</span>
              <div className="flex gap-1">
                {analytics.pillar_rocks_on_track > 0 && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                    {analytics.pillar_rocks_on_track} on track
                  </Badge>
                )}
                {analytics.pillar_rocks_off_track > 0 && (
                  <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs">
                    {analytics.pillar_rocks_off_track} off
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Individual Rocks</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{analytics.individual_rock_count}</span>
              <div className="flex gap-1">
                {analytics.individual_rocks_on_track > 0 && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                    {analytics.individual_rocks_on_track}
                  </Badge>
                )}
                {analytics.individual_rocks_off_track > 0 && (
                  <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs">
                    {analytics.individual_rocks_off_track}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Overall health bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Health</span>
            <span className="font-medium">{analytics.overall_on_track_percentage}%</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-muted">
            <div
              className="bg-green-500 transition-all"
              style={{
                width: `${(analytics.pillar_rocks_on_track + analytics.individual_rocks_on_track) /
                  Math.max(analytics.pillar_rock_count + analytics.individual_rock_count, 1) *
                  100}%`,
              }}
            />
            <div
              className="bg-green-300 transition-all"
              style={{
                width: `${(analytics.pillar_rocks_complete + analytics.individual_rocks_complete) /
                  Math.max(analytics.pillar_rock_count + analytics.individual_rock_count, 1) *
                  100}%`,
              }}
            />
            <div
              className="bg-yellow-500 transition-all"
              style={{
                width: `${(analytics.pillar_rocks_at_risk + analytics.individual_rocks_at_risk) /
                  Math.max(analytics.pillar_rock_count + analytics.individual_rock_count, 1) *
                  100}%`,
              }}
            />
            <div
              className="bg-red-500 transition-all"
              style={{
                width: `${(analytics.pillar_rocks_off_track + analytics.individual_rocks_off_track) /
                  Math.max(analytics.pillar_rock_count + analytics.individual_rock_count, 1) *
                  100}%`,
              }}
            />
          </div>
        </div>

        {/* Pillar tags */}
        {analytics.pillars_involved > 0 && (
          <div className="flex flex-wrap gap-1">
            {rock.pillar_rocks?.slice(0, 4).map((pr) => (
              <Badge
                key={pr.id}
                variant="outline"
                className="text-xs"
                style={{
                  borderColor: pr.pillar?.color || undefined,
                  color: pr.pillar?.color || undefined,
                }}
              >
                {pr.pillar?.name || "Unknown"}
              </Badge>
            ))}
            {analytics.pillars_involved > 4 && (
              <Badge variant="outline" className="text-xs">
                +{analytics.pillars_involved - 4} more
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CompanyRockCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 bg-muted rounded animate-pulse" />
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-muted rounded-full animate-pulse" />
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-4 w-16 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full bg-muted rounded animate-pulse" />
          <div className="h-2 w-full bg-muted rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-16 bg-muted rounded animate-pulse" />
          <div className="h-16 bg-muted rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}
