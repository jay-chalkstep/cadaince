"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Video, FileText, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

interface Update {
  id: string;
  type: "general" | "rock" | "scorecard" | "incident";
  title: string | null;
  content: string | null;
  transcript: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  published_at: string;
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  rock?: {
    id: string;
    title: string;
  } | null;
  metric?: {
    id: string;
    name: string;
  } | null;
}

const typeConfig = {
  general: { label: "General", icon: MessageSquare, color: "bg-blue-500" },
  rock: { label: "Rock Update", icon: FileText, color: "bg-purple-500" },
  scorecard: { label: "Scorecard", icon: FileText, color: "bg-green-500" },
  incident: { label: "Incident", icon: FileText, color: "bg-red-500" },
};

export default function UpdateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [update, setUpdate] = useState<Update | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUpdate = async () => {
      try {
        const response = await fetch(`/api/updates/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setUpdate(data);
        } else if (response.status === 404) {
          setError("Update not found");
        } else {
          setError("Failed to load update");
        }
      } catch (err) {
        setError("Failed to load update");
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchUpdate();
    }
  }, [params.id]);

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
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !update) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">{error || "Update not found"}</p>
            <p className="text-sm text-muted-foreground mb-4">
              This update may have been deleted or you don't have access.
            </p>
            <Button onClick={() => router.push("/updates")}>
              View All Updates
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const TypeIcon = typeConfig[update.type]?.icon || MessageSquare;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">
              {update.title || "Update"}
            </h1>
            <Badge
              variant="secondary"
              className={`${typeConfig[update.type]?.color || "bg-gray-500"} text-white`}
            >
              {typeConfig[update.type]?.label || update.type}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDate(update.published_at)}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {/* Author */}
          <div className="flex items-center gap-3 mb-6">
            <Avatar>
              <AvatarImage src={update.author.avatar_url || undefined} />
              <AvatarFallback>{getInitials(update.author.full_name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{update.author.full_name}</p>
              <p className="text-sm text-muted-foreground">Author</p>
            </div>
          </div>

          {/* Video */}
          {update.video_url && (
            <div className="mb-6">
              <video
                src={update.video_url}
                poster={update.thumbnail_url || undefined}
                controls
                className="w-full rounded-lg max-h-[400px]"
              />
            </div>
          )}

          {/* Content */}
          {update.content && (
            <div className="mb-6">
              <h3 className="font-medium mb-2">Content</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {update.content}
              </p>
            </div>
          )}

          {/* Transcript */}
          {update.transcript && (
            <div className="mb-6">
              <h3 className="font-medium mb-2">Transcript</h3>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {update.transcript}
                </p>
              </div>
            </div>
          )}

          {/* Related items */}
          {(update.rock || update.metric) && (
            <div className="pt-4 border-t">
              <h3 className="font-medium mb-2">Related to</h3>
              <div className="flex gap-2">
                {update.rock && (
                  <Badge variant="outline">Rock: {update.rock.title}</Badge>
                )}
                {update.metric && (
                  <Badge variant="outline">Metric: {update.metric.name}</Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
