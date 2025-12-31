"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  Video,
  FileText,
  Clock,
  Target,
  BarChart3,
  AlertTriangle,
  ChevronDown,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  VideoPlayerMux,
  VideoPlayerMuxHandle,
} from "@/components/updates/video-player-mux";
import {
  TranscriptPanel,
  StructuredTranscript,
} from "@/components/updates/transcript-panel";

// Update type matching the page interface
export interface Update {
  id: string;
  type: "general" | "rock" | "scorecard" | "incident";
  format: "text" | "video";
  content: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  transcript: string | null;
  transcript_data: StructuredTranscript | null;
  duration_seconds: number | null;
  published_at: string;
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    role: string;
  };
  linked_rock: { id: string; title: string; status: string } | null;
  linked_metric: { id: string; name: string } | null;
}

interface UpdateExpandableCardProps {
  update: Update;
  isExpanded: boolean;
  onToggleExpand: (id: string | null) => void;
}

// Extract playback ID from Mux stream URL
function extractPlaybackId(videoUrl: string | null): string | null {
  if (!videoUrl) return null;
  // Format: https://stream.mux.com/${playbackId}.m3u8
  const match = videoUrl.match(/stream\.mux\.com\/([^.]+)/);
  return match ? match[1] : null;
}

// Format duration in MM:SS
function formatDuration(seconds: number | null): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Get icon for update type
function getTypeIcon(type: Update["type"]) {
  switch (type) {
    case "rock":
      return Target;
    case "scorecard":
      return BarChart3;
    case "incident":
      return AlertTriangle;
    default:
      return FileText;
  }
}

// Get badge variant for update type
function getTypeBadgeVariant(type: Update["type"]) {
  switch (type) {
    case "rock":
      return "default";
    case "scorecard":
      return "secondary";
    case "incident":
      return "destructive";
    default:
      return "outline";
  }
}

export function UpdateExpandableCard({
  update,
  isExpanded,
  onToggleExpand,
}: UpdateExpandableCardProps) {
  const videoRef = useRef<VideoPlayerMuxHandle>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const playbackId = extractPlaybackId(update.video_url);
  const TypeIcon = getTypeIcon(update.type);
  const isVideo = update.format === "video" && playbackId;

  // Handle word click to seek video
  const handleWordClick = useCallback((time: number) => {
    videoRef.current?.seekTo(time);
    videoRef.current?.play();
  }, []);

  // Handle time update from video player
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // Handle escape key to collapse
  useEffect(() => {
    if (!isExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onToggleExpand(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, onToggleExpand]);

  // Scroll into view when expanded
  useEffect(() => {
    if (isExpanded && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isExpanded]);

  // Get transcript data (prefer structured, fall back to plain text)
  const transcriptData: StructuredTranscript | null = update.transcript_data
    ? update.transcript_data
    : update.transcript
      ? { text: update.transcript, words: [] }
      : null;

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={false}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <Card
        className={cn(
          "overflow-hidden transition-shadow",
          isExpanded && "ring-2 ring-primary shadow-lg"
        )}
      >
        {/* Collapsed Header - Always Visible */}
        <CardContent className="p-0">
          <button
            onClick={() => onToggleExpand(isExpanded ? null : update.id)}
            className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          >
            <div className="flex items-start gap-4 p-4">
              {/* Thumbnail or Icon */}
              <div className="relative flex-shrink-0">
                {isVideo && update.thumbnail_url ? (
                  <div className="relative w-24 h-16 md:w-32 md:h-20 rounded-md overflow-hidden bg-muted">
                    <img
                      src={update.thumbnail_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Video className="h-6 w-6 text-white" />
                    </div>
                    {update.duration_seconds && (
                      <div className="absolute bottom-1 right-1 px-1.5 py-0.5 text-xs font-medium text-white bg-black/70 rounded">
                        {formatDuration(update.duration_seconds)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
                    <TypeIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={getTypeBadgeVariant(update.type)}>
                    {update.type}
                  </Badge>
                  {update.linked_rock && (
                    <Badge variant="outline" className="text-xs">
                      <Target className="h-3 w-3 mr-1" />
                      {update.linked_rock.title}
                    </Badge>
                  )}
                  {update.linked_metric && (
                    <Badge variant="outline" className="text-xs">
                      <BarChart3 className="h-3 w-3 mr-1" />
                      {update.linked_metric.name}
                    </Badge>
                  )}
                </div>

                {update.content && (
                  <p
                    className={cn(
                      "text-sm text-foreground",
                      !isExpanded && "line-clamp-2"
                    )}
                  >
                    {update.content}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={update.author.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {update.author.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <span>{update.author.full_name}</span>
                  <span>·</span>
                  <Clock className="h-3 w-3" />
                  <span>
                    {format(new Date(update.published_at), "MMM d, h:mm a")}
                  </span>
                </div>
              </div>

              {/* Expand/Collapse Indicator */}
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="flex-shrink-0 text-muted-foreground"
              >
                <ChevronDown className="h-5 w-5" />
              </motion.div>
            </div>
          </button>

          {/* Expanded Content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <div className="border-t">
                  {/* Close Button */}
                  <div className="flex justify-end p-2 border-b bg-muted/30">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleExpand(null)}
                      className="h-7 px-2"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Close
                    </Button>
                  </div>

                  {/* Video Layout - 40% video / 60% transcript on desktop */}
                  {isVideo ? (
                    <div className="flex flex-col md:flex-row">
                      {/* Video Player - 40% on desktop */}
                      <div className="md:w-[40%] flex-shrink-0 bg-black">
                        <div className="aspect-video">
                          <VideoPlayerMux
                            ref={videoRef}
                            playbackId={playbackId}
                            thumbnailUrl={update.thumbnail_url || undefined}
                            onTimeUpdate={handleTimeUpdate}
                            className="w-full h-full"
                          />
                        </div>
                      </div>

                      {/* Transcript Panel - 60% on desktop */}
                      <div className="md:w-[60%] h-64 md:h-[400px] border-t md:border-t-0 md:border-l">
                        <TranscriptPanel
                          transcript={transcriptData}
                          currentTime={currentTime}
                          onWordClick={handleWordClick}
                          className="h-full"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Text-only update - full width content */
                    <div className="p-4">
                      <p className="text-sm whitespace-pre-wrap">
                        {update.content}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
