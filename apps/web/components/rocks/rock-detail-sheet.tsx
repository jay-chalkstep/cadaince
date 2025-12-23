"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Check, Circle, AlertCircle, Clock, Trash2, MessageSquare } from "lucide-react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  name: string;
  title?: string;
  description: string | null;
  status: "not_started" | "on_track" | "off_track" | "complete";
  quarter: number;
  year: number;
  milestone_count?: number;
  milestones_complete?: number;
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
}

interface RockDetailSheetProps {
  rock: Rock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const statusConfig = {
  not_started: { label: "Not Started", color: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
  on_track: { label: "On Track", color: "bg-green-100 text-green-700 hover:bg-green-200" },
  off_track: { label: "Off Track", color: "bg-red-100 text-red-700 hover:bg-red-200" },
  complete: { label: "Complete", color: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
};

const milestoneStatusConfig = {
  not_started: { label: "Not Started", icon: Circle, color: "text-gray-400" },
  in_progress: { label: "In Progress", icon: Clock, color: "text-blue-500" },
  complete: { label: "Complete", icon: Check, color: "text-green-500" },
  blocked: { label: "Blocked", icon: AlertCircle, color: "text-red-500" },
};

export function RockDetailSheet({
  rock,
  open,
  onOpenChange,
  onUpdate,
}: RockDetailSheetProps) {
  const [updating, setUpdating] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loadingMilestones, setLoadingMilestones] = useState(false);
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
      } catch (error) {
        console.error("Failed to fetch current user:", error);
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (rock && open) {
      fetchMilestones();
    }
  }, [rock?.id, open]);

  const fetchMilestones = async () => {
    if (!rock) return;
    setLoadingMilestones(true);
    try {
      const response = await fetch(`/api/rocks/${rock.id}/milestones`);
      if (response.ok) {
        const data = await response.json();
        setMilestones(data);
      }
    } catch (error) {
      console.error("Failed to fetch milestones:", error);
    } finally {
      setLoadingMilestones(false);
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

  const handleStatusChange = async (newStatus: string) => {
    if (!rock) return;

    setUpdating(true);
    try {
      const response = await fetch(`/api/rocks/${rock.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to update rock status:", error);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rock || !newMilestoneTitle.trim()) return;

    setAddingMilestone(true);
    try {
      const response = await fetch(`/api/rocks/${rock.id}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newMilestoneTitle.trim() }),
      });

      if (response.ok) {
        setNewMilestoneTitle("");
        fetchMilestones();
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to add milestone:", error);
    } finally {
      setAddingMilestone(false);
    }
  };

  const handleMilestoneStatusChange = async (milestoneId: string, newStatus: string) => {
    if (!rock) return;

    setUpdatingMilestoneId(milestoneId);
    try {
      const response = await fetch(`/api/rocks/${rock.id}/milestones/${milestoneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchMilestones();
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to update milestone:", error);
    } finally {
      setUpdatingMilestoneId(null);
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!rock) return;

    try {
      const response = await fetch(`/api/rocks/${rock.id}/milestones/${milestoneId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchMilestones();
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to delete milestone:", error);
    }
  };

  const toggleMilestoneComplete = async (milestone: Milestone) => {
    const newStatus = milestone.status === "complete" ? "not_started" : "complete";
    await handleMilestoneStatusChange(milestone.id, newStatus);
  };

  if (!rock) return null;

  const rockTitle = rock.title || rock.name;
  const completedCount = milestones.filter((m) => m.status === "complete").length;
  const progressPercent = milestones.length > 0 ? (completedCount / milestones.length) * 100 : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 bg-background z-10 border-b">
          <div className="p-6 pb-4">
            {/* Status badge - clickable */}
            <Select
              value={rock.status}
              onValueChange={handleStatusChange}
              disabled={updating}
            >
              <SelectTrigger className="w-auto h-7 border-0 p-0 focus:ring-0 mb-3">
                <Badge className={`${statusConfig[rock.status].color} border-0 cursor-pointer`}>
                  {updating && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  {statusConfig[rock.status].label}
                </Badge>
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

            {/* Title */}
            <h2 className="text-xl font-semibold leading-tight">{rockTitle}</h2>

            {/* Meta info row */}
            <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
              <span>Q{rock.quarter} {rock.year}</span>
              {rock.pillar && (
                <>
                  <span>·</span>
                  <Badge variant="secondary" className="font-normal">
                    {rock.pillar.name}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
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
              {milestones.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {completedCount} of {milestones.length}
                </span>
              )}
            </div>

            {/* Progress bar */}
            {milestones.length > 0 && (
              <Progress value={progressPercent} className="h-1.5" />
            )}

            {/* Milestones list */}
            {loadingMilestones ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No milestones yet. Add milestones to track progress.
              </p>
            ) : (
              <div className="space-y-1">
                {milestones.map((milestone) => {
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
