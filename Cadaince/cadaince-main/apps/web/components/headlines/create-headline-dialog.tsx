"use client";

import { useState, useEffect } from "react";
import { Loader2, Trophy, User, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface TeamMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface CreateHeadlineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateHeadlineDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateHeadlineDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [headlineType, setHeadlineType] = useState<"customer" | "employee" | "general">("general");
  const [mentionedMemberId, setMentionedMemberId] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && headlineType === "employee") {
      fetchTeamMembers();
    }
  }, [open, headlineType]);

  const fetchTeamMembers = async () => {
    try {
      const response = await fetch("/api/team");
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data);
      }
    } catch (error) {
      console.error("Failed to fetch team members:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/headlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          headline_type: headlineType,
          mentioned_member_id: headlineType === "employee" ? mentionedMemberId || null : null,
        }),
      });

      if (response.ok) {
        setTitle("");
        setDescription("");
        setHeadlineType("general");
        setMentionedMemberId("");
        onCreated();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Failed to create headline:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share a Win</DialogTitle>
          <DialogDescription>
            Celebrate customer wins, recognize team members, or share good news.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Label>Type</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={headlineType === "customer" ? "default" : "outline"}
                className="flex flex-col items-center justify-center h-16 gap-1"
                onClick={() => setHeadlineType("customer")}
              >
                <Trophy className="h-5 w-5 text-green-600" />
                <span className="text-xs">Customer</span>
              </Button>
              <Button
                type="button"
                variant={headlineType === "employee" ? "default" : "outline"}
                className="flex flex-col items-center justify-center h-16 gap-1"
                onClick={() => setHeadlineType("employee")}
              >
                <User className="h-5 w-5 text-blue-600" />
                <span className="text-xs">Shoutout</span>
              </Button>
              <Button
                type="button"
                variant={headlineType === "general" ? "default" : "outline"}
                className="flex flex-col items-center justify-center h-16 gap-1"
                onClick={() => setHeadlineType("general")}
              >
                <MessageSquare className="h-5 w-5 text-gray-600" />
                <span className="text-xs">General</span>
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Headline *</Label>
            <Input
              id="title"
              placeholder={
                headlineType === "customer"
                  ? "e.g., Closed $50K deal with Acme Corp"
                  : headlineType === "employee"
                  ? "e.g., Great job on the product launch!"
                  : "e.g., We hit 1000 customers this week!"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {headlineType === "employee" && (
            <div className="space-y-2">
              <Label htmlFor="mentioned">Recognize</Label>
              <Select value={mentionedMemberId} onValueChange={setMentionedMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Details (optional)</Label>
            <Textarea
              id="description"
              placeholder="Add more context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Share
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
