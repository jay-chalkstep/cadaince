"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Attendee {
  id: string;
  profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    role: string;
  };
}

interface MeetingRatingProps {
  attendees: Attendee[];
  onRate: (ratings: Record<string, number>, cascadingMessages?: string) => void;
}

export function MeetingRating({ attendees, onRate }: MeetingRatingProps) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [hoveredRating, setHoveredRating] = useState<{ attendeeId: string; value: number } | null>(null);
  const [cascadingMessages, setCascadingMessages] = useState("");

  const allRated = attendees.length > 0 && attendees.every((a) => ratings[a.profile.id] !== undefined);
  const ratingValues = Object.values(ratings);
  const averageRating = ratingValues.length > 0
    ? (ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length).toFixed(1)
    : null;

  const setAttendeeRating = (profileId: string, value: number) => {
    setRatings((prev) => ({ ...prev, [profileId]: value }));
  };

  const getDisplayRating = (profileId: string) => {
    if (hoveredRating?.attendeeId === profileId) {
      return hoveredRating.value;
    }
    return ratings[profileId];
  };

  const getRatingColor = (value: number) => {
    if (value <= 3) return "bg-red-500 text-white";
    if (value <= 6) return "bg-yellow-500 text-white";
    return "bg-green-500 text-white";
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-medium">Rate this meeting</h3>
        <p className="text-sm text-muted-foreground">
          Each attendee rates the meeting 1-10. How effective was this L10?
        </p>
      </div>

      {/* Per-attendee ratings */}
      {attendees.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          No attendees recorded for this meeting
        </div>
      ) : (
        <div className="space-y-4">
          {attendees.map((attendee) => {
            const displayRating = getDisplayRating(attendee.profile.id);
            return (
              <div
                key={attendee.id}
                className="flex items-center gap-4 p-4 rounded-lg border bg-card"
              >
                {/* Attendee info */}
                <div className="flex items-center gap-3 min-w-[180px]">
                  <Avatar className="h-10 w-10">
                    {attendee.profile.avatar_url && (
                      <AvatarImage src={attendee.profile.avatar_url} />
                    )}
                    <AvatarFallback>
                      {getInitials(attendee.profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{attendee.profile.full_name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {attendee.profile.role}
                    </div>
                  </div>
                </div>

                {/* Rating buttons */}
                <div className="flex gap-1 flex-1 justify-center">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                    <button
                      key={value}
                      onClick={() => setAttendeeRating(attendee.profile.id, value)}
                      onMouseEnter={() => setHoveredRating({ attendeeId: attendee.profile.id, value })}
                      onMouseLeave={() => setHoveredRating(null)}
                      className={cn(
                        "w-8 h-8 rounded text-sm font-medium transition-all",
                        displayRating && value <= displayRating
                          ? getRatingColor(displayRating)
                          : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      {value}
                    </button>
                  ))}
                </div>

                {/* Current rating display */}
                <div className="w-12 text-center">
                  {ratings[attendee.profile.id] !== undefined && (
                    <span className="text-lg font-bold">
                      {ratings[attendee.profile.id]}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Average rating */}
      {averageRating && (
        <div className="text-center py-4 bg-muted/50 rounded-lg">
          <div className="text-sm text-muted-foreground">Team Average</div>
          <div className="text-3xl font-bold">{averageRating}</div>
        </div>
      )}

      {/* Cascading Messages */}
      <div className="space-y-2 max-w-2xl mx-auto">
        <Label>Cascading Messages (optional)</Label>
        <Textarea
          placeholder="Any messages to share with teams not in this meeting..."
          value={cascadingMessages}
          onChange={(e) => setCascadingMessages(e.target.value)}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          These messages will be shared with the broader team
        </p>
      </div>

      {/* Submit */}
      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={() => onRate(ratings, cascadingMessages || undefined)}
          disabled={!allRated && attendees.length > 0}
        >
          End Meeting
        </Button>
      </div>

      {!allRated && attendees.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          All attendees must provide a rating to end the meeting
        </p>
      )}
    </div>
  );
}
