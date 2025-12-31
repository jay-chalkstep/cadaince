"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Update } from "./update-expandable-card";

interface Profile {
  id: string;
  full_name: string;
}

interface Rock {
  id: string;
  title: string;
}

interface AIExtraction {
  title: string;
  description: string;
  suggested_owner_id: string | null;
  suggested_owner_name: string | null;
  linked_rock_id: string | null;
  linked_rock_title: string | null;
  priority: 1 | 2 | 3;
  confidence: number;
}

interface ConvertToIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  update: Update | null;
  onConverted: () => void;
}

const priorityConfig = {
  1: { label: "High", color: "bg-red-600" },
  2: { label: "Medium", color: "bg-yellow-500" },
  3: { label: "Low", color: "bg-blue-500" },
};

export function ConvertToIssueDialog({
  open,
  onOpenChange,
  update,
  onConverted,
}: ConvertToIssueDialogProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [priority, setPriority] = useState("2");
  const [linkedRockId, setLinkedRockId] = useState("");

  // Fetch team data and run AI extraction when dialog opens
  useEffect(() => {
    if (open && update) {
      setError(null);
      fetchTeamData();
      extractIssue();
    }
  }, [open, update]);

  const fetchTeamData = async () => {
    try {
      const [profilesRes, rocksRes] = await Promise.all([
        fetch("/api/profiles"),
        fetch("/api/rocks?status=on_track"),
      ]);

      if (profilesRes.ok) {
        const profilesData = await profilesRes.json();
        setProfiles(profilesData);
      }

      if (rocksRes.ok) {
        const rocksData = await rocksRes.json();
        setRocks(rocksData);
      }
    } catch (err) {
      console.error("Failed to fetch team data:", err);
    }
  };

  const extractIssue = async () => {
    if (!update) return;

    setExtracting(true);
    setError(null);

    try {
      const response = await fetch(`/api/updates/${update.id}/extract-issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const extraction: AIExtraction = await response.json();
        setTitle(extraction.title);
        setDescription(extraction.description);
        setOwnerId(extraction.suggested_owner_id || "");
        setPriority(String(extraction.priority));
        setLinkedRockId(extraction.linked_rock_id || "");
        setConfidence(extraction.confidence);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to analyze update");
        // Set defaults for manual entry
        setTitle("");
        setDescription(update.transcript || update.content || "");
        setPriority("2");
      }
    } catch (err) {
      console.error("Failed to extract issue:", err);
      setError("Failed to analyze update. You can still fill out the form manually.");
      setTitle("");
      setDescription(update.transcript || update.content || "");
      setPriority("2");
    } finally {
      setExtracting(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setOwnerId("");
    setPriority("2");
    setLinkedRockId("");
    setConfidence(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !update) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/updates/${update.id}/convert-to-issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          owner_id: ownerId || null,
          priority: parseInt(priority),
          linked_rock_id: linkedRockId || null,
        }),
      });

      if (response.ok) {
        resetForm();
        onOpenChange(false);
        onConverted();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to create issue");
      }
    } catch (err) {
      console.error("Failed to create issue:", err);
      setError("Failed to create issue. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Convert to Issue
          </DialogTitle>
          <DialogDescription>
            AI has analyzed this update and suggested an issue. Review and edit before creating.
          </DialogDescription>
        </DialogHeader>

        {extracting ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            <p className="text-muted-foreground">Analyzing update...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {confidence !== null && (
              <div className="flex items-center gap-2 text-sm">
                <Badge
                  variant={confidence >= 0.7 ? "default" : confidence >= 0.5 ? "secondary" : "outline"}
                  className={
                    confidence >= 0.7
                      ? "bg-green-600"
                      : confidence >= 0.5
                        ? "bg-yellow-500"
                        : ""
                  }
                >
                  {Math.round(confidence * 100)}% confidence
                </Badge>
                <span className="text-muted-foreground">
                  {confidence >= 0.7
                    ? "High confidence extraction"
                    : confidence >= 0.5
                      ? "Moderate confidence - please review"
                      : "Low confidence - manual review recommended"}
                </span>
              </div>
            )}

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="What's the issue?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={80}
                />
                <p className="text-xs text-muted-foreground">{title.length}/80 characters</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Context for IDS discussion..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue>
                        <Badge
                          variant="outline"
                          className={
                            priorityConfig[parseInt(priority) as keyof typeof priorityConfig].color +
                            " text-white border-0"
                          }
                        >
                          {priorityConfig[parseInt(priority) as keyof typeof priorityConfig].label}
                        </Badge>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityConfig).map(([value, config]) => (
                        <SelectItem key={value} value={value}>
                          <Badge variant="outline" className={config.color + " text-white border-0"}>
                            {config.label}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner">Owner</Label>
                  <Select
                    value={ownerId || "__unassigned__"}
                    onValueChange={(v) => setOwnerId(v === "__unassigned__" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Assign to someone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unassigned__">Unassigned</SelectItem>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rock">Linked Rock (optional)</Label>
                <Select
                  value={linkedRockId || "__none__"}
                  onValueChange={(v) => setLinkedRockId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Link to a rock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No linked rock</SelectItem>
                    {rocks.map((rock) => (
                      <SelectItem key={rock.id} value={rock.id}>
                        {rock.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !title}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Issue
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
