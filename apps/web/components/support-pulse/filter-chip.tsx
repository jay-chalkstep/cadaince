"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FilterChipProps {
  label: string;
  onClear: () => void;
}

export function FilterChip({ label, onClear }: FilterChipProps) {
  return (
    <Badge
      variant="secondary"
      className="gap-1 pr-1 hover:bg-secondary cursor-default"
    >
      {label}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}
