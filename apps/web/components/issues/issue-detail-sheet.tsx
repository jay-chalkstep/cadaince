"use client";

import { useState, useEffect } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommentThread } from "@/components/comments/comment-thread";

interface Issue {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "resolved";
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
}

interface IssueDetailSheetProps {
  issue: Issue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const priorityConfig = {
  1: { label: "High", color: "bg-red-600" },
  2: { label: "Medium", color: "bg-yellow-500" },
  3: { label: "Low", color: "bg-blue-500" },
};

export function IssueDetailSheet({
  issue,
  open,
  onOpenChange,
  onUpdate,
}: IssueDetailSheetProps) {
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
      } catch (error) {
        console.error("Failed to fetch current user:", error);
      }
    };
    fetchCurrentUser();
  }, []);

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
      const response = await fetch(`/api/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: parseInt(newPriority) }),
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to update issue priority:", error);
    } finally {
      setUpdating(false);
    }
  };

  const handleResolve = async () => {
    if (!issue) return;

    setUpdating(true);
    try {
      const response = await fetch(`/api/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "resolved",
          resolution: resolution || null,
        }),
      });

      if (response.ok) {
        setResolution("");
        onUpdate();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Failed to resolve issue:", error);
    } finally {
      setUpdating(false);
    }
  };

  const handleReopen = async () => {
    if (!issue) return;

    setUpdating(true);
    try {
      const response = await fetch(`/api/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "open" }),
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to reopen issue:", error);
    } finally {
      setUpdating(false);
    }
  };

  if (!issue) return null;

  const priorityConf = priorityConfig[issue.priority as keyof typeof priorityConfig] || priorityConfig[2];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{issue.title}</SheetTitle>
          <SheetDescription>
            Created {formatDate(issue.created_at)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            {issue.status === "resolved" ? (
              <Badge variant="default" className="bg-green-600">Resolved</Badge>
            ) : (
              <Badge variant="outline">Open</Badge>
            )}
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select
              value={issue.priority.toString()}
              onValueChange={handlePriorityChange}
              disabled={updating || issue.status === "resolved"}
            >
              <SelectTrigger>
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
