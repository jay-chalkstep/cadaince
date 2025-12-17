"use client";

import { Video, FileText, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Update {
  id: string;
  type: "general" | "rock" | "scorecard" | "incident";
  format: "text" | "video";
  content: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  transcript: string | null;
  duration_seconds: number | null;
  published_at: string;
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    role: string;
  };
  linked_rock: {
    id: string;
    title: string;
    status: string;
  } | null;
  linked_metric: {
    id: string;
    name: string;
  } | null;
}

interface UpdateDetailSheetProps {
  update: Update | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeConfig = {
  general: { label: "General", color: "bg-gray-500" },
  rock: { label: "Rock Update", color: "bg-purple-500" },
  scorecard: { label: "Scorecard", color: "bg-blue-500" },
  incident: { label: "Incident", color: "bg-red-500" },
};

export function UpdateDetailSheet({
  update,
  open,
  onOpenChange,
}: UpdateDetailSheetProps) {
  if (!update) return null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl p-0">
        <ScrollArea className="h-full">
          <div className="p-6">
            <SheetHeader>
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={update.author.avatar_url || undefined} />
                  <AvatarFallback>{getInitials(update.author.full_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <SheetTitle className="text-left">{update.author.full_name}</SheetTitle>
                  <SheetDescription className="text-left">
                    {update.author.role}
                  </SheetDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={typeConfig[update.type].color + " text-white border-0"}
                >
                  {typeConfig[update.type].label}
                </Badge>
                {update.format === "video" && update.duration_seconds && (
                  <Badge variant="secondary" className="gap-1">
                    <Video className="h-3 w-3" />
                    {formatDuration(update.duration_seconds)}
                  </Badge>
                )}
              </div>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Video Player */}
              {update.format === "video" && update.video_url && (
                <div className="rounded-lg overflow-hidden bg-black aspect-video">
                  <video
                    src={update.video_url}
                    controls
                    poster={update.thumbnail_url || undefined}
                    className="w-full h-full"
                  />
                </div>
              )}

              {/* Video Processing */}
              {update.format === "video" && !update.video_url && (
                <div className="rounded-lg bg-muted aspect-video flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Video className="h-12 w-12 mx-auto mb-2 animate-pulse" />
                    <p className="font-medium">Processing video...</p>
                    <p className="text-sm">This may take a few minutes.</p>
                  </div>
                </div>
              )}

              {/* Text Content */}
              {update.format === "text" && update.content && (
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{update.content}</p>
                </div>
              )}

              {/* Linked Items */}
              {(update.linked_rock || update.linked_metric) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Related To</h4>
                    <div className="space-y-2">
                      {update.linked_rock && (
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <p className="text-xs text-muted-foreground">Rock</p>
                            <p className="font-medium">{update.linked_rock.title}</p>
                          </div>
                          <Badge variant="outline">{update.linked_rock.status}</Badge>
                        </div>
                      )}
                      {update.linked_metric && (
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <p className="text-xs text-muted-foreground">Metric</p>
                            <p className="font-medium">{update.linked_metric.name}</p>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Transcript */}
              {update.transcript && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-medium">Transcript</h4>
                    </div>
                    <div className="p-4 bg-muted rounded-lg max-h-64 overflow-y-auto">
                      <p className="text-sm whitespace-pre-wrap">{update.transcript}</p>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Metadata */}
              <div className="text-sm text-muted-foreground">
                Posted {formatDate(update.published_at)}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
