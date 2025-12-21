"use client";

import { MeetingHub } from "@/components/meetings/meeting-hub";

export default function MeetingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Meetings</h1>
          <p className="text-sm text-muted-foreground">
            All meeting types and schedules in one place
          </p>
        </div>
      </div>

      <MeetingHub />
    </div>
  );
}
