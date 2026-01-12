"use client";

import { CalendarDays } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { TimeFrameDays, TimeFrameOption } from "@/types/support-pulse";

const TIME_FRAME_OPTIONS: TimeFrameOption[] = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 10 days", value: 10 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
  { label: "Custom range", value: "custom" },
];

interface TimeFrameSelectorProps {
  value: TimeFrameDays;
  onChange: (value: TimeFrameDays) => void;
  customRange: { start: Date; end: Date } | null;
  onCustomRangeChange: (range: { start: Date; end: Date } | null) => void;
}

export function TimeFrameSelector({
  value,
  onChange,
  customRange,
  onCustomRangeChange,
}: TimeFrameSelectorProps) {
  const handleValueChange = (newValue: string) => {
    if (newValue === "custom") {
      onChange("custom");
      // Set default custom range to last 30 days
      if (!customRange) {
        const end = new Date();
        const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        onCustomRangeChange({ start, end });
      }
    } else {
      onChange(parseInt(newValue, 10) as TimeFrameDays);
      onCustomRangeChange(null);
    }
  };

  const displayValue = value === "custom" && customRange
    ? `${format(customRange.start, "MMM d")} - ${format(customRange.end, "MMM d")}`
    : TIME_FRAME_OPTIONS.find((o) => o.value === value)?.label || "Last 10 days";

  return (
    <div className="flex items-center gap-2">
      <Select
        value={String(value)}
        onValueChange={handleValueChange}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue>{displayValue}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {TIME_FRAME_OPTIONS.map((option) => (
            <SelectItem key={String(option.value)} value={String(option.value)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value === "custom" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon">
              <CalendarDays className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={
                customRange
                  ? { from: customRange.start, to: customRange.end }
                  : undefined
              }
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  onCustomRangeChange({ start: range.from, end: range.to });
                }
              }}
              numberOfMonths={2}
              className={cn("rounded-md border")}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
