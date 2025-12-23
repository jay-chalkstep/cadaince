"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  Calendar,
  Clock,
  Users,
  Target,
  AlertCircle,
  ChevronRight,
  Play,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  title: string | null;
}

interface Rock {
  id: string;
  title: string;
  status: "on_track" | "off_track" | "at_risk" | "complete";
  owner: Profile | null;
}

interface Issue {
  id: string;
  title: string;
  priority: string;
}

interface Meeting {
  id: string;
  title: string;
  scheduled_at: string;
  status: string;
}

interface PillarData {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  lead: Profile | null;
  members: Profile[];
  rocks: Rock[];
  issues: Issue[];
  upcomingMeeting: Meeting | null;
  recentMeetings: Meeting[];
}

interface PillarL10CardProps {
  pillarId: string;
  compact?: boolean;
  onStartMeeting?: (meetingId: string) => void;
}

export function PillarL10Card({
  pillarId,
  compact = false,
  onStartMeeting,
}: PillarL10CardProps) {
  const [data, setData] = useState<PillarData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPillarData();
  }, [pillarId]);

  const fetchPillarData = async () => {
    setLoading(true);
    try {
      // Fetch pillar details
      const [pillarRes, rocksRes, issuesRes] = await Promise.all([
        fetch(`/api/pillars/${pillarId}`),
        fetch(`/api/rocks?pillar_id=${pillarId}&level=pillar`),
        fetch(`/api/issues?pillar_id=${pillarId}`),
      ]);

      if (!pillarRes.ok) {
        throw new Error("Failed to fetch pillar");
      }

      const pillar = await pillarRes.json();
      const rocks = rocksRes.ok ? await rocksRes.json() : [];
      const issues = issuesRes.ok ? await issuesRes.json() : [];

      setData({
        ...pillar,
        rocks: rocks.slice(0, 5),
        issues: issues.slice(0, 5),
        upcomingMeeting: null, // Will be populated when pillar meetings are implemented
        recentMeetings: [],
      });
    } catch (error) {
      console.error("Failed to fetch pillar data:", error);
    } finally {
      setLoading(false);
    }
  };

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
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusColor = (status: Rock["status"]) => {
    switch (status) {
      case "on_track":
        return "bg-green-500";
      case "off_track":
        return "bg-red-500";
      case "at_risk":
        return "bg-yellow-500";
      case "complete":
        return "bg-gray-400";
    }
  };

  if (loading) {
    return <PillarL10CardSkeleton compact={compact} />;
  }

  if (!data) {
    return null;
  }

  const rocksOnTrack = data.rocks.filter(
    (r) => r.status === "on_track" || r.status === "complete"
  ).length;
  const rocksTotal = data.rocks.length;
  const healthPercentage = rocksTotal > 0 ? (rocksOnTrack / rocksTotal) * 100 : 100;

  if (compact) {
    return (
      <Card className="hover:shadow-md transition-all">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: data.color || "#6366F1" }}
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{data.name}</h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>{data.members?.length || 0} members</span>
                <span>•</span>
                <span>{data.rocks.length} rocks</span>
                {data.issues.length > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-yellow-600">{data.issues.length} issues</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={healthPercentage} className="w-16 h-2" />
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: data.color || "#6366F1" }}
            />
            <div>
              <CardTitle className="text-lg">{data.name}</CardTitle>
              <CardDescription>
                {data.lead ? `Led by ${data.lead.full_name}` : "No lead assigned"}
              </CardDescription>
            </div>
          </div>
          {data.upcomingMeeting ? (
            <Button size="sm" onClick={() => onStartMeeting?.(data.upcomingMeeting!.id)}>
              <Play className="h-4 w-4 mr-1" />
              Start L10
            </Button>
          ) : (
            <Link href={`/meetings/pillar/${pillarId}`}>
              <Button variant="outline" size="sm">
                Schedule
              </Button>
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Team Members */}
        {data.members && data.members.length > 0 && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div className="flex -space-x-2">
              {data.members.slice(0, 5).map((member) => (
                <Avatar key={member.id} className="h-7 w-7 border-2 border-background">
                  <AvatarImage src={member.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(member.full_name)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {data.members.length > 5 && (
                <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                  +{data.members.length - 5}
                </div>
              )}
            </div>
            <span className="text-sm text-muted-foreground ml-1">
              {data.members.length} members
            </span>
          </div>
        )}

        {/* Rocks Summary */}
        {data.rocks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span>Pillar Rocks</span>
              </div>
              <span className="text-muted-foreground">
                {rocksOnTrack}/{rocksTotal} on track
              </span>
            </div>
            <div className="flex gap-1">
              {data.rocks.map((rock) => (
                <div
                  key={rock.id}
                  className={`h-2 flex-1 rounded-full ${getStatusColor(rock.status)}`}
                  title={rock.title}
                />
              ))}
            </div>
          </div>
        )}

        {/* Open Issues */}
        {data.issues.length > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span>{data.issues.length} open issues</span>
            </div>
            <Link href={`/issues?pillar=${pillarId}`}>
              <Button variant="ghost" size="sm" className="h-6 text-xs">
                View
              </Button>
            </Link>
          </div>
        )}

        {/* Next Meeting */}
        {data.upcomingMeeting && (
          <div className="flex items-center gap-2 text-sm pt-2 border-t">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Next: {formatDate(data.upcomingMeeting.scheduled_at)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PillarL10CardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-3 h-3 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32 mt-1" />
            </div>
            <Skeleton className="w-16 h-2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-4 h-4 rounded-full" />
            <div>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24 mt-1" />
            </div>
          </div>
          <Skeleton className="h-9 w-20" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <div className="flex -space-x-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-7 w-7 rounded-full" />
            ))}
          </div>
        </div>
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-4 w-32" />
      </CardContent>
    </Card>
  );
}
