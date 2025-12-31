"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Play,
  Star,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import {
  MeetingPreviewCard,
  QueuedIssuesList,
  OffTrackRocksList,
  BelowGoalMetricsList,
  CarryoverTodosList,
  AddIssueDialog,
} from "@/components/l10/preview";

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
  notes: string | null;
  headlines: Array<{ id: string; text: string; author_name: string }>;
  scorecard_snapshot: Array<{
    id: string;
    name: string;
    current_value: number | null;
    goal: number | null;
    unit: string | null;
  }>;
  rocks_snapshot: Array<{
    id: string;
    title: string;
    status: string;
    owner: { full_name: string };
  }>;
  agenda_items: Array<{
    id: string;
    section: string;
    duration_minutes: number;
    started_at: string | null;
    completed_at: string | null;
  }>;
  attendees: Array<{
    id: string;
    attended: boolean;
    profile: {
      id: string;
      full_name: string;
      avatar_url: string | null;
      role: string;
    };
  }>;
  issues_discussed: Array<{
    id: string;
    outcome: string;
    decision_notes: string | null;
    issue: { title: string };
  }>;
  todos_reviewed: Array<{
    id: string;
    status_at_review: string;
    todo: { title: string };
  }>;
  created_by_profile?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface PreviewData {
  queuedIssues: Array<{
    id: string;
    title: string;
    description: string | null;
    priority: number | null;
    queue_order: number | null;
    created_at: string;
    raised_by_profile: {
      id: string;
      full_name: string;
      avatar_url: string | null;
    } | null;
  }>;
  offTrackRocks: Array<{
    id: string;
    title: string;
    status: string;
    due_date: string;
    owner: {
      id: string;
      full_name: string;
      avatar_url: string | null;
    } | null;
  }>;
  belowGoalMetrics: Array<{
    id: string;
    name: string;
    goal: number;
    unit: string | null;
    current_value: number | null;
    threshold_red: number | null;
    threshold_yellow: number | null;
    owner: {
      id: string;
      full_name: string;
      avatar_url: string | null;
    } | null;
  }>;
  carryoverTodos: Array<{
    id: string;
    title: string;
    due_date: string;
    owner: {
      id: string;
      full_name: string;
      avatar_url: string | null;
    } | null;
  }>;
}

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [addIssueDialogOpen, setAddIssueDialogOpen] = useState(false);

  useEffect(() => {
    fetchMeeting();
  }, [meetingId]);

  useEffect(() => {
    if (meeting?.status === "scheduled") {
      fetchPreview();
    }
  }, [meeting?.status, meetingId]);

  const fetchMeeting = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/l10/${meetingId}`);
      if (response.ok) {
        const data = await response.json();
        setMeeting(data);
      }
    } catch (error) {
      console.error("Failed to fetch meeting:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const response = await fetch(`/api/l10/${meetingId}/preview`);
      if (response.ok) {
        const data = await response.json();
        setPreviewData(data);
      }
    } catch (error) {
      console.error("Failed to fetch preview:", error);
    } finally {
      setLoadingPreview(false);
    }
  }, [meetingId]);

  const handleRemoveFromQueue = async (issueId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/l10/${meetingId}/queue/${issueId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        await fetchPreview();
      }
    } catch (error) {
      console.error("Failed to remove issue from queue:", error);
    }
  };

  const handleIssueAdded = () => {
    fetchPreview();
  };

  const handleStartMeeting = async () => {
    setStarting(true);
    try {
      const response = await fetch(`/api/l10/${meetingId}/start`, {
        method: "POST",
      });
      if (response.ok) {
        router.push(`/l10/${meetingId}/live`);
      }
    } catch (error) {
      console.error("Failed to start meeting:", error);
    } finally {
      setStarting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
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

  const getStatusBadge = (status: Meeting["status"]) => {
    switch (status) {
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-48 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/l10">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to L10
          </Link>
        </Button>
        <div className="rounded-lg border p-6 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-medium">Meeting not found</h2>
        </div>
      </div>
    );
  }

  const todosDone = meeting.todos_reviewed.filter((t) => t.status_at_review === "done").length;
  const todosTotal = meeting.todos_reviewed.length;
  const issuesSolved = meeting.issues_discussed.filter(
    (i) => i.outcome === "solved" || i.outcome === "todo_created"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/l10">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{meeting.title}</h1>
            {getStatusBadge(meeting.status)}
          </div>
          <p className="text-sm text-muted-foreground capitalize">
            {meeting.meeting_type} Meeting
          </p>
        </div>
        {meeting.status === "scheduled" && (
          <Button onClick={handleStartMeeting} disabled={starting}>
            {starting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Start Meeting
          </Button>
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

      {/* Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <span>{formatDate(meeting.scheduled_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span>{formatTime(meeting.scheduled_at)}</span>
            </div>
            {meeting.duration_minutes && (
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span>{meeting.duration_minutes} minutes</span>
              </div>
            )}
            {meeting.rating && (
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                <span className="font-medium">{meeting.rating}/10</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview for scheduled meetings */}
      {meeting.status === "scheduled" && previewData && (
        <>
          <MeetingPreviewCard
            queuedIssuesCount={previewData.queuedIssues.length}
            offTrackRocksCount={previewData.offTrackRocks.length}
            belowGoalMetricsCount={previewData.belowGoalMetrics.length}
            carryoverTodosCount={previewData.carryoverTodos.length}
            onAddIssue={() => setAddIssueDialogOpen(true)}
          />

          {previewData.queuedIssues.length > 0 && (
            <QueuedIssuesList
              issues={previewData.queuedIssues}
              meetingId={meetingId}
            />
          )}

          {previewData.offTrackRocks.length > 0 && (
            <OffTrackRocksList rocks={previewData.offTrackRocks} />
          )}

          {previewData.belowGoalMetrics.length > 0 && (
            <BelowGoalMetricsList metrics={previewData.belowGoalMetrics} />
          )}

          {previewData.carryoverTodos.length > 0 && (
            <CarryoverTodosList todos={previewData.carryoverTodos} />
          )}

          <AddIssueDialog
            open={addIssueDialogOpen}
            onOpenChange={setAddIssueDialogOpen}
            meetingId={meetingId}
            onIssueAdded={handleIssueAdded}
          />
        </>
      )}

      {/* Stats for completed meetings */}
      {meeting.status === "completed" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {todosDone}/{todosTotal}
              </div>
              <p className="text-sm text-muted-foreground">To-Dos Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{issuesSolved}</div>
              <p className="text-sm text-muted-foreground">Issues Resolved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{meeting.headlines?.length || 0}</div>
              <p className="text-sm text-muted-foreground">Headlines Shared</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Attendees */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendees</CardTitle>
          </CardHeader>
          <CardContent>
            {meeting.attendees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendees assigned</p>
            ) : (
              <div className="space-y-2">
                {meeting.attendees.map((attendee) => (
                  <div key={attendee.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={attendee.profile.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(attendee.profile.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{attendee.profile.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {attendee.profile.role}
                      </div>
                    </div>
                    {meeting.status === "completed" && (
                      attendee.attended ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Headlines */}
        {meeting.headlines && meeting.headlines.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Headlines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {meeting.headlines.map((headline) => (
                  <div key={headline.id} className="rounded-lg bg-muted p-3">
                    <p className="text-sm">{headline.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      — {headline.author_name}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Issues Discussed */}
        {meeting.issues_discussed.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Issues Discussed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {meeting.issues_discussed.map((discussion) => (
                  <div key={discussion.id} className="flex items-start justify-between rounded-lg border p-3">
                    <div>
                      <div className="font-medium">{discussion.issue.title}</div>
                      {discussion.decision_notes && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {discussion.decision_notes}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {discussion.outcome.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {meeting.notes && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Meeting Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground">
                <ReactMarkdown>{meeting.notes}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
