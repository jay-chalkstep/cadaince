"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Plus,
  Check,
  Circle,
  AlertCircle,
  Clock,
  Trash2,
  MessageSquare,
  ArrowLeft,
  Mountain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: "not_started" | "in_progress" | "complete" | "blocked";
  is_overdue?: boolean;
}

interface Rock {
  id: string;
  title: string;
  description: string | null;
  status: "not_started" | "on_track" | "off_track" | "at_risk" | "complete";
  quarter: string | null;
  due_date: string | null;
  rock_level: "company" | "pillar" | "individual";
  milestones: Milestone[];
  owner: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  pillar: {
    id: string;
    name: string;
    color?: string;
  } | null;
  parent: {
    id: string;
    title: string;
    rock_level: string;
    status: string;
  } | null;
  quarter_obj?: {
    id: string;
    year: number;
    quarter: number;
  } | null;
}

const statusConfig = {
  not_started: { label: "Not Started", color: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
  on_track: { label: "On Track", color: "bg-green-100 text-green-700 hover:bg-green-200" },
  off_track: { label: "Off Track", color: "bg-red-100 text-red-700 hover:bg-red-200" },
  at_risk: { label: "At Risk", color: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" },
  complete: { label: "Complete", color: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
};

const rockLevelConfig = {
  company: { label: "Company Rock", color: "bg-purple-100 text-purple-700" },
  pillar: { label: "Pillar Rock", color: "bg-indigo-100 text-indigo-700" },
  individual: { label: "Individual Rock", color: "bg-cyan-100 text-cyan-700" },
};

export default function RockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const rockId = params.id as string;

  const [rock, setRock] = useState<Rock | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [updatingMilestoneId, setUpdatingMilestoneId] = useState<string | null>(null);
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

  // Fetch rock
  useEffect(() => {
    const fetchRock = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/rocks/${rockId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Rock not found");
          } else {
            setError("Failed to load rock");
          }
          return;
        }
        const data = await response.json();
        setRock(data);
      } catch (err) {
        console.error("Failed to fetch rock:", err);
        setError("Failed to load rock");
      } finally {
        setLoading(false);
      }
    };
    fetchRock();
  }, [rockId]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!rock) return;

    setUpdating(true);
    try {
      const response = await fetch(`/api/rocks/${rockId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const updated = await response.json();
        setRock({ ...rock, status: updated.status });
      }
    } catch (err) {
      console.error("Failed to update rock status:", err);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rock || !newMilestoneTitle.trim()) return;

    setAddingMilestone(true);
    try {
      const response = await fetch(`/api/rocks/${rockId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newMilestoneTitle.trim() }),
      });

      if (response.ok) {
        const newMilestone = await response.json();
        setRock({
          ...rock,
          milestones: [...rock.milestones, newMilestone],
        });
        setNewMilestoneTitle("");
      }
    } catch (err) {
      console.error("Failed to add milestone:", err);
    } finally {
      setAddingMilestone(false);
    }
  };

  const handleMilestoneStatusChange = async (milestoneId: string, newStatus: string) => {
    if (!rock) return;

    setUpdatingMilestoneId(milestoneId);
    try {
      const response = await fetch(`/api/rocks/${rockId}/milestones/${milestoneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setRock({
          ...rock,
          milestones: rock.milestones.map((m) =>
            m.id === milestoneId ? { ...m, status: newStatus as Milestone["status"] } : m
          ),
        });
      }
    } catch (err) {
      console.error("Failed to update milestone:", err);
    } finally {
      setUpdatingMilestoneId(null);
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!rock) return;

    try {
      const response = await fetch(`/api/rocks/${rockId}/milestones/${milestoneId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setRock({
          ...rock,
          milestones: rock.milestones.filter((m) => m.id !== milestoneId),
        });
      }
    } catch (err) {
      console.error("Failed to delete milestone:", err);
    }
  };

  const toggleMilestoneComplete = async (milestone: Milestone) => {
    const newStatus = milestone.status === "complete" ? "not_started" : "complete";
    await handleMilestoneStatusChange(milestone.id, newStatus);
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
  if (error || !rock) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push("/rocks")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Rocks
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mountain className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">{error || "Rock not found"}</p>
            <p className="text-sm text-muted-foreground mb-4">
              The rock you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
            </p>
            <Button onClick={() => router.push("/rocks")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Rocks
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedCount = rock.milestones.filter((m) => m.status === "complete").length;
  const progressPercent = rock.milestones.length > 0 ? (completedCount / rock.milestones.length) * 100 : 0;

  // Parse quarter display
  const quarterDisplay = rock.quarter || (rock.quarter_obj ? `Q${rock.quarter_obj.quarter} ${rock.quarter_obj.year}` : null);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.push("/rocks")} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Rocks
      </Button>

      {/* Main content */}
      <Card>
        <CardHeader className="pb-4">
          {/* Status and level badges */}
          <div className="flex items-center gap-2 mb-3">
            <Select
              value={rock.status}
              onValueChange={handleStatusChange}
              disabled={updating}
            >
              <SelectTrigger className="w-fit h-8">
                <SelectValue>
                  <Badge className={`${statusConfig[rock.status].color} border-0`}>
                    {updating && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                    {statusConfig[rock.status].label}
                  </Badge>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusConfig).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    <Badge className={`${config.color} border-0`}>
                      {config.label}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge className={`${rockLevelConfig[rock.rock_level].color} border-0`}>
              {rockLevelConfig[rock.rock_level].label}
            </Badge>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold leading-tight">{rock.title}</h1>

          {/* Meta info */}
          <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
            {quarterDisplay && <span>{quarterDisplay}</span>}
            {rock.pillar && (
              <>
                <span>·</span>
                <Badge variant="secondary" className="font-normal">
                  {rock.pillar.name}
                </Badge>
              </>
            )}
            {rock.due_date && (
              <>
                <span>·</span>
                <span>Due {new Date(rock.due_date).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Parent rock link */}
          {rock.parent && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Parent:</span>
              <Link
                href={`/rocks/${rock.parent.id}`}
                className="text-primary hover:underline"
              >
                {rock.parent.title}
              </Link>
            </div>
          )}

          {/* Owner */}
          {rock.owner && (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={rock.owner.avatar_url || undefined} />
                <AvatarFallback className="text-xs">{getInitials(rock.owner.full_name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{rock.owner.full_name}</p>
                <p className="text-xs text-muted-foreground">Owner</p>
              </div>
            </div>
          )}

          {/* Description */}
          {rock.description && (
            <div>
              <p className="text-sm text-muted-foreground leading-relaxed">{rock.description}</p>
            </div>
          )}

          {/* Milestones */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Milestones</h3>
              {rock.milestones.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {completedCount} of {rock.milestones.length}
                </span>
              )}
            </div>

            {/* Progress bar */}
            {rock.milestones.length > 0 && (
              <Progress value={progressPercent} className="h-1.5" />
            )}

            {/* Milestones list */}
            {rock.milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No milestones yet. Add milestones to track progress.
              </p>
            ) : (
              <div className="space-y-1">
                {rock.milestones.map((milestone) => {
                  const isUpdating = updatingMilestoneId === milestone.id;

                  return (
                    <div
                      key={milestone.id}
                      className={`group flex items-center gap-3 py-2 px-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors ${
                        milestone.status === "complete" ? "opacity-60" : ""
                      }`}
                    >
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                      ) : (
                        <Checkbox
                          checked={milestone.status === "complete"}
                          onCheckedChange={() => toggleMilestoneComplete(milestone)}
                          className="flex-shrink-0"
                        />
                      )}
                      <span
                        className={`flex-1 text-sm ${
                          milestone.status === "complete"
                            ? "line-through text-muted-foreground"
                            : ""
                        }`}
                      >
                        {milestone.title}
                      </span>
                      {milestone.is_overdue && (
                        <Badge variant="destructive" className="text-xs h-5 px-1.5">
                          Overdue
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteMilestone(milestone.id)}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add milestone form */}
            <form onSubmit={handleAddMilestone} className="flex gap-2 pt-1">
              <Input
                placeholder="Add a milestone..."
                value={newMilestoneTitle}
                onChange={(e) => setNewMilestoneTitle(e.target.value)}
                className="h-8 text-sm"
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                className="h-8 px-3"
                disabled={!newMilestoneTitle.trim() || addingMilestone}
              >
                {addingMilestone ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
              </Button>
            </form>
          </div>

          {/* Comments */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Comments</h3>
            </div>
            <CommentThread
              entityType="rock"
              entityId={rock.id}
              currentUserId={currentUserId}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
