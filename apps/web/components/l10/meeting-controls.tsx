"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Square,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MeetingTimer } from "./meeting-timer";

interface MeetingControlsProps {
  startedAt: string;
  sectionStartedAt: string | null;
  sectionDuration: number;
  isFirstSection: boolean;
  isLastSection: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onEnd: () => void;
}

export function MeetingControls({
  startedAt,
  sectionStartedAt,
  sectionDuration,
  isFirstSection,
  isLastSection,
  onPrevious,
  onNext,
  onEnd,
}: MeetingControlsProps) {
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [ending, setEnding] = useState(false);

  const handleEnd = async () => {
    setEnding(true);
    await onEnd();
    setEnding(false);
  };

  return (
    <>
      <div className="border-t bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <MeetingTimer
            startedAt={startedAt}
            sectionStartedAt={sectionStartedAt}
            sectionDuration={sectionDuration}
          />

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={onPrevious}
              disabled={isFirstSection}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>

            {isLastSection ? (
              <Button onClick={() => setShowEndDialog(true)}>
                End Meeting
              </Button>
            ) : (
              <Button onClick={onNext}>
                Next Section
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}

            <Button
              variant="destructive"
              size="icon"
              onClick={() => setShowEndDialog(true)}
            >
              <Square className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              End Meeting?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will end the L10 meeting and generate a summary. Make sure
              you&apos;ve completed all agenda items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Meeting</AlertDialogCancel>
            <AlertDialogAction onClick={handleEnd} disabled={ending}>
              {ending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              End Meeting
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
