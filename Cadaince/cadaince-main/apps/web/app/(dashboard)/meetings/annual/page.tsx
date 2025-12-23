"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Plus, Loader2 } from "lucide-react";
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
import { AnnualPlanning } from "@/components/meetings/annual-planning";

export default function AnnualPlanningPage() {
  const router = useRouter();
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [schedulingMeeting, setSchedulingMeeting] = useState(false);
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("09:00");

  const handleScheduleAnnual = async () => {
    if (!meetingDate || !meetingTime) return;

    setSchedulingMeeting(true);
    try {
      const scheduledAt = new Date(`${meetingDate}T${meetingTime}`);

      const response = await fetch("/api/l10", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Annual Planning Session",
          meeting_type: "annual",
          scheduled_at: scheduledAt.toISOString(),
        }),
      });

      if (response.ok) {
        const meeting = await response.json();
        setShowScheduleDialog(false);
        setMeetingDate("");
        setMeetingTime("09:00");
        router.push(`/l10/${meeting.id}`);
      }
    } catch (error) {
      console.error("Failed to schedule annual planning:", error);
    } finally {
      setSchedulingMeeting(false);
    }
  };

  const handleEditVTO = () => {
    router.push("/settings/vto");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/meetings">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Annual Planning</h1>
          <p className="text-sm text-muted-foreground">
            Vision, strategy, and long-term planning
          </p>
        </div>
      </div>

      {/* Annual Planning Component */}
      <AnnualPlanning
        onEditVTO={handleEditVTO}
        onScheduleAnnual={() => setShowScheduleDialog(true)}
      />

      {/* Schedule Annual Planning Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Annual Planning Session</DialogTitle>
            <DialogDescription>
              Schedule an annual planning session to review V/TO and set yearly
              goals. Typically a full-day or multi-day offsite.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Start Time</Label>
              <Input
                id="time"
                type="time"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowScheduleDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleScheduleAnnual}
              disabled={!meetingDate || schedulingMeeting}
            >
              {schedulingMeeting && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Schedule Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
