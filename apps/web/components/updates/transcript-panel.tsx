"use client";

import { useEffect, useRef, useMemo } from "react";
import { FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Word-level timestamp data matching Deepgram output
export interface TranscriptWord {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

export interface StructuredTranscript {
  text: string;
  words: TranscriptWord[];
}

interface TranscriptPanelProps {
  transcript: StructuredTranscript | null;
  currentTime: number;
  onWordClick: (time: number) => void;
  className?: string;
}

export function TranscriptPanel({
  transcript,
  currentTime,
  onWordClick,
  className,
}: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);

  // Find the currently active word based on playback time
  const activeWordIndex = useMemo(() => {
    if (!transcript?.words) return -1;
    return transcript.words.findIndex(
      (word) => currentTime >= word.start && currentTime < word.end
    );
  }, [transcript?.words, currentTime]);

  // Auto-scroll to keep active word visible
  useEffect(() => {
    if (activeWordRef.current && scrollRef.current) {
      const wordElement = activeWordRef.current;
      const scrollContainer = scrollRef.current;

      const wordRect = wordElement.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();

      // Only scroll if word is outside visible area
      if (wordRect.top < containerRect.top || wordRect.bottom > containerRect.bottom) {
        wordElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [activeWordIndex]);

  if (!transcript) {
    return (
      <div className={cn("flex items-center justify-center p-6 text-muted-foreground", className)}>
        <div className="text-center">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No transcript available</p>
        </div>
      </div>
    );
  }

  // If we have words with timestamps, render interactive transcript
  if (transcript.words && transcript.words.length > 0) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Transcript</span>
          <span className="text-xs text-muted-foreground">
            (click to seek)
          </span>
        </div>
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="p-4 leading-relaxed">
            {transcript.words.map((word, index) => {
              const isActive = index === activeWordIndex;
              const isPast = currentTime >= word.end;

              return (
                <span
                  key={`${word.start}-${index}`}
                  ref={isActive ? activeWordRef : null}
                  onClick={() => onWordClick(word.start)}
                  className={cn(
                    "cursor-pointer transition-colors duration-150 rounded px-0.5 -mx-0.5",
                    "hover:bg-primary/10",
                    isActive && "bg-primary/20 text-primary font-medium",
                    isPast && !isActive && "text-muted-foreground"
                  )}
                >
                  {word.word}{" "}
                </span>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Fallback: plain text transcript without timestamps
  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Transcript</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {transcript.text}
          </p>
        </div>
      </ScrollArea>
    </div>
  );
}
