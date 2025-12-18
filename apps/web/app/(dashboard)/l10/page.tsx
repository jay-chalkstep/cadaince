"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MeetingCard, MeetingCardSkeleton } from "@/components/l10/meeting-card";
import { CreateMeetingDialog } from "@/components/l10/create-meeting-dialog";

interface Meeting {
  id: string;
  title: string;
  meeting_type: string;
  scheduled_at: string;
  started_at: string | null;
  ended_at: string | null;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  rating: number | null;
  duration_minutes: number | null;
  created_by_profile?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export default function L10Page() {
  const router = useRouter();
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      // Fetch upcoming meetings
      const upcomingResponse = await fetch("/api/l10?upcoming=true&limit=5");
      if (upcomingResponse.ok) {
        const data = await upcomingResponse.json();
        setUpcomingMeetings(data);
      }

      // Fetch recent completed meetings
      const recentResponse = await fetch("/api/l10?status=completed&limit=10");
      if (recentResponse.ok) {
        const data = await recentResponse.json();
        setRecentMeetings(data);
      }
    } catch (error) {
      console.error("Failed to fetch meetings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const handleStartMeeting = async (meetingId: string) => {
    try {
      const response = await fetch(`/api/l10/${meetingId}/start`, {
        method: "POST",
      });
      if (response.ok) {
        router.push(`/l10/${meetingId}/live`);
      }
    } catch (error) {
      console.error("Failed to start meeting:", error);
    }
  };

  // Find the next scheduled meeting or in-progress meeting
  const nextMeeting = upcomingMeetings.find(
    (m) => m.status === "in_progress" || m.status === "scheduled"
  );
  const otherUpcoming = upcomingMeetings.filter((m) => m.id !== nextMeeting?.id);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">L10 Meetings</h1>
          <p className="text-sm text-muted-foreground">
            Level 10 meeting management and facilitation
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Schedule Meeting
        </Button>
      </div>

      {/* Next Meeting - Featured */}
      {loading ? (
        <div className="rounded-lg border-2 border-primary/20 p-6">
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-48" />
            <div className="flex gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex justify-between items-center">
              <Skeleton className="h-8 w-32" />
              <div className="flex gap-2">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-28" />
              </div>
            </div>
          </div>
        </div>
      ) : nextMeeting ? (
        <MeetingCard
          meeting={nextMeeting}
          variant="upcoming"
          onStart={() => handleStartMeeting(nextMeeting.id)}
        />
      ) : (
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No upcoming meetings</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Schedule your first L10 meeting to get started
          </p>
          <Button className="mt-4" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Schedule Meeting
          </Button>
        </div>
      )}

      {/* Other Upcoming Meetings */}
      {otherUpcoming.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Upcoming</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {otherUpcoming.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </div>
        </div>
      )}

      {/* Recent Meetings */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium">Recent Meetings</h2>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <MeetingCardSkeleton key={i} />
            ))}
          </div>
        ) : recentMeetings.length === 0 ? (
          <div className="rounded-lg border p-6 text-center text-muted-foreground">
            No meetings completed yet
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {recentMeetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </div>
        )}
      </div>

      <CreateMeetingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={fetchMeetings}
      />
    </div>
  );
}
