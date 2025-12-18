"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Headline {
  id: string;
  text: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

interface HeadlineCaptureProps {
  headlines: Headline[];
  onAdd: (text: string) => Promise<void>;
  onRemove: (headlineId: string) => Promise<void>;
}

export function HeadlineCapture({ headlines, onAdd, onRemove }: HeadlineCaptureProps) {
  const [newHeadline, setNewHeadline] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newHeadline.trim()) return;
    setAdding(true);
    await onAdd(newHeadline.trim());
    setNewHeadline("");
    setAdding(false);
  };

  const handleRemove = async (headlineId: string) => {
    setRemoving(headlineId);
    await onRemove(headlineId);
    setRemoving(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
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
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Share good news, updates, and important information with the team.
      </p>

      {/* Add new headline */}
      <div className="flex gap-2">
        <Input
          placeholder="Share a headline..."
          value={newHeadline}
          onChange={(e) => setNewHeadline(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={adding}
        />
        <Button onClick={handleAdd} disabled={adding || !newHeadline.trim()}>
          {adding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Headlines list */}
      {headlines.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No headlines shared yet. Be the first!
        </div>
      ) : (
        <div className="space-y-2">
          {headlines.map((headline) => (
            <div
              key={headline.id}
              className="flex items-start gap-3 rounded-lg bg-muted/50 p-3"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {getInitials(headline.author_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm">{headline.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {headline.author_name} •{" "}
                  {new Date(headline.created_at).toLocaleTimeString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemove(headline.id)}
                disabled={removing === headline.id}
              >
                {removing === headline.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
