"use client";

import { useState } from "react";
import { Trophy, User, MessageSquare, MoreHorizontal, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ReactionBar } from "./reaction-bar";

interface Headline {
  id: string;
  title: string;
  description: string | null;
  headline_type: "customer" | "employee" | "general";
  created_by_profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  mentioned_member: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  reactions: Record<string, string[]>;
  created_at: string;
}

interface HeadlineCardProps {
  headline: Headline;
  currentUserId: string | null;
  onReaction: (headlineId: string, emoji: string) => void;
  onDelete: (headlineId: string) => void;
}

const typeConfig = {
  customer: { label: "Customer Win", icon: Trophy, color: "bg-green-100 text-green-700 border-green-200" },
  employee: { label: "Shoutout", icon: User, color: "bg-blue-100 text-blue-700 border-blue-200" },
  general: { label: "Good News", icon: MessageSquare, color: "bg-gray-100 text-gray-700 border-gray-200" },
};

export function HeadlineCard({
  headline,
  currentUserId,
  onReaction,
  onDelete,
}: HeadlineCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

  const config = typeConfig[headline.headline_type];
  const Icon = config.icon;
  const isCreator = currentUserId === headline.created_by_profile.id;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={headline.created_by_profile.avatar_url || undefined} />
            <AvatarFallback>
              {getInitials(headline.created_by_profile.full_name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {headline.created_by_profile.full_name}
                  </span>
                  <Badge variant="outline" className={`text-xs ${config.color}`}>
                    <Icon className="h-3 w-3 mr-1" />
                    {config.label}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(headline.created_at)}
                </span>
              </div>

              {isCreator && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <h3 className="font-semibold mt-2">{headline.title}</h3>

            {headline.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {headline.description}
              </p>
            )}

            {/* Mentioned member */}
            {headline.mentioned_member && headline.headline_type === "employee" && (
              <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-blue-50 border border-blue-100">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={headline.mentioned_member.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(headline.mentioned_member.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-blue-700">
                  {headline.mentioned_member.full_name}
                </span>
              </div>
            )}

            {/* Reactions */}
            <ReactionBar
              reactions={headline.reactions}
              currentUserId={currentUserId}
              onReaction={(emoji) => onReaction(headline.id, emoji)}
            />
          </div>
        </div>
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Headline?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this headline. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(headline.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
