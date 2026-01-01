"use client";

import { useState, useEffect } from "react";
import { Loader2, Lock, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

interface Profile {
  id: string;
  full_name: string;
}

interface CreateTodoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  defaultVisibility?: "private" | "team";
  defaultTeamId?: string;
}

export function CreateTodoDialog({
  open,
  onOpenChange,
  onCreated,
  defaultVisibility = "team",
  defaultTeamId,
}: CreateTodoDialogProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [visibility, setVisibility] = useState<"private" | "team">(defaultVisibility);

  useEffect(() => {
    if (open) {
      fetchProfiles();
      setVisibility(defaultVisibility);
      // Default due date to 7 days from now
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 7);
      setDueDate(defaultDate.toISOString().split("T")[0]);
    }
  }, [open, defaultVisibility]);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/profiles");
      if (response.ok) {
        const data = await response.json();
        setProfiles(data);
      }
    } catch (error) {
      console.error("Failed to fetch profiles:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setOwnerId("");
    setDueDate("");
    setVisibility(defaultVisibility);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          owner_id: ownerId && ownerId !== "__me__" ? ownerId : null,
          due_date: dueDate || null,
          visibility,
          team_id: defaultTeamId || null,
        }),
      });

      if (response.ok) {
        resetForm();
        onOpenChange(false);
        onCreated();
      }
    } catch (error) {
      console.error("Failed to create todo:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create To-Do</DialogTitle>
          <DialogDescription>
            Add a new action item to track.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            {/* Visibility Toggle */}
            <div className="space-y-3">
              <Label>Visibility</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={visibility === "team" ? "default" : "outline"}
                  className="flex items-center justify-center gap-2"
                  onClick={() => setVisibility("team")}
                >
                  <Users className="h-4 w-4" />
                  <span className="text-sm">Team</span>
                </Button>
                <Button
                  type="button"
                  variant={visibility === "private" ? "default" : "outline"}
                  className="flex items-center justify-center gap-2"
                  onClick={() => setVisibility("private")}
                >
                  <Lock className="h-4 w-4" />
                  <span className="text-sm">Private</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {visibility === "team"
                  ? "Visible to your team in L10 meetings"
                  : "Only visible to you"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="What needs to be done?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add more details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="owner">Owner</Label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Assign to" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__me__">Me (default)</SelectItem>
                    {loading ? (
                      <SelectItem value="__loading__" disabled>Loading...</SelectItem>
                    ) : (
                      profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.full_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
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
            <Button type="submit" disabled={submitting || !title}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create To-Do
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
