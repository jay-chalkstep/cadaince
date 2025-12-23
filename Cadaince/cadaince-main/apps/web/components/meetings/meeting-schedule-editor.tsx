"use client";

import { useState } from "react";
import { Loader2, Save, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type RecurrencePattern = "weekly" | "biweekly" | "monthly";
type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";

interface MeetingSchedule {
  id?: string;
  title: string;
  meeting_day: DayOfWeek;
  meeting_time: string;
  duration_minutes: number;
  recurrence_pattern: RecurrencePattern;
  is_active: boolean;
}

interface MeetingScheduleEditorProps {
  schedule?: MeetingSchedule;
  onSave: (schedule: MeetingSchedule) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}

const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
];

const RECURRENCE_PATTERNS: { value: RecurrencePattern; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
];

const DURATION_OPTIONS = [
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
];

export function MeetingScheduleEditor({
  schedule,
  onSave,
  onDelete,
  onCancel,
}: MeetingScheduleEditorProps) {
  const [formData, setFormData] = useState<MeetingSchedule>({
    title: schedule?.title || "",
    meeting_day: schedule?.meeting_day || "tuesday",
    meeting_time: schedule?.meeting_time || "09:00",
    duration_minutes: schedule?.duration_minutes || 90,
    recurrence_pattern: schedule?.recurrence_pattern || "weekly",
    is_active: schedule?.is_active ?? true,
    ...(schedule?.id && { id: schedule.id }),
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleChange = <K extends keyof MeetingSchedule>(
    field: K,
    value: MeetingSchedule[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  const isEditing = !!schedule?.id;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Schedule" : "Create Meeting Schedule"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Modify the recurring meeting schedule"
            : "Set up a recurring meeting schedule"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Meeting Title</Label>
            <Input
              id="title"
              placeholder="e.g., Weekly L10 Meeting"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              required
            />
          </div>

          {/* Day and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="day">Day of Week</Label>
              <Select
                value={formData.meeting_day}
                onValueChange={(v) => handleChange("meeting_day", v as DayOfWeek)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Start Time</Label>
              <Input
                id="time"
                type="time"
                value={formData.meeting_time}
                onChange={(e) => handleChange("meeting_time", e.target.value)}
                required
              />
            </div>
          </div>

          {/* Duration and Recurrence */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Select
                value={formData.duration_minutes.toString()}
                onValueChange={(v) => handleChange("duration_minutes", parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recurrence">Recurrence</Label>
              <Select
                value={formData.recurrence_pattern}
                onValueChange={(v) =>
                  handleChange("recurrence_pattern", v as RecurrencePattern)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_PATTERNS.map((pattern) => (
                    <SelectItem key={pattern.value} value={pattern.value}>
                      {pattern.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="active" className="font-medium">
                Active Schedule
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, meetings will be automatically scheduled
              </p>
            </div>
            <Checkbox
              id="active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleChange("is_active", checked === true)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <div>
              {isEditing && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !formData.title}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : isEditing ? (
                  <Save className="h-4 w-4 mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                {isEditing ? "Save Changes" : "Create Schedule"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
