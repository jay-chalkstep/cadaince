"use client";

import { useState } from "react";
import { SmilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ReactionBarProps {
  reactions: Record<string, string[]>;
  currentUserId: string | null;
  onReaction: (emoji: string) => void;
}

const EMOJI_OPTIONS = ["🎉", "👏", "🔥", "❤️", "🙌", "💯", "🚀", "⭐"];

export function ReactionBar({ reactions, currentUserId, onReaction }: ReactionBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleEmojiClick = (emoji: string) => {
    onReaction(emoji);
    setMenuOpen(false);
  };

  const reactionEntries = Object.entries(reactions || {}).filter(
    ([, users]) => users.length > 0
  );

  return (
    <div className="flex items-center gap-2 mt-3 flex-wrap">
      {reactionEntries.map(([emoji, users]) => {
        const hasReacted = currentUserId && users.includes(currentUserId);
        return (
          <Button
            key={emoji}
            variant="outline"
            size="sm"
            className={`h-7 px-2 gap-1 ${
              hasReacted ? "bg-blue-50 border-blue-200" : ""
            }`}
            onClick={() => onReaction(emoji)}
          >
            <span>{emoji}</span>
            <span className="text-xs">{users.length}</span>
          </Button>
        );
      })}

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <SmilePlus className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="p-2" align="start">
          <div className="flex gap-1">
            {EMOJI_OPTIONS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-lg"
                onClick={() => handleEmojiClick(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
