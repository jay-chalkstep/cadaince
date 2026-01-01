"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

interface Profile {
  id: string;
  full_name: string;
}

interface CreateIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  defaultTeamId?: string;
}

const priorityConfig = {
  1: { label: "High", color: "bg-red-600" },
  2: { label: "Medium", color: "bg-yellow-500" },
  3: { label: "Low", color: "bg-blue-500" },
};

export function CreateIssueDialog({
  open,
  onOpenChange,
  onCreated,
  defaultTeamId,
}: CreateIssueDialogProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [priority, setPriority] = useState("2");

  useEffect(() => {
    if (open) {
      fetchProfiles();
    }
  }, [open]);

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
    setPriority("2");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          owner_id: ownerId || null,
          priority: parseInt(priority),
          team_id: defaultTeamId || null,
        }),
      });

      if (response.ok) {
        resetForm();
        onOpenChange(false);
        onCreated();
      }
    } catch (error) {
      console.error("Failed to create issue:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Issue</DialogTitle>
          <DialogDescription>
            Add a new issue to track and resolve.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="What's the issue?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Provide more context about this issue..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue>
                    <Badge
                      variant="outline"
                      className={priorityConfig[parseInt(priority) as keyof typeof priorityConfig].color + " text-white border-0"}
                    >
                      {priorityConfig[parseInt(priority) as keyof typeof priorityConfig].label}
                    </Badge>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityConfig).map(([value, config]) => (
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

            <div className="space-y-2">
              <Label htmlFor="owner">Owner (optional)</Label>
              <Select value={ownerId || "__unassigned__"} onValueChange={(v) => setOwnerId(v === "__unassigned__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Assign to someone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
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
              Create Issue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
