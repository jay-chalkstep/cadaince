"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Plus,
  Target,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  title: string | null;
  email: string;
}

interface Rock {
  id: string;
  title: string;
  description: string | null;
  status: "on_track" | "off_track" | "at_risk" | "complete";
  due_date: string;
  quarter: string | null;
}

interface Topic {
  id: string;
  title: string;
  notes: string | null;
  status: "open" | "discussed" | "resolved";
  created_at: string;
  added_by: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface Instance {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  ai_summary: string | null;
}

interface OneOnOneMeeting {
  id: string;
  title: string;
  meeting_day: string | null;
  meeting_time: string | null;
  duration_minutes: number;
  manager: Profile;
  direct: Profile;
  open_topics: Topic[];
  upcoming_instances: Instance[];
  recent_instances: Instance[];
  direct_rocks: Rock[];
}

interface OneOnOnePrepProps {
  meetingId: string;
  isManager?: boolean;
}

export function OneOnOnePrep({ meetingId, isManager = false }: OneOnOnePrepProps) {
  const [meeting, setMeeting] = useState<OneOnOneMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Topic form state
  const [showTopicDialog, setShowTopicDialog] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicNotes, setNewTopicNotes] = useState("");
  const [submittingTopic, setSubmittingTopic] = useState(false);

  useEffect(() => {
    fetchMeeting();
  }, [meetingId]);

  const fetchMeeting = async () => {
    try {
      const response = await fetch(`/api/one-on-ones/${meetingId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch meeting");
      }
      const data = await response.json();
      setMeeting(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load meeting");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTopic = async () => {
    if (!newTopicTitle.trim()) return;

    setSubmittingTopic(true);
    try {
      const response = await fetch(`/api/one-on-ones/${meetingId}/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTopicTitle.trim(),
          notes: newTopicNotes.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add topic");
      }

      // Refresh meeting data
      await fetchMeeting();

      // Reset form
      setNewTopicTitle("");
      setNewTopicNotes("");
      setShowTopicDialog(false);
    } catch (err) {
      console.error("Error adding topic:", err);
    } finally {
      setSubmittingTopic(false);
    }
  };

  const handleUpdateTopicStatus = async (topicId: string, status: "discussed" | "resolved") => {
    try {
      const response = await fetch(`/api/one-on-one-topics/${topicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Failed to update topic");
      }

      await fetchMeeting();
    } catch (err) {
      console.error("Error updating topic:", err);
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    try {
      const response = await fetch(`/api/one-on-one-topics/${topicId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete topic");
      }

      await fetchMeeting();
    } catch (err) {
      console.error("Error deleting topic:", err);
    }
  };

  const getStatusIcon = (status: Rock["status"]) => {
    switch (status) {
      case "on_track":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "off_track":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "at_risk":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case "complete":
        return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: Rock["status"]) => {
    switch (status) {
      case "on_track":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">On Track</Badge>;
      case "off_track":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Off Track</Badge>;
      case "at_risk":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">At Risk</Badge>;
      case "complete":
        return <Badge variant="secondary">Complete</Badge>;
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
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-muted-foreground">{error || "Meeting not found"}</p>
        </div>
      </div>
    );
  }

  const person = isManager ? meeting.direct : meeting.manager;
  const otherPerson = isManager ? meeting.manager : meeting.direct;
  const nextInstance = meeting.upcoming_instances[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={person.avatar_url || undefined} />
            <AvatarFallback className="text-lg">{getInitials(person.full_name)}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold">{meeting.title}</h2>
            <p className="text-muted-foreground">
              {isManager ? "Your 1:1 with" : "1:1 with"} {person.full_name}
              {person.title && ` (${person.title})`}
            </p>
          </div>
        </div>
        <div className="text-right">
          {nextInstance && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Next: {formatDate(nextInstance.scheduled_at)}</span>
              <Clock className="h-4 w-4 ml-2" />
              <span>{formatTime(nextInstance.scheduled_at)}</span>
            </div>
          )}
          {meeting.meeting_day && meeting.meeting_time && (
            <p className="text-xs text-muted-foreground mt-1">
              Recurring: {meeting.meeting_day}s at {meeting.meeting_time}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Topics Section */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Talking Points
              </CardTitle>
              <CardDescription>Topics to discuss in your next 1:1</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowTopicDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Topic
            </Button>
          </CardHeader>
          <CardContent>
            {meeting.open_topics.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No open topics</p>
                <p className="text-sm">Add topics to discuss in your next 1:1</p>
              </div>
            ) : (
              <div className="space-y-3">
                {meeting.open_topics.map((topic) => (
                  <div
                    key={topic.id}
                    className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{topic.title}</p>
                        <span className="text-xs text-muted-foreground">
                          by {topic.added_by.full_name}
                        </span>
                      </div>
                      {topic.notes && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {topic.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUpdateTopicStatus(topic.id, "discussed")}
                        title="Mark as discussed"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTopic(topic.id)}
                        title="Delete topic"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Add Topic */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Quick Add</CardTitle>
            <CardDescription>Add a topic without opening dialog</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddTopic();
              }}
              className="space-y-3"
            >
              <Input
                placeholder="What would you like to discuss?"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
              />
              <Button type="submit" className="w-full" disabled={!newTopicTitle.trim() || submittingTopic}>
                {submittingTopic ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add Topic
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Rocks Section (for manager view) */}
      {isManager && meeting.direct_rocks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              {meeting.direct.full_name}&apos;s Rocks
            </CardTitle>
            <CardDescription>Current quarterly rocks and their status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {meeting.direct_rocks.map((rock) => (
                <div
                  key={rock.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  {getStatusIcon(rock.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{rock.title}</p>
                    </div>
                    {rock.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {rock.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusBadge(rock.status)}
                      <span className="text-xs text-muted-foreground">
                        Due: {formatDate(rock.due_date)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Meetings */}
      {meeting.recent_instances.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent 1:1s
            </CardTitle>
            <CardDescription>Past meetings and summaries</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {meeting.recent_instances.map((instance) => (
                  <div
                    key={instance.id}
                    className="flex items-start justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatDate(instance.scheduled_at)}</span>
                        <Badge variant="secondary" className="text-xs">
                          {instance.status}
                        </Badge>
                      </div>
                      {instance.ai_summary && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {instance.ai_summary}
                        </p>
                      )}
                      {instance.notes && !instance.ai_summary && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {instance.notes}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Add Topic Dialog */}
      <Dialog open={showTopicDialog} onOpenChange={setShowTopicDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Topic</DialogTitle>
            <DialogDescription>
              Add a topic to discuss in your next 1:1 with {person.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="topic-title" className="text-sm font-medium">
                Topic
              </label>
              <Input
                id="topic-title"
                placeholder="What would you like to discuss?"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="topic-notes" className="text-sm font-medium">
                Notes (optional)
              </label>
              <Textarea
                id="topic-notes"
                placeholder="Add any context or notes..."
                value={newTopicNotes}
                onChange={(e) => setNewTopicNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTopicDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTopic} disabled={!newTopicTitle.trim() || submittingTopic}>
              {submittingTopic && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Topic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function OneOnOnePrepSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-muted animate-pulse" />
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="h-6 w-24 bg-muted rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="h-10 bg-muted rounded animate-pulse" />
              <div className="h-10 bg-muted rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
