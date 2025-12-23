"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Check, CheckCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface MentionsInboxProps {
  unreadCount: number;
  onUnreadCountChange: (count: number) => void;
}

export function MentionsInbox({ unreadCount, onUnreadCountChange }: MentionsInboxProps) {
  const router = useRouter();
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Fetch mentions when dropdown opens
  const fetchMentions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/mentions?all=true&limit=10");
      if (response.ok) {
        const data = await response.json();
        setMentions(data);
      }
    } catch (error) {
      console.error("Failed to fetch mentions:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchMentions();
    }
  }, [open, fetchMentions]);

  // Mark a single mention as read
  const markAsRead = async (mentionId: string) => {
    try {
      await fetch(`/api/mentions/${mentionId}`, { method: "POST" });
      setMentions((prev) =>
        prev.map((m) =>
          m.id === mentionId ? { ...m, read_at: new Date().toISOString() } : m
        )
      );
      onUnreadCountChange(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error("Failed to mark mention as read:", error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await fetch("/api/mentions", { method: "POST" });
      setMentions((prev) =>
        prev.map((m) => ({ ...m, read_at: m.read_at || new Date().toISOString() }))
      );
      onUnreadCountChange(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  // Navigate to the entity
  const handleMentionClick = async (mention: Mention) => {
    if (!mention.read_at) {
      await markAsRead(mention.id);
    }

    const routeFn = entityRoutes[mention.comment.entity_type];
    if (routeFn) {
      router.push(routeFn(mention.comment.entity_id));
    }
    setOpen(false);
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
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Extract a preview from the comment body (removing mention syntax)
  const getPreview = (body: string) => {
    const cleaned = body.replace(/@\[[^\]]+\]\([^)]+\)/g, (match) => {
      const nameMatch = match.match(/@\[([^\]]+)\]/);
      return nameMatch ? `@${nameMatch[1]}` : match;
    });
    return cleaned.length > 60 ? cleaned.slice(0, 60) + "..." : cleaned;
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <MessageCircle className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-blue-600 text-xs text-white flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Mentions</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-2 text-xs"
              onClick={(e) => {
                e.preventDefault();
                markAllAsRead();
              }}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : mentions.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No mentions yet
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            {mentions.map((mention) => (
              <DropdownMenuItem
                key={mention.id}
                className={`flex items-start gap-3 p-3 cursor-pointer ${
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
                    <span className="font-medium text-sm truncate">
                      {mention.comment.author.full_name}
                    </span>
                    {!mention.read_at && (
                      <span className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    mentioned you on{" "}
                    <span className="font-medium">
                      {entityNames[mention.comment.entity_type] || mention.comment.entity_type}
                    </span>
                  </p>
                  <p className="text-xs text-foreground mt-1 line-clamp-2">
                    {getPreview(mention.comment.body)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(mention.created_at)}
                  </p>
                </div>
                {!mention.read_at && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(mention.id);
                    }}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                )}
              </DropdownMenuItem>
            ))}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
