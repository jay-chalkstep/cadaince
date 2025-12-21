"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Check, Circle, AlertCircle, Clock, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
  } | null;
}

interface RockDetailSheetProps {
  rock: Rock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const statusConfig = {
  not_started: { label: "Not Started", color: "bg-gray-500" },
  on_track: { label: "On Track", color: "bg-green-600" },
  off_track: { label: "Off Track", color: "bg-red-600" },
  complete: { label: "Complete", color: "bg-blue-600" },
};

const milestoneStatusConfig = {
  not_started: { label: "Not Started", icon: Circle, color: "text-gray-500" },
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

  const completedCount = milestones.filter((m) => m.status === "complete").length;
  const progressPercent = milestones.length > 0 ? (completedCount / milestones.length) * 100 : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{rock.name}</SheetTitle>
          <SheetDescription>
            Q{rock.quarter} {rock.year}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select
              value={rock.status}
              onValueChange={handleStatusChange}
              disabled={updating}
            >
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {updating && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Badge
                      variant="outline"
                      className={statusConfig[rock.status].color + " text-white border-0"}
                    >
                      {statusConfig[rock.status].label}
                    </Badge>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusConfig).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    <Badge
                      variant="outline"
                      className={config.color + " text-white border-0"}
                    >
                      {config.label}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pillar */}
          {rock.pillar && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Pillar</label>
              <Badge variant="secondary">{rock.pillar.name}</Badge>
            </div>
          )}

          {/* Description */}
          {rock.description && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <p className="text-sm text-muted-foreground">{rock.description}</p>
            </div>
          )}

          <Separator />

          {/* Owner */}
          {rock.owner && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Owner</label>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={rock.owner.avatar_url || undefined} />
                  <AvatarFallback>{getInitials(rock.owner.full_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{rock.owner.full_name}</p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Milestones */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Milestones</label>
              {milestones.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {completedCount}/{milestones.length} complete
                </span>
              )}
            </div>

            {/* Progress bar */}
            {milestones.length > 0 && (
              <div className="space-y-1">
                <Progress value={progressPercent} className="h-2" />
              </div>
            )}

            {/* Milestones list */}
            {loadingMilestones ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No milestones yet. Add milestones to track progress.
              </p>
            ) : (
              <div className="space-y-2">
                {milestones.map((milestone) => {
                  const StatusIcon = milestoneStatusConfig[milestone.status].icon;
                  const isUpdating = updatingMilestoneId === milestone.id;

                  return (
                    <div
                      key={milestone.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        milestone.status === "complete" ? "bg-muted/50" : ""
                      } ${milestone.is_overdue ? "border-red-200" : ""}`}
                    >
                      {isUpdating ? (
                        <Loader2 className="h-5 w-5 animate-spin mt-0.5" />
                      ) : (
                        <Checkbox
                          checked={milestone.status === "complete"}
                          onCheckedChange={() => toggleMilestoneComplete(milestone)}
                          className="mt-0.5"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium ${
                            milestone.status === "complete"
                              ? "line-through text-muted-foreground"
                              : ""
                          }`}
                        >
                          {milestone.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Select
                            value={milestone.status}
                            onValueChange={(v) => handleMilestoneStatusChange(milestone.id, v)}
                            disabled={isUpdating}
                          >
                            <SelectTrigger className="h-6 w-auto text-xs border-0 p-0 pr-2">
                              <SelectValue>
                                <div className="flex items-center gap-1">
                                  <StatusIcon
                                    className={`h-3 w-3 ${milestoneStatusConfig[milestone.status].color}`}
                                  />
                                  <span>{milestoneStatusConfig[milestone.status].label}</span>
                                </div>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(milestoneStatusConfig).map(([value, config]) => {
                                const Icon = config.icon;
                                return (
                                  <SelectItem key={value} value={value}>
                                    <div className="flex items-center gap-2">
                                      <Icon className={`h-3 w-3 ${config.color}`} />
                                      {config.label}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          {milestone.is_overdue && (
                            <Badge variant="destructive" className="text-xs h-5">
                              Overdue
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                        onClick={() => handleDeleteMilestone(milestone.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add milestone form */}
            <form onSubmit={handleAddMilestone} className="flex gap-2">
              <Input
                placeholder="Add a milestone..."
                value={newMilestoneTitle}
                onChange={(e) => setNewMilestoneTitle(e.target.value)}
                className="flex-1"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!newMilestoneTitle.trim() || addingMilestone}
              >
                {addingMilestone ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
