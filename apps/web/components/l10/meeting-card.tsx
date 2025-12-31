"use client";

import Link from "next/link";
import { Calendar, Clock, Play, Users, Star, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Meeting {
  id: string;
  title: string;
  meeting_type: string;
  scheduled_at: string;
  started_at: string | null;
  ended_at: string | null;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  rating: number | null;
  duration_minutes: number | null;
  created_by_profile?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface MeetingCardProps {
  meeting: Meeting;
  variant?: "default" | "upcoming" | "compact";
  onStart?: () => void;
}

export function MeetingCard({ meeting, variant = "default", onStart }: MeetingCardProps) {
  const getStatusBadge = () => {
    switch (meeting.status) {
      case "scheduled":
        return <Badge variant="outline">Scheduled</Badge>;
      case "in_progress":
        return <Badge className="bg-green-600">In Progress</Badge>;
      case "completed":
        return <Badge variant="secondary">Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
    }
  };

  const getTimeUntil = () => {
    const now = new Date();
    const scheduled = new Date(meeting.scheduled_at);
    const diff = scheduled.getTime() - now.getTime();

    if (diff < 0) return "Past due";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? "s" : ""} away`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes} minutes`;
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

  if (variant === "upcoming") {
    return (
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardDescription className="text-primary">Next Meeting</CardDescription>
              <CardTitle className="text-xl">{meeting.title}</CardTitle>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{formatDate(meeting.scheduled_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formatTime(meeting.scheduled_at)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-primary">{getTimeUntil()}</div>
            <div className="flex gap-2">
              {meeting.status === "scheduled" && (
                <>
                  <Button variant="outline" asChild>
                    <Link href={`/l10/${meeting.id}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      Preview Meeting
                    </Link>
                  </Button>
                  <Button onClick={onStart}>
                    <Play className="mr-2 h-4 w-4" />
                    Start Meeting
                  </Button>
                </>
              )}
              {meeting.status === "in_progress" && (
                <Button asChild>
                  <Link href={`/l10/${meeting.id}/live`}>
                    <Play className="mr-2 h-4 w-4" />
                    Continue Meeting
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === "compact") {
    return (
      <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
          <div>
            <div className="font-medium">{meeting.title}</div>
            <div className="text-sm text-muted-foreground">
              {formatDate(meeting.scheduled_at)} at {formatTime(meeting.scheduled_at)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {meeting.rating && (
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 text-yellow-500" />
              <span>{meeting.rating}/10</span>
            </div>
          )}
          {getStatusBadge()}
        </div>
      </div>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <Link href={`/l10/${meeting.id}`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{meeting.title}</CardTitle>
              <CardDescription className="capitalize">{meeting.meeting_type} Meeting</CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(meeting.scheduled_at)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{formatTime(meeting.scheduled_at)}</span>
              </div>
              {meeting.duration_minutes && (
                <span>{meeting.duration_minutes} min</span>
              )}
            </div>
            {meeting.rating && (
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">{meeting.rating}/10</span>
              </div>
            )}
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}

export function MeetingCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-5 w-40 bg-muted rounded animate-pulse" />
            <div className="h-4 w-28 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-5 w-20 bg-muted rounded animate-pulse" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          <div className="h-4 w-16 bg-muted rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}
