"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Target,
  Plus,
  Calendar,
  User,
  CircleDot,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MoreHorizontal,
  Trash2,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

type GoalStatus = "on_track" | "off_track" | "complete";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  due_date: string | null;
  status: GoalStatus;
  progress: number | null;
  created_at: string;
  team_id: string;
  rock_id: string | null;
  owner_id: string;
  team?: { id: string; name: string; level: number } | null;
  rock?: { id: string; title: string; status: string } | null;
  owner?: { id: string; full_name: string; avatar_url: string | null } | null;
}

interface GoalsListProps {
  teamId?: string;
  ownerId?: string;
  rockId?: string;
  myGoals?: boolean;
  className?: string;
  showCreateButton?: boolean;
  onGoalCreated?: (goal: Goal) => void;
  onGoalUpdated?: (goal: Goal) => void;
  onGoalDeleted?: (goalId: string) => void;
}

/**
 * Get status color
 */
function getStatusColor(status: GoalStatus): string {
  switch (status) {
    case "on_track":
      return "text-green-600";
    case "off_track":
      return "text-red-600";
    case "complete":
      return "text-blue-600";
    default:
      return "text-gray-600";
  }
}

/**
 * Get status icon
 */
function getStatusIcon(status: GoalStatus) {
  switch (status) {
    case "on_track":
      return CircleDot;
    case "off_track":
      return AlertCircle;
    case "complete":
      return CheckCircle2;
    default:
      return CircleDot;
  }
}

/**
 * Get status label
 */
function getStatusLabel(status: GoalStatus): string {
  switch (status) {
    case "on_track":
      return "On Track";
    case "off_track":
      return "Off Track";
    case "complete":
      return "Complete";
    default:
      return status;
  }
}

/**
 * GoalCard - Individual goal display
 */
function GoalCard({
  goal,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  goal: Goal;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: GoalStatus) => void;
}) {
  const StatusIcon = getStatusIcon(goal.status);
  const dueDate = goal.due_date ? new Date(goal.due_date) : null;
  const isOverdue =
    dueDate && dueDate < new Date() && goal.status !== "complete";

  return (
    <Card className="group">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Status indicator */}
          <div
            className={cn(
              "mt-0.5 p-1.5 rounded-full",
              goal.status === "on_track" && "bg-green-100",
              goal.status === "off_track" && "bg-red-100",
              goal.status === "complete" && "bg-blue-100"
            )}
          >
            <StatusIcon
              className={cn("h-4 w-4", getStatusColor(goal.status))}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium leading-tight">{goal.title}</h4>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onStatusChange("on_track")}
                    disabled={goal.status === "on_track"}
                  >
                    <CircleDot className="h-4 w-4 mr-2 text-green-600" />
                    Mark On Track
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onStatusChange("off_track")}
                    disabled={goal.status === "off_track"}
                  >
                    <AlertCircle className="h-4 w-4 mr-2 text-red-600" />
                    Mark Off Track
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onStatusChange("complete")}
                    disabled={goal.status === "complete"}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2 text-blue-600" />
                    Mark Complete
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {goal.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {goal.description}
              </p>
            )}

            {/* Progress bar */}
            {goal.target_value && goal.progress !== null && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {goal.current_value ?? 0} / {goal.target_value}
                    {goal.unit && ` ${goal.unit}`}
                  </span>
                </div>
                <Progress value={goal.progress} className="h-2" />
              </div>
            )}

            {/* Meta info */}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              {goal.owner && (
                <div className="flex items-center gap-1">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={goal.owner.avatar_url || undefined} />
                    <AvatarFallback className="text-[8px]">
                      {goal.owner.full_name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>{goal.owner.full_name}</span>
                </div>
              )}
              {dueDate && (
                <div
                  className={cn(
                    "flex items-center gap-1",
                    isOverdue && "text-red-600"
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  <span>
                    {dueDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}
              {goal.rock && (
                <div className="flex items-center gap-1">
                  <CircleDot className="h-3 w-3" />
                  <span className="truncate max-w-[120px]">
                    {goal.rock.title}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * CreateGoalDialog - Dialog for creating/editing goals
 */
function CreateGoalDialog({
  open,
  onOpenChange,
  teamId,
  rockId,
  goal,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId?: string;
  rockId?: string;
  goal?: Goal | null;
  onSaved: (goal: Goal) => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    target_value: "",
    current_value: "",
    unit: "",
    due_date: "",
    status: "on_track" as GoalStatus,
  });

  // Populate form when editing
  useEffect(() => {
    if (goal) {
      setFormData({
        title: goal.title,
        description: goal.description || "",
        target_value: goal.target_value?.toString() || "",
        current_value: goal.current_value?.toString() || "",
        unit: goal.unit || "",
        due_date: goal.due_date || "",
        status: goal.status,
      });
    } else {
      setFormData({
        title: "",
        description: "",
        target_value: "",
        current_value: "",
        unit: "",
        due_date: "",
        status: "on_track",
      });
    }
  }, [goal, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      setLoading(true);

      const body = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        target_value: formData.target_value
          ? parseFloat(formData.target_value)
          : null,
        current_value: formData.current_value
          ? parseFloat(formData.current_value)
          : null,
        unit: formData.unit.trim() || null,
        due_date: formData.due_date || null,
        status: formData.status,
        team_id: teamId,
        rock_id: rockId || null,
      };

      const url = goal ? `/api/goals/${goal.id}` : "/api/goals";
      const method = goal ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save goal");
      }

      const savedGoal = await res.json();
      onSaved(savedGoal);
      onOpenChange(false);

      toast({
        title: goal ? "Goal updated" : "Goal created",
        description: `"${formData.title}" has been ${goal ? "updated" : "created"}.`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save goal",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal ? "Edit Goal" : "Create Goal"}</DialogTitle>
          <DialogDescription>
            {goal
              ? "Update the goal details below."
              : "Set an individual goal to track your progress."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="e.g., Complete 10 customer interviews"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Add more details..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target_value">Target</Label>
              <Input
                id="target_value"
                type="number"
                value={formData.target_value}
                onChange={(e) =>
                  setFormData({ ...formData, target_value: e.target.value })
                }
                placeholder="10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current_value">Current</Label>
              <Input
                id="current_value"
                type="number"
                value={formData.current_value}
                onChange={(e) =>
                  setFormData({ ...formData, current_value: e.target.value })
                }
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={formData.unit}
                onChange={(e) =>
                  setFormData({ ...formData, unit: e.target.value })
                }
                placeholder="e.g., %"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) =>
                  setFormData({ ...formData, due_date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) =>
                  setFormData({ ...formData, status: v as GoalStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_track">On Track</SelectItem>
                  <SelectItem value="off_track">Off Track</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.title.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {goal ? "Update" : "Create"} Goal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * GoalsList - List of individual goals with filtering and CRUD
 */
export function GoalsList({
  teamId,
  ownerId,
  rockId,
  myGoals = false,
  className,
  showCreateButton = true,
  onGoalCreated,
  onGoalUpdated,
  onGoalDeleted,
}: GoalsListProps) {
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Fetch goals
  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (teamId) params.set("team_id", teamId);
      if (ownerId) params.set("owner_id", ownerId);
      if (rockId) params.set("rock_id", rockId);
      if (myGoals) params.set("my_goals", "true");

      const res = await fetch(`/api/goals?${params}`);
      if (!res.ok) throw new Error("Failed to fetch goals");

      const data = await res.json();
      setGoals(data.goals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [teamId, ownerId, rockId, myGoals]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleStatusChange = async (goalId: string, status: GoalStatus) => {
    try {
      const res = await fetch(`/api/goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      const updated = await res.json();
      setGoals((prev) => prev.map((g) => (g.id === goalId ? updated : g)));
      onGoalUpdated?.(updated);

      toast({
        title: "Status updated",
        description: `Goal marked as ${getStatusLabel(status).toLowerCase()}.`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (goalId: string) => {
    try {
      const res = await fetch(`/api/goals/${goalId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete goal");

      setGoals((prev) => prev.filter((g) => g.id !== goalId));
      onGoalDeleted?.(goalId);

      toast({
        title: "Goal deleted",
        description: "The goal has been deleted.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete goal",
        variant: "destructive",
      });
    }
  };

  const handleSaved = (goal: Goal) => {
    if (editingGoal) {
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? goal : g)));
      onGoalUpdated?.(goal);
    } else {
      setGoals((prev) => [goal, ...prev]);
      onGoalCreated?.(goal);
    }
    setEditingGoal(null);
  };

  // Group goals by status
  const inProgressGoals = goals.filter((g) => g.status !== "complete");
  const completedGoals = goals.filter((g) => g.status === "complete");

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("text-center p-8", className)}>
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={fetchGoals} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Goals</h3>
          <Badge variant="secondary">{goals.length}</Badge>
        </div>
        {showCreateButton && teamId && (
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Goal
          </Button>
        )}
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Target className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground">No goals yet</p>
            {showCreateButton && teamId && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Create your first goal
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* In Progress */}
          {inProgressGoals.length > 0 && (
            <div className="space-y-3">
              {inProgressGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onEdit={() => setEditingGoal(goal)}
                  onDelete={() => handleDelete(goal.id)}
                  onStatusChange={(status) => handleStatusChange(goal.id, status)}
                />
              ))}
            </div>
          )}

          {/* Completed */}
          {completedGoals.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                Completed ({completedGoals.length})
              </h4>
              <div className="space-y-3 opacity-75">
                {completedGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={() => setEditingGoal(goal)}
                    onDelete={() => handleDelete(goal.id)}
                    onStatusChange={(status) =>
                      handleStatusChange(goal.id, status)
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <CreateGoalDialog
        open={createDialogOpen || !!editingGoal}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditingGoal(null);
          }
        }}
        teamId={teamId}
        rockId={rockId}
        goal={editingGoal}
        onSaved={handleSaved}
      />
    </div>
  );
}
