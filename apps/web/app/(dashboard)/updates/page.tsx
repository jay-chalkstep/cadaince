"use client";

import { useEffect, useState } from "react";
import { Plus, Video, FileText, Play, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateUpdateDialog } from "@/components/updates/create-update-dialog";
import { UpdateDetailSheet } from "@/components/updates/update-detail-sheet";

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

const typeConfig = {
  general: { label: "General", color: "bg-gray-500" },
  rock: { label: "Rock Update", color: "bg-purple-500" },
  scorecard: { label: "Scorecard", color: "bg-blue-500" },
  incident: { label: "Incident", color: "bg-red-500" },
};

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<Update | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const fetchUpdates = async (type?: string) => {
    setLoading(true);
    try {
      const url = type && type !== "all" ? `/api/updates?type=${type}` : "/api/updates";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setUpdates(data);
      }
    } catch (error) {
      console.error("Failed to fetch updates:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates(activeTab === "all" ? undefined : activeTab);
  }, [activeTab]);

  const handleUpdateClick = (update: Update) => {
    setSelectedUpdate(update);
    setSheetOpen(true);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Updates</h1>
          <p className="text-sm text-muted-foreground">
            Video and text updates from the team
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Post Update
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="rock">Rocks</TabsTrigger>
          <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
          <TabsTrigger value="incident">Incidents</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : updates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No updates yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Share an update with your team.
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Post Update
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {updates.map((update) => (
                <Card
                  key={update.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleUpdateClick(update)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={update.author.avatar_url || undefined} />
                          <AvatarFallback>
                            {getInitials(update.author.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{update.author.full_name}</span>
                            <Badge
                              variant="outline"
                              className={typeConfig[update.type].color + " text-white border-0 text-xs"}
                            >
                              {typeConfig[update.type].label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{update.author.role}</span>
                            <span>·</span>
                            <span>{formatDate(update.published_at)}</span>
                          </div>
                        </div>
                      </div>
                      {update.format === "video" && (
                        <Badge variant="secondary" className="gap-1">
                          <Video className="h-3 w-3" />
                          {update.duration_seconds && formatDuration(update.duration_seconds)}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {update.format === "video" && update.thumbnail_url ? (
                      <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                        <img
                          src={update.thumbnail_url}
                          alt="Video thumbnail"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <div className="bg-white/90 rounded-full p-3">
                            <Play className="h-6 w-6 text-black fill-black" />
                          </div>
                        </div>
                      </div>
                    ) : update.format === "video" ? (
                      <div className="rounded-lg bg-muted aspect-video flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                          <Video className="h-8 w-8 mx-auto mb-2" />
                          <p className="text-sm">Video processing...</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground line-clamp-3">
                        {update.content}
                      </p>
                    )}

                    {/* Linked items */}
                    {(update.linked_rock || update.linked_metric) && (
                      <div className="flex gap-2 mt-3">
                        {update.linked_rock && (
                          <Badge variant="outline" className="text-xs">
                            Rock: {update.linked_rock.title}
                          </Badge>
                        )}
                        {update.linked_metric && (
                          <Badge variant="outline" className="text-xs">
                            Metric: {update.linked_metric.name}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Transcript preview for video */}
                    {update.format === "video" && update.transcript && (
                      <div className="mt-3 p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <FileText className="h-3 w-3" />
                          Transcript
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {update.transcript}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateUpdateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => fetchUpdates(activeTab === "all" ? undefined : activeTab)}
      />

      <UpdateDetailSheet
        update={selectedUpdate}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
