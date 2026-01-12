"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommentThread } from "@/components/comments/comment-thread";
import { EscalateButton, EscalationChain } from "@/components/issues/escalate-button";

interface Issue {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "resolved" | "escalated";
  priority: number;
  created_at: string;
  resolved_at: string | null;
  resolution?: string | null;
  owner: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  created_by_profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  team?: {
    id: string;
    name: string;
    parent_team?: {
      id: string;
      name: string;
    } | null;
  } | null;
  escalated_to_issue_id?: string | null;
  linked_rock?: {
    id: string;
    title: string;
    status: string;
  } | null;
}

const priorityConfig = {
  1: { label: "High", color: "bg-red-600" },
  2: { label: "Medium", color: "bg-yellow-500" },
  3: { label: "Low", color: "bg-blue-500" },
};

export default function IssueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const issueId = params.id as string;

  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [resolution, setResolution] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch("/api/users/me");
        if (response.ok) {
          const data = await response.json();
          setCurrentUserId(data.id);
        }
      } catch (err) {
        console.error("Failed to fetch current user:", err);
      }
    };
    fetchCurrentUser();
  }, []);

  // Fetch issue
  useEffect(() => {
    const fetchIssue = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/issues/${issueId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Issue not found");
          } else {
            setError("Failed to load issue");
          }
          return;
        }
        const data = await response.json();
        setIssue(data);
      } catch (err) {
        console.error("Failed to fetch issue:", err);
        setError("Failed to load issue");
      } finally {
        setLoading(false);
      }
    };
    fetchIssue();
  }, [issueId]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (!issue) return;

    setUpdating(true);
    try {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: parseInt(newPriority) }),
      });

      if (response.ok) {
        const updated = await response.json();
        setIssue({ ...issue, priority: updated.priority });
      }
    } catch (err) {
      console.error("Failed to update issue priority:", err);
    } finally {
      setUpdating(false);
    }
  };

  const handleResolve = async () => {
    if (!issue) return;

    setUpdating(true);
    try {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "resolved",
          resolution: resolution || null,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setIssue({
          ...issue,
          status: "resolved",
          resolution: updated.resolution,
          resolved_at: updated.resolved_at,
        });
        setResolution("");
      }
    } catch (err) {
      console.error("Failed to resolve issue:", err);
    } finally {
      setUpdating(false);
    }
  };

  const handleReopen = async () => {
    if (!issue) return;

    setUpdating(true);
    try {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "open" }),
      });

      if (response.ok) {
        setIssue({
          ...issue,
          status: "open",
          resolved_at: null,
        });
      }
    } catch (err) {
      console.error("Failed to reopen issue:", err);
    } finally {
      setUpdating(false);
    }
  };

  const refetchIssue = async () => {
    try {
      const response = await fetch(`/api/issues/${issueId}`);
      if (response.ok) {
        const data = await response.json();
        setIssue(data);
      }
    } catch (err) {
      console.error("Failed to refetch issue:", err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24 mb-2" />
            <Skeleton className="h-8 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !issue) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push("/issues")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Issues
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">{error || "Issue not found"}</p>
            <p className="text-sm text-muted-foreground mb-4">
              The issue you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
            </p>
            <Button onClick={() => router.push("/issues")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Issues
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const priorityConf = priorityConfig[issue.priority as keyof typeof priorityConfig] || priorityConfig[2];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.push("/issues")} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Issues
      </Button>

      {/* Main content */}
      <Card>
        <CardHeader className="pb-4">
          {/* Title */}
          <h1 className="text-2xl font-semibold leading-tight">{issue.title}</h1>
          <p className="text-sm text-muted-foreground">
            Created {formatDate(issue.created_at)}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Status and Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {issue.status === "resolved" ? (
                <Badge variant="default" className="bg-green-600">Resolved</Badge>
              ) : issue.status === "escalated" ? (
                <Badge variant="default" className="bg-amber-600">Escalated</Badge>
              ) : (
                <Badge variant="outline">Open</Badge>
              )}
              {issue.team && (
                <Badge variant="secondary">{issue.team.name}</Badge>
              )}
            </div>

            {/* Escalation */}
            {issue.status === "open" && issue.team?.parent_team && (
              <EscalateButton
                issueId={issue.id}
                issueTitle={issue.title}
                currentTeamName={issue.team.name}
                parentTeamName={issue.team.parent_team.name}
                canEscalate={true}
                isEscalated={false}
                onEscalated={refetchIssue}
              />
            )}
            {issue.status === "escalated" && (
              <EscalateButton
                issueId={issue.id}
                issueTitle={issue.title}
                isEscalated={true}
              />
            )}
          </div>

          {/* Escalation Chain */}
          {(issue.status === "escalated" || issue.escalated_to_issue_id) && (
            <EscalationChain issueId={issue.id} />
          )}

          {/* Priority */}
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select
              value={issue.priority.toString()}
              onValueChange={handlePriorityChange}
              disabled={updating || issue.status === "resolved"}
            >
              <SelectTrigger className="w-fit">
                <SelectValue>
                  <Badge
                    variant="outline"
                    className={priorityConf.color + " text-white border-0"}
                  >
                    {priorityConf.label}
                  </Badge>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(priorityConfig).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    <Badge
                      variant="outline"
                      className={config.color + " text-white border-0"}
                    >
                      {config.label}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          {issue.description && (
            <div className="space-y-2">
              <Label>Description</Label>
              <p className="text-sm text-muted-foreground">{issue.description}</p>
            </div>
          )}

          {/* Linked Rock */}
          {issue.linked_rock && (
            <div className="space-y-2">
              <Label>Linked Rock</Label>
              <a
                href={`/rocks/${issue.linked_rock.id}`}
                className="text-sm text-primary hover:underline block"
              >
                {issue.linked_rock.title}
              </a>
            </div>
          )}

          <Separator />

          {/* People */}
          <div className="space-y-4">
            {issue.owner && (
              <div className="space-y-2">
                <Label>Owner</Label>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={issue.owner.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(issue.owner.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{issue.owner.full_name}</span>
                </div>
              </div>
            )}

            {issue.created_by_profile && (
              <div className="space-y-2">
                <Label>Created By</Label>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={issue.created_by_profile.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(issue.created_by_profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{issue.created_by_profile.full_name}</span>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Resolution */}
          {issue.status === "resolved" ? (
            <div className="space-y-4">
              {issue.resolution && (
                <div className="space-y-2">
                  <Label>Resolution</Label>
                  <p className="text-sm text-muted-foreground">{issue.resolution}</p>
                </div>
              )}
              {issue.resolved_at && (
                <p className="text-sm text-muted-foreground">
                  Resolved on {formatDate(issue.resolved_at)}
                </p>
              )}
              <Button
                variant="outline"
                onClick={handleReopen}
                disabled={updating}
              >
                {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reopen Issue
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resolution">Resolution Notes (optional)</Label>
                <Textarea
                  id="resolution"
                  placeholder="How was this issue resolved?"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  rows={3}
                />
              </div>
              <Button onClick={handleResolve} disabled={updating}>
                {updating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Resolve Issue
              </Button>
            </div>
          )}

          <Separator />

          {/* Comments */}
          <CommentThread
            entityType="issue"
            entityId={issue.id}
            currentUserId={currentUserId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
