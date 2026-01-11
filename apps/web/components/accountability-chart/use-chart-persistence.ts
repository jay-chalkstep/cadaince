"use client";

import { useCallback, useRef, useState } from "react";
import type { PositionUpdate } from "./types";

interface UseChartPersistenceOptions {
  debounceMs?: number;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

interface UseChartPersistenceResult {
  savePositions: (updates: PositionUpdate[]) => void;
  isSaving: boolean;
  lastSavedAt: Date | null;
  pendingUpdates: number;
}

/**
 * useChartPersistence - Hook for persisting seat positions to the database
 *
 * Features:
 * - Debounced saves (batches rapid position changes)
 * - Tracks pending updates count
 * - Provides save status for UI feedback
 */
export function useChartPersistence(
  options: UseChartPersistenceOptions = {}
): UseChartPersistenceResult {
  const { debounceMs = 500, onError, onSuccess } = options;

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState(0);

  const pendingRef = useRef<Map<string, PositionUpdate>>(new Map());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const flushUpdates = useCallback(async () => {
    const updates = Array.from(pendingRef.current.values());
    if (updates.length === 0) return;

    pendingRef.current.clear();
    setPendingUpdates(0);
    setIsSaving(true);

    try {
      const response = await fetch("/api/accountability-chart/seats/positions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save positions");
      }

      setLastSavedAt(new Date());
      onSuccess?.();
    } catch (error) {
      console.error("Failed to save seat positions:", error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsSaving(false);
    }
  }, [onError, onSuccess]);

  const savePositions = useCallback(
    (updates: PositionUpdate[]) => {
      // Merge new updates into pending
      for (const update of updates) {
        pendingRef.current.set(update.id, update);
      }
      setPendingUpdates(pendingRef.current.size);

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new debounced flush
      timeoutRef.current = setTimeout(flushUpdates, debounceMs);
    },
    [debounceMs, flushUpdates]
  );

  return {
    savePositions,
    isSaving,
    lastSavedAt,
    pendingUpdates,
  };
}

/**
 * Hook to save a single seat's parent when drag-to-reparent occurs
 */
export function useReparentSeat() {
  const [isReparenting, setIsReparenting] = useState(false);

  const reparentSeat = useCallback(
    async (seatId: string, newParentId: string | null): Promise<boolean> => {
      setIsReparenting(true);
      try {
        const response = await fetch(`/api/accountability-chart/seats/${seatId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parent_seat_id: newParentId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to reparent seat");
        }

        return true;
      } catch (error) {
        console.error("Failed to reparent seat:", error);
        return false;
      } finally {
        setIsReparenting(false);
      }
    },
    []
  );

  return { reparentSeat, isReparenting };
}
