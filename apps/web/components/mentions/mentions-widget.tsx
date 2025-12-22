"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Mention {
  id: string;
  read_at: string | null;
  created_at: string;
  comment: {
    id: string;
    entity_type: string;
    entity_id: string;
    body: string;
    created_at: string;
    author: {
      id: string;
      full_name: string;
      avatar_url: string | null;
    };
  };
}

// Map entity types to routes
const entityRoutes: Record<string, (id: string) => string> = {
  rock: (id) => `/rocks?id=${id}`,
  todo: (id) => `/todos?id=${id}`,
  issue: (id) => `/issues?id=${id}`,
  metric: (id) => `/scorecard?id=${id}`,
  headline: (id) => `/headlines?id=${id}`,
  milestone: (id) => `/rocks?milestone=${id}`,
  process: (id) => `/process/${id}`,
  vto: () => `/vision`,
};

// Human-readable entity names
const entityNames: Record<string, string> = {
  rock: "Rock",
  todo: "To-Do",
  issue: "Issue",
  metric: "Metric",
  headline: "Headline",
  milestone: "Milestone",
  process: "Process",
  vto: "V/TO",
};

export function MentionsWidget() {
  const router = useRouter();
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchMentions = useCallback(async () => {
    try {
      const response = await fetch("/api/mentions?limit=5");
      if (response.ok) {
        const data = await response.json();
        setMentions(data);
        setUnreadCount(data.filter((m: Mention) => !m.read_at).length);
      }
    } catch (error) {
      console.error("Failed to fetch mentions:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMentions();
  }, [fetchMentions]);

  const handleMentionClick = async (mention: Mention) => {
    // Mark as read
    if (!mention.read_at) {
      try {
        await fetch(`/api/mentions/${mention.id}`, { method: "POST" });
      } catch (error) {
        console.error("Failed to mark mention as read:", error);
      }
    }

    // Navigate to entity
    const routeFn = entityRoutes[mention.comment.entity_type];
    if (routeFn) {
      router.push(routeFn(mention.comment.entity_id));
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-base">Mentions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-base">
              Mentions {unreadCount > 0 && `(${unreadCount} unread)`}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {mentions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent mentions</p>
        ) : (
          <div className="space-y-3">
            {mentions.map((mention) => (
              <button
                key={mention.id}
                className={`w-full flex items-start gap-3 p-2 rounded-lg text-left transition-colors hover:bg-accent ${
                  !mention.read_at ? "bg-blue-50/50" : ""
                }`}
                onClick={() => handleMentionClick(mention)}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage
                    src={mention.comment.author.avatar_url || undefined}
                  />
                  <AvatarFallback className="text-xs">
                    {getInitials(mention.comment.author.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium truncate">
                      {mention.comment.author.full_name}
                    </span>
                    {!mention.read_at && (
                      <span className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    on {entityNames[mention.comment.entity_type] || mention.comment.entity_type}
                    {" • "}
                    {formatDate(mention.created_at)}
                  </p>
                </div>
              </button>
            ))}

            {mentions.length >= 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => router.push("/mentions")}
              >
                View all mentions
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
