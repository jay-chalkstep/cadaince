"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  is_elt: boolean;
}

interface CreateMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateMeetingDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateMeetingDialogProps) {
  const [title, setTitle] = useState("Weekly L10");
  const [meetingType, setMeetingType] = useState("leadership");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchProfiles();
      // Default to next Monday at 9am
      const nextMonday = getNextMonday();
      setScheduledDate(nextMonday.toISOString().split("T")[0]);
    }
  }, [open]);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/profiles");
      if (response.ok) {
        const data = await response.json();
        setProfiles(data);
        // Pre-select ELT members
        const eltIds = data.filter((p: Profile) => p.is_elt).map((p: Profile) => p.id);
        setAttendeeIds(eltIds);
      }
    } catch (error) {
      console.error("Failed to fetch profiles:", error);
    } finally {
      setLoading(false);
    }
  };

  const getNextMonday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return nextMonday;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledDate || !scheduledTime) return;

    setSubmitting(true);
    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();

      const response = await fetch("/api/l10", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          meeting_type: meetingType,
          scheduled_at: scheduledAt,
          attendee_ids: attendeeIds,
        }),
      });

      if (response.ok) {
        onCreated();
        onOpenChange(false);
        resetForm();
      }
    } catch (error) {
      console.error("Failed to create meeting:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle("Weekly L10");
    setMeetingType("leadership");
    setScheduledDate("");
    setScheduledTime("09:00");
    setAttendeeIds([]);
  };

  const toggleAttendee = (profileId: string) => {
    setAttendeeIds((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId]
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule L10 Meeting</DialogTitle>
          <DialogDescription>
            Create a new Level 10 meeting for your team
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Meeting Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Weekly L10"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-type">Meeting Type</Label>
            <Select value={meetingType} onValueChange={setMeetingType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="leadership">Leadership Team</SelectItem>
                <SelectItem value="department">Department</SelectItem>
                <SelectItem value="quarterly">Quarterly Planning</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Attendees</Label>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2 rounded-md border p-2">
                {profiles.map((profile) => (
                  <label
                    key={profile.id}
                    className="flex items-center gap-3 rounded p-2 hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={attendeeIds.includes(profile.id)}
                      onCheckedChange={() => toggleAttendee(profile.id)}
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(profile.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{profile.full_name}</div>
                      <div className="text-xs text-muted-foreground">{profile.role}</div>
                    </div>
                    {profile.is_elt && (
                      <span className="text-xs text-muted-foreground">ELT</span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !scheduledDate}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Schedule Meeting
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
