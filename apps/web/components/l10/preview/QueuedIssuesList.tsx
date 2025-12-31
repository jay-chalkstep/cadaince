"use client";

import { useState } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PreviewSection } from "./PreviewSection";

interface QueuedIssue {
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
}

interface QueuedIssuesListProps {
  issues: QueuedIssue[];
  meetingId: string;
  onRemove?: (issueId: string) => Promise<void>;
}

export function QueuedIssuesList({
  issues,
  meetingId,
  onRemove,
}: QueuedIssuesListProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (issueId: string) => {
    if (!onRemove) return;
    setRemovingId(issueId);
    try {
      await onRemove(issueId);
    } finally {
      setRemovingId(null);
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

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    }
    if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    }
    return "Just now";
  };

  const getPriorityBadge = (priority: number | null) => {
    if (priority === null) return null;
    if (priority >= 8) {
      return <Badge variant="destructive" className="text-xs">High</Badge>;
    }
    if (priority >= 5) {
      return <Badge variant="outline" className="text-xs">Medium</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">Low</Badge>;
  };

  return (
    <PreviewSection
      title="Open Issues for IDS"
      count={issues.length}
      icon={<AlertCircle className="h-4 w-4 text-red-600" />}
      defaultExpanded={true}
    >
      <div className="space-y-2">
        {issues.map((issue) => {
          const profile = Array.isArray(issue.raised_by_profile)
            ? issue.raised_by_profile[0]
            : issue.raised_by_profile;
          const isRemoving = removingId === issue.id;

          return (
            <div
              key={issue.id}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <h4 className="font-medium text-sm line-clamp-2">{issue.title}</h4>
                  {getPriorityBadge(issue.priority)}
                </div>
                {issue.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {issue.description}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  {profile && (
                    <>
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback className="text-[8px]">
                          {getInitials(profile.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{profile.full_name}</span>
                      <span>·</span>
                    </>
                  )}
                  <span>{formatTimeAgo(issue.created_at)}</span>
                </div>
              </div>
              {onRemove && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={() => handleRemove(issue.id)}
                  disabled={isRemoving}
                >
                  {isRemoving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </PreviewSection>
  );
}
