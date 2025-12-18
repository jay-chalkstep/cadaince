"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, MessageSquare, Plus, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AgendaSidebar } from "@/components/l10/agenda-sidebar";
import { MeetingControls } from "@/components/l10/meeting-controls";
import { ScorecardReview } from "@/components/l10/scorecard-review";
import { RockReview } from "@/components/l10/rock-review";
import { TodoReview } from "@/components/l10/todo-review";
import { HeadlineCapture } from "@/components/l10/headline-capture";
import { IDSWorkflow } from "@/components/l10/ids-workflow";
import { MeetingRating } from "@/components/l10/meeting-rating";

interface AgendaItem {
  id: string;
  section: string;
  duration_minutes: number;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

interface Meeting {
  id: string;
  title: string;
  status: string;
  started_at: string;
  scorecard_snapshot: Array<{
    id: string;
    name: string;
    current_value: number | null;
    goal: number | null;
    unit: string | null;
    owner?: { id: string; full_name: string };
  }>;
  rocks_snapshot: Array<{
    id: string;
    title: string;
    status: string;
    due_date: string;
    owner?: { id: string; full_name: string };
  }>;
  headlines: Array<{
    id: string;
    text: string;
    author_id: string;
    author_name: string;
    created_at: string;
  }>;
  agenda_items: AgendaItem[];
}

interface Profile {
  id: string;
  full_name: string;
}

interface Todo {
  id: string;
  title: string;
  due_date: string;
  completed_at: string | null;
  owner?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface Issue {
  id: string;
  title: string;
  description: string | null;
  priority: number | null;
  status: string;
  raised_by?: { id: string; full_name: string };
  created_at: string;
}

const SECTION_TITLES: Record<string, string> = {
  segue: "Segue",
  scorecard: "Scorecard Review",
  rocks: "Rock Review",
  headlines: "Headlines",
  todos: "To-Do Review",
  ids: "IDS - Identify, Discuss, Solve",
  conclude: "Conclude",
};

export default function LiveMeetingPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [reviewedTodos, setReviewedTodos] = useState<Record<string, string>>({});
  const [segueNotes, setSegueNotes] = useState("");

  const activeItem = meeting?.agenda_items.find(
    (item) => item.started_at && !item.completed_at
  );

  const fetchMeeting = useCallback(async () => {
    try {
      const response = await fetch(`/api/l10/${meetingId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.status !== "in_progress") {
          router.push(`/l10/${meetingId}`);
          return;
        }
        setMeeting(data);
      }
    } catch (error) {
      console.error("Failed to fetch meeting:", error);
    } finally {
      setLoading(false);
    }
  }, [meetingId, router]);

  const fetchSupportingData = useCallback(async () => {
    try {
      const [profilesRes, todosRes, issuesRes] = await Promise.all([
        fetch("/api/profiles"),
        fetch("/api/todos?status=pending"),
        fetch("/api/issues?status=detected,prioritized"),
      ]);

      if (profilesRes.ok) setProfiles(await profilesRes.json());
      if (todosRes.ok) setTodos(await todosRes.json());
      if (issuesRes.ok) setIssues(await issuesRes.json());
    } catch (error) {
      console.error("Failed to fetch supporting data:", error);
    }
  }, []);

  useEffect(() => {
    fetchMeeting();
    fetchSupportingData();
  }, [fetchMeeting, fetchSupportingData]);

  const handleNavigateSection = async (itemId: string) => {
    await fetch(`/api/l10/${meetingId}/agenda`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "navigate", agenda_item_id: itemId }),
    });
    fetchMeeting();
  };

  const handleNextSection = async () => {
    await fetch(`/api/l10/${meetingId}/agenda`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "next" }),
    });
    fetchMeeting();
  };

  const handlePreviousSection = async () => {
    await fetch(`/api/l10/${meetingId}/agenda`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "previous" }),
    });
    fetchMeeting();
  };

  const handleEndMeeting = async () => {
    router.push(`/l10/${meetingId}`);
  };

  const handleAddHeadline = async (text: string) => {
    await fetch(`/api/l10/${meetingId}/headlines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    fetchMeeting();
  };

  const handleRemoveHeadline = async (headlineId: string) => {
    await fetch(`/api/l10/${meetingId}/headlines?headline_id=${headlineId}`, {
      method: "DELETE",
    });
    fetchMeeting();
  };

  const handleReviewTodo = async (todoId: string, status: "done" | "not_done" | "pushed") => {
    await fetch(`/api/l10/${meetingId}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ todo_id: todoId, status_at_review: status }),
    });
    setReviewedTodos((prev) => ({ ...prev, [todoId]: status }));
  };

  const handleResolveIssue = async (
    issueId: string,
    outcome: "solved" | "todo_created" | "pushed" | "killed",
    data: {
      decision_notes?: string;
      todo_title?: string;
      todo_owner_id?: string;
      todo_due_date?: string;
    }
  ) => {
    await fetch(`/api/l10/${meetingId}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issue_id: issueId,
        outcome,
        ...data,
      }),
    });
  };

  const handleRateMeeting = async (rating: number, notes?: string) => {
    await fetch(`/api/l10/${meetingId}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, notes }),
    });
    router.push(`/l10/${meetingId}`);
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)]">
        <div className="w-64 border-r p-4 space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-medium">Meeting not found</h2>
            <Button asChild className="mt-4">
              <Link href="/l10">Back to L10</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentIndex = meeting.agenda_items.findIndex((i) => i.id === activeItem?.id);
  const isFirstSection = currentIndex === 0;
  const isLastSection = currentIndex === meeting.agenda_items.length - 1;

  const renderSectionContent = () => {
    if (!activeItem) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Select an agenda item to begin
        </div>
      );
    }

    switch (activeItem.section) {
      case "segue":
        return (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Share good news! Each person shares one personal and one professional win.
            </p>
            <Textarea
              placeholder="Capture wins and good news shared..."
              value={segueNotes}
              onChange={(e) => setSegueNotes(e.target.value)}
              rows={8}
            />
          </div>
        );

      case "scorecard":
        return <ScorecardReview metrics={meeting.scorecard_snapshot || []} />;

      case "rocks":
        return <RockReview rocks={meeting.rocks_snapshot || []} />;

      case "headlines":
        return (
          <HeadlineCapture
            headlines={meeting.headlines || []}
            onAdd={handleAddHeadline}
            onRemove={handleRemoveHeadline}
          />
        );

      case "todos":
        return (
          <TodoReview
            todos={todos}
            meetingId={meetingId}
            reviewedTodos={reviewedTodos}
            onReview={handleReviewTodo}
          />
        );

      case "ids":
        return (
          <IDSWorkflow
            issues={issues}
            meetingId={meetingId}
            profiles={profiles}
            onResolve={handleResolveIssue}
          />
        );

      case "conclude":
        return <MeetingRating onRate={handleRateMeeting} />;

      default:
        return (
          <div className="text-center text-muted-foreground">
            Unknown section: {activeItem.section}
          </div>
        );
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <AgendaSidebar
          items={meeting.agenda_items}
          activeItemId={activeItem?.id || null}
          onItemClick={handleNavigateSection}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold">
                  {activeItem ? SECTION_TITLES[activeItem.section] : meeting.title}
                </h1>
                <p className="text-sm text-muted-foreground">{meeting.title}</p>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <MessageSquare className="mr-1.5 h-4 w-4" />
                  Issue
                </Button>
                <Button variant="outline" size="sm">
                  <ListTodo className="mr-1.5 h-4 w-4" />
                  To-Do
                </Button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {renderSectionContent()}
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <MeetingControls
        startedAt={meeting.started_at}
        sectionStartedAt={activeItem?.started_at || null}
        sectionDuration={activeItem?.duration_minutes || 5}
        isFirstSection={isFirstSection}
        isLastSection={isLastSection}
        onPrevious={handlePreviousSection}
        onNext={handleNextSection}
        onEnd={handleEndMeeting}
      />
    </div>
  );
}
