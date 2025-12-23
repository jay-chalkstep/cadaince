"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface MeetingRatingProps {
  onRate: (rating: number, notes?: string) => void;
}

export function MeetingRating({ onRate }: MeetingRatingProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const displayRating = hoveredRating ?? rating;

  const getRatingLabel = (value: number) => {
    if (value <= 3) return "Needs improvement";
    if (value <= 5) return "Below average";
    if (value <= 7) return "Average";
    if (value <= 9) return "Good";
    return "Excellent!";
  };

  return (
    <div className="space-y-6 text-center">
      <div>
        <h3 className="text-lg font-medium">Rate this meeting</h3>
        <p className="text-sm text-muted-foreground">
          How effective was this L10 meeting?
        </p>
      </div>

      {/* Rating stars/numbers */}
      <div className="flex justify-center gap-2">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
          <button
            key={value}
            onClick={() => setRating(value)}
            onMouseEnter={() => setHoveredRating(value)}
            onMouseLeave={() => setHoveredRating(null)}
            className={cn(
              "w-10 h-10 rounded-lg text-sm font-medium transition-all",
              displayRating && value <= displayRating
                ? value <= 3
                  ? "bg-red-500 text-white"
                  : value <= 6
                    ? "bg-yellow-500 text-white"
                    : "bg-green-500 text-white"
                : "bg-muted hover:bg-muted/80"
            )}
          >
            {value}
          </button>
        ))}
      </div>

      {displayRating && (
        <div className="text-lg font-medium">{getRatingLabel(displayRating)}</div>
      )}

      {/* Notes */}
      <div className="space-y-2 text-left max-w-md mx-auto">
        <Label>Cascading Messages (optional)</Label>
        <Textarea
          placeholder="Any messages to share with teams not in this meeting..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      {/* Submit */}
      <Button
        size="lg"
        onClick={() => rating && onRate(rating, notes || undefined)}
        disabled={!rating}
      >
        End Meeting
      </Button>
    </div>
  );
}
