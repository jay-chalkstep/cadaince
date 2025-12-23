"use client";

import { CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgendaItem {
  id: string;
  section: string;
  duration_minutes: number;
  started_at: string | null;
  completed_at: string | null;
}

interface AgendaSidebarProps {
  items: AgendaItem[];
  activeItemId: string | null;
  onItemClick: (itemId: string) => void;
}

const SECTION_LABELS: Record<string, string> = {
  segue: "Segue",
  scorecard: "Scorecard",
  rocks: "Rock Review",
  headlines: "Headlines",
  todos: "To-Do List",
  ids: "IDS",
  conclude: "Conclude",
};

const SECTION_DESCRIPTIONS: Record<string, string> = {
  segue: "Good news, personal/professional",
  scorecard: "Review key metrics",
  rocks: "Quarterly priorities",
  headlines: "What's happening",
  todos: "Review 7-day actions",
  ids: "Identify, Discuss, Solve",
  conclude: "Wrap up & rate",
};

export function AgendaSidebar({ items, activeItemId, onItemClick }: AgendaSidebarProps) {
  return (
    <div className="w-64 border-r bg-muted/30 p-4 space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground mb-4">AGENDA</h2>
      {items.map((item) => {
        const isActive = item.id === activeItemId;
        const isComplete = item.completed_at !== null;
        const isPending = !item.started_at && !item.completed_at;

        return (
          <button
            key={item.id}
            onClick={() => onItemClick(item.id)}
            className={cn(
              "w-full text-left rounded-lg p-3 transition-colors",
              isActive && "bg-primary text-primary-foreground",
              isComplete && !isActive && "bg-muted text-muted-foreground",
              isPending && !isActive && "hover:bg-muted/50"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {isComplete ? (
                  <CheckCircle2 className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-green-600")} />
                ) : isActive ? (
                  <PlayCircle className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">
                    {SECTION_LABELS[item.section] || item.section}
                  </span>
                  <span className={cn(
                    "text-xs",
                    isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}>
                    {item.duration_minutes}m
                  </span>
                </div>
                <p className={cn(
                  "text-xs truncate",
                  isActive ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  {SECTION_DESCRIPTIONS[item.section]}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
