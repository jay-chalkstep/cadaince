"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Calendar,
  Target,
  Building2,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  Clock,
  RefreshCw,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  title: string | null;
}

interface Pillar {
  id: string;
  name: string;
  slug: string;
  color: string | null;
}

interface Meeting {
  id: string;
  title: string;
  meeting_type: string;
  scheduled_at: string;
  status: string;
}

interface OneOnOneMeeting {
  id: string;
  title: string;
  meeting_day: string | null;
  meeting_time: string | null;
  manager: Profile;
  direct: Profile;
}

interface Quarter {
  id: string;
  year: number;
  quarter: number;
  planning_status: string;
  is_current?: boolean;
}

interface MeetingHubData {
  pillars: Pillar[];
  upcomingL10: Meeting | null;
  recentL10s: Meeting[];
  oneOnOnes: OneOnOneMeeting[];
  currentQuarter: Quarter | null;
  currentUser: Profile | null;
}

interface MeetingHubProps {
  onNavigate?: (path: string) => void;
}

export function MeetingHub({ onNavigate }: MeetingHubProps) {
  const [data, setData] = useState<MeetingHubData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pillarsRes, l10Res, oneOnOnesRes, quartersRes, userRes] = await Promise.all([
        fetch("/api/pillars"),
        fetch("/api/l10?upcoming=true&limit=5"),
        fetch("/api/one-on-ones"),
        fetch("/api/quarters"),
        fetch("/api/users/me"),
      ]);

      const pillars = pillarsRes.ok ? await pillarsRes.json() : [];
      const l10Meetings = l10Res.ok ? await l10Res.json() : [];
      const oneOnOnes = oneOnOnesRes.ok ? await oneOnOnesRes.json() : [];
      const quarters = quartersRes.ok ? await quartersRes.json() : [];
      const currentUser = userRes.ok ? await userRes.json() : null;

      const currentQuarter = quarters.find((q: Quarter) => q.is_current) || null;

      setData({
        pillars,
        upcomingL10: l10Meetings[0] || null,
        recentL10s: l10Meetings.slice(1),
        oneOnOnes,
        currentQuarter,
        currentUser,
      });
    } catch (error) {
      console.error("Failed to fetch meeting hub data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return <MeetingHubSkeleton />;
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Failed to load meeting data. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Meeting Type Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Leadership L10 */}
        <Link href="/l10">
          <Card className="cursor-pointer hover:shadow-md transition-all hover:border-indigo-300">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-full bg-indigo-100">
                  <Target className="h-6 w-6 text-indigo-600" />
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mt-4">Leadership L10</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Executive team weekly meeting
              </p>
              {data.upcomingL10 && (
                <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Next: {formatDate(data.upcomingL10.scheduled_at)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* 1:1s */}
        <Link href="/one-on-ones">
          <Card className="cursor-pointer hover:shadow-md transition-all hover:border-green-300">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-full bg-green-100">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mt-4">1:1 Meetings</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Manager-direct conversations
              </p>
              <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{data.oneOnOnes.length} active 1:1s</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Quarterly Planning */}
        <Link href="/meetings/quarterly">
          <Card className="cursor-pointer hover:shadow-md transition-all hover:border-purple-300">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-full bg-purple-100">
                  <CalendarDays className="h-6 w-6 text-purple-600" />
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mt-4">Quarterly Planning</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Set rocks and priorities
              </p>
              {data.currentQuarter && (
                <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  <span>
                    Q{data.currentQuarter.quarter} {data.currentQuarter.year}
                  </span>
                  <Badge variant="outline" className="ml-1 text-xs">
                    {data.currentQuarter.planning_status}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Annual Planning */}
        <Link href="/meetings/annual">
          <Card className="cursor-pointer hover:shadow-md transition-all hover:border-orange-300">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-full bg-orange-100">
                  <CalendarRange className="h-6 w-6 text-orange-600" />
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mt-4">Annual Planning</h3>
              <p className="text-sm text-muted-foreground mt-1">
                V/TO and strategic vision
              </p>
              <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                <CalendarRange className="h-3 w-3" />
                <span>Strategic planning</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Pillar L10s */}
      {data.pillars.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Pillar L10s
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.pillars.map((pillar) => (
              <Link key={pillar.id} href={`/meetings/pillar/${pillar.id}`}>
                <Card className="cursor-pointer hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: pillar.color || "#6366F1" }}
                      />
                      <div className="flex-1">
                        <h3 className="font-medium">{pillar.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          Weekly pillar meeting
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Access - My 1:1s */}
      {data.oneOnOnes.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              My 1:1s
            </h2>
            <Link href="/one-on-ones">
              <Button variant="ghost" size="sm">
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.oneOnOnes.slice(0, 6).map((meeting) => {
              const isManager = data.currentUser?.id === meeting.manager.id;
              const otherPerson = isManager ? meeting.direct : meeting.manager;

              return (
                <Link key={meeting.id} href="/one-on-ones">
                  <Card className="cursor-pointer hover:shadow-md transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={otherPerson.avatar_url || undefined} />
                          <AvatarFallback
                            className={cn(
                              isManager
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-green-100 text-green-700"
                            )}
                          >
                            {getInitials(otherPerson.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">
                            {otherPerson.full_name}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {isManager ? "Direct report" : "Manager"}
                          </p>
                        </div>
                        {meeting.meeting_day && (
                          <Badge variant="outline" className="text-xs">
                            {meeting.meeting_day.slice(0, 3)}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming L10 */}
      {data.upcomingL10 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming L10
            </h2>
            <Link href="/l10">
              <Button variant="ghost" size="sm">
                All Meetings
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{data.upcomingL10.title}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(data.upcomingL10.scheduled_at)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{formatTime(data.upcomingL10.scheduled_at)}</span>
                    </div>
                  </div>
                </div>
                <Link href={`/l10/${data.upcomingL10.id}`}>
                  <Button>
                    View Meeting
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export function MeetingHubSkeleton() {
  return (
    <div className="space-y-8">
      {/* Meeting Type Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-5 w-32 mt-4" />
              <Skeleton className="h-4 w-40 mt-2" />
              <Skeleton className="h-3 w-24 mt-3" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pillar L10s */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32 mt-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
