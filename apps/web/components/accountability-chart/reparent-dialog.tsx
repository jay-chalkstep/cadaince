"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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

export interface PendingReparent {
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
}

interface ReparentDialogProps {
  pendingReparent: PendingReparent | null;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

/**
 * ReparentDialog - Confirmation dialog for changing reporting relationships
 *
 * Shows a confirmation prompt before actually changing the parent_seat_id
 * to prevent accidental org structure changes.
 */
export function ReparentDialog({
  pendingReparent,
  onConfirm,
  onCancel,
}: ReparentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={pendingReparent !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change reporting structure?</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingReparent && (
              <>
                <span className="font-semibold text-foreground">
                  {pendingReparent.sourceName}
                </span>{" "}
                will now report to{" "}
                <span className="font-semibold text-foreground">
                  {pendingReparent.targetName}
                </span>
                .
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading} onClick={onCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction disabled={isLoading} onClick={handleConfirm}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Confirm"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
