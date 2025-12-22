"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MentionAutocomplete } from "./mention-autocomplete";

interface TeamMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
}

interface CommentComposerProps {
  onSubmit: (body: string) => Promise<void>;
  placeholder?: string;
}

export function CommentComposer({
  onSubmit,
  placeholder = "Write a comment... (use @ to mention)",
}: CommentComposerProps) {
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track @ symbol position for autocomplete
  const checkForMention = useCallback(() => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = body.slice(0, cursorPos);

    // Find the last @ symbol before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);

      // Check if there's no space after @ (valid mention in progress)
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setMentionQuery(textAfterAt);
        setCursorPosition(lastAtIndex);

        // Calculate position for autocomplete popup
        // This is a simplified approach - in production you'd want more precise positioning
        const lineHeight = 20;
        const charWidth = 8;
        const lines = textBeforeCursor.split("\n");
        const currentLine = lines.length - 1;
        const currentCol = lines[lines.length - 1].length;

        setMentionPosition({
          top: (currentLine + 1) * lineHeight + 24, // 24px padding
          left: Math.min(currentCol * charWidth, 200),
        });

        setShowMentions(true);
        return;
      }
    }

    setShowMentions(false);
  }, [body]);

  // Check for mentions on body change
  useEffect(() => {
    checkForMention();
  }, [body, checkForMention]);

  const handleMentionSelect = (member: TeamMember) => {
    // Replace @query with @[Name](uuid)
    const beforeMention = body.slice(0, cursorPosition);
    const afterMention = body.slice(
      cursorPosition + 1 + mentionQuery.length
    );
    const mentionText = `@[${member.full_name}](${member.id})`;

    setBody(beforeMention + mentionText + " " + afterMention);
    setShowMentions(false);

    // Focus back on textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleSubmit = async () => {
    if (!body.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(body);
      setBody("");
    } catch (error) {
      console.error("Failed to submit comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[60px] text-sm resize-none"
          disabled={isSubmitting}
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!body.trim() || isSubmitting}
          className="self-end"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {showMentions && (
        <MentionAutocomplete
          query={mentionQuery}
          position={mentionPosition}
          onSelect={handleMentionSelect}
          onClose={() => setShowMentions(false)}
        />
      )}

      <p className="text-xs text-muted-foreground mt-1">
        Press {navigator?.platform?.includes("Mac") ? "Cmd" : "Ctrl"}+Enter to send
      </p>
    </div>
  );
}
