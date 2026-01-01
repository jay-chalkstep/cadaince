"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users2,
  CircleDot,
  BarChart3,
  MessageSquare,
  CheckSquare,
  Target,
  Video,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  useTeamContext,
  getTeamLevelLabel,
  getTeamLevelColor,
} from "@/components/team/team-context-provider";
import { TeamBreadcrumb } from "@/components/team/team-switcher";

interface TeamMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
  title: string | null;
  is_lead: boolean;
}

interface TeamStats {
  rocks_count: number;
  rocks_on_track: number;
  metrics_count: number;
  metrics_on_track: number;
  issues_open: number;
  todos_open: number;
  goals_count: number;
}

export default function TeamDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { currentTeam, teamsLoading, getChildTeams } = useTeamContext();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch team data
  useEffect(() => {
    if (!currentTeam) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch members
        const membersRes = await fetch(`/api/teams/${currentTeam.id}/members`);
        if (membersRes.ok) {
          const data = await membersRes.json();
          setMembers(data.members || []);
        }

        // TODO: Fetch stats from a team stats endpoint
        // For now, use placeholder stats
        setStats({
          rocks_count: 5,
          rocks_on_track: 4,
          metrics_count: 8,
          metrics_on_track: 6,
          issues_open: 3,
          todos_open: 12,
          goals_count: 15,
        });
      } catch (error) {
        console.error("Failed to fetch team data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentTeam]);

  const childTeams = currentTeam ? getChildTeams(currentTeam.id) : [];

  if (teamsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentTeam) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Users2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-medium">Team not found</h2>
        <p className="text-muted-foreground mt-1">
          The team &quot;{slug}&quot; doesn&apos;t exist or you don&apos;t have
          access.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/teams")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Teams
        </Button>
      </div>
    );
  }

  const quickLinks = [
    {
      title: "Rocks",
      href: `/teams/${slug}/rocks`,
      icon: CircleDot,
      stat: stats ? `${stats.rocks_on_track}/${stats.rocks_count} on track` : null,
    },
    {
      title: "Scorecard",
      href: `/teams/${slug}/scorecard`,
      icon: BarChart3,
      stat: stats ? `${stats.metrics_on_track}/${stats.metrics_count} on track` : null,
    },
    {
      title: "Issues",
      href: `/teams/${slug}/issues`,
      icon: MessageSquare,
      stat: stats ? `${stats.issues_open} open` : null,
    },
    {
      title: "To-Dos",
      href: `/teams/${slug}/todos`,
      icon: CheckSquare,
      stat: stats ? `${stats.todos_open} open` : null,
    },
    {
      title: "Goals",
      href: `/teams/${slug}/goals`,
      icon: Target,
      stat: stats ? `${stats.goals_count} total` : null,
    },
    {
      title: "L10 Meeting",
      href: `/teams/${slug}/l10`,
      icon: Video,
      stat: currentTeam.l10_required ? "Required" : "Optional",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <TeamBreadcrumb />
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{currentTeam.name}</h1>
          <Badge
            variant="secondary"
            className={cn(getTeamLevelColor(currentTeam.level))}
          >
            {getTeamLevelLabel(currentTeam.level)}
          </Badge>
          {currentTeam.is_elt && (
            <Badge variant="outline">ELT</Badge>
          )}
        </div>
      </div>

      {/* Quick Links Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <link.icon className="h-6 w-6 text-muted-foreground" />
                <div>
                  <div className="font-medium text-sm">{link.title}</div>
                  {link.stat && (
                    <div className="text-xs text-muted-foreground">{link.stat}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users2 className="h-5 w-5" />
              Team Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No members assigned to this team
              </p>
            ) : (
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {member.full_name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {member.full_name}
                      </div>
                      {member.title && (
                        <div className="text-xs text-muted-foreground truncate">
                          {member.title}
                        </div>
                      )}
                    </div>
                    {member.is_lead && (
                      <Badge variant="secondary" className="text-[10px]">
                        Lead
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Child Teams */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users2 className="h-5 w-5" />
              Child Teams
            </CardTitle>
          </CardHeader>
          <CardContent>
            {childTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No child teams
              </p>
            ) : (
              <div className="space-y-2">
                {childTeams.map((child) => (
                  <Link
                    key={child.id}
                    href={`/teams/${child.slug}`}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <Users2 className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 font-medium text-sm">
                      {child.name}
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px]", getTeamLevelColor(child.level))}
                    >
                      {getTeamLevelLabel(child.level)}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
