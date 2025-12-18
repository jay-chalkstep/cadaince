"use client";

import { useEffect, useState } from "react";
import { Clock, Pause, Play } from "lucide-react";

interface MeetingTimerProps {
  startedAt: string;
  sectionStartedAt: string | null;
  sectionDuration: number; // in minutes
  isPaused?: boolean;
}

export function MeetingTimer({
  startedAt,
  sectionStartedAt,
  sectionDuration,
  isPaused = false,
}: MeetingTimerProps) {
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [sectionElapsed, setSectionElapsed] = useState(0);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setTotalElapsed(Math.floor((now - new Date(startedAt).getTime()) / 1000));

      if (sectionStartedAt) {
        setSectionElapsed(Math.floor((now - new Date(sectionStartedAt).getTime()) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, sectionStartedAt, isPaused]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const sectionTargetSeconds = sectionDuration * 60;
  const sectionProgress = Math.min((sectionElapsed / sectionTargetSeconds) * 100, 100);
  const isOverTime = sectionElapsed > sectionTargetSeconds;

  return (
    <div className="flex items-center gap-6">
      {/* Total meeting time */}
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="font-mono text-lg">{formatTime(totalElapsed)}</span>
      </div>

      {/* Section timer with progress */}
      {sectionStartedAt && (
        <div className="flex items-center gap-3">
          <div className="relative w-32 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`absolute left-0 top-0 h-full transition-all ${
                isOverTime ? "bg-red-500" : "bg-primary"
              }`}
              style={{ width: `${sectionProgress}%` }}
            />
          </div>
          <span
            className={`font-mono ${isOverTime ? "text-red-500" : "text-muted-foreground"}`}
          >
            {formatTime(sectionElapsed)} / {sectionDuration}:00
          </span>
          {isOverTime && <span className="text-xs text-red-500">Over</span>}
        </div>
      )}
    </div>
  );
}
