"use client";

import { Star } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Pillar {
  id: string;
  name: string;
  color?: string | null;
}

interface MultiPillarSelectProps {
  pillars: Pillar[];
  selectedPillarIds: string[];
  primaryPillarId: string | null;
  onSelectionChange: (pillarIds: string[], primaryId: string | null) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Multi-pillar selection component with primary designation
 *
 * Features:
 * - Checkbox list of pillars for multi-select
 * - Star icon to designate primary pillar
 * - Displays pillar colors
 */
export function MultiPillarSelect({
  pillars,
  selectedPillarIds,
  primaryPillarId,
  onSelectionChange,
  disabled = false,
  className,
}: MultiPillarSelectProps) {
  const handlePillarToggle = (pillarId: string, checked: boolean) => {
    let newSelection: string[];
    let newPrimary = primaryPillarId;

    if (checked) {
      newSelection = [...selectedPillarIds, pillarId];
      // If this is the first selection, make it primary
      if (newSelection.length === 1) {
        newPrimary = pillarId;
      }
    } else {
      newSelection = selectedPillarIds.filter((id) => id !== pillarId);
      // If removing the primary, set new primary to first remaining or null
      if (pillarId === primaryPillarId) {
        newPrimary = newSelection.length > 0 ? newSelection[0] : null;
      }
    }

    onSelectionChange(newSelection, newPrimary);
  };

  const handlePrimaryClick = (pillarId: string) => {
    // Can only set as primary if it's already selected
    if (!selectedPillarIds.includes(pillarId)) return;
    onSelectionChange(selectedPillarIds, pillarId);
  };

  if (pillars.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No pillars available. Create pillars in settings first.
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {pillars.map((pillar) => {
        const isSelected = selectedPillarIds.includes(pillar.id);
        const isPrimary = pillar.id === primaryPillarId;

        return (
          <div
            key={pillar.id}
            className={cn(
              "flex items-center gap-3 p-2 rounded-md border transition-colors",
              isSelected ? "bg-accent/50 border-accent" : "border-transparent hover:bg-muted/50",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Checkbox
              id={`pillar-${pillar.id}`}
              checked={isSelected}
              onCheckedChange={(checked) =>
                handlePillarToggle(pillar.id, checked === true)
              }
              disabled={disabled}
            />

            {pillar.color && (
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: pillar.color }}
              />
            )}

            <Label
              htmlFor={`pillar-${pillar.id}`}
              className={cn(
                "flex-1 cursor-pointer text-sm",
                disabled && "cursor-not-allowed"
              )}
            >
              {pillar.name}
            </Label>

            {isSelected && (
              <button
                type="button"
                onClick={() => handlePrimaryClick(pillar.id)}
                disabled={disabled}
                className={cn(
                  "p-1 rounded hover:bg-muted transition-colors",
                  disabled && "cursor-not-allowed"
                )}
                title={isPrimary ? "Primary pillar" : "Set as primary"}
              >
                <Star
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isPrimary
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground hover:text-yellow-400"
                  )}
                />
              </button>
            )}
          </div>
        );
      })}

      {selectedPillarIds.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          Click the star to set the primary pillar for display
        </p>
      )}
    </div>
  );
}
