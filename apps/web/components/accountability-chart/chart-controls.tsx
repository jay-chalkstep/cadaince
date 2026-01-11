"use client";

import { memo } from "react";
import {
  LayoutGrid,
  Move,
  Maximize2,
  Map,
  Save,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LayoutMode } from "./types";

interface ChartControlsProps {
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;
  onAutoLayout: () => void;
  onFitView: () => void;
  showMinimap: boolean;
  onMinimapToggle: (show: boolean) => void;
  isSaving?: boolean;
  pendingUpdates?: number;
  lastSavedAt?: Date | null;
}

/**
 * ChartControls - Toolbar for accountability chart controls
 *
 * Features:
 * - Layout mode toggle (Auto/Manual)
 * - Re-layout button (applies dagre to current positions)
 * - Fit to view button
 * - Minimap toggle
 * - Save status indicator
 */
function ChartControlsComponent({
  layoutMode,
  onLayoutModeChange,
  onAutoLayout,
  onFitView,
  showMinimap,
  onMinimapToggle,
  isSaving,
  pendingUpdates,
  lastSavedAt,
}: ChartControlsProps) {
  return (
    <TooltipProvider>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border rounded-lg p-2 shadow-sm">
        {/* Layout Mode Toggle */}
        <div className="flex items-center gap-1 border-r pr-2 mr-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                pressed={layoutMode === "auto"}
                onPressedChange={(pressed) =>
                  onLayoutModeChange(pressed ? "auto" : "manual")
                }
                size="sm"
                aria-label="Auto layout mode"
              >
                <LayoutGrid className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>
              <p>Auto Layout: {layoutMode === "auto" ? "On" : "Off"}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                pressed={layoutMode === "manual"}
                onPressedChange={(pressed) =>
                  onLayoutModeChange(pressed ? "manual" : "auto")
                }
                size="sm"
                aria-label="Manual layout mode"
              >
                <Move className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>
              <p>Manual Layout: {layoutMode === "manual" ? "On" : "Off"}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Re-layout Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onAutoLayout}
              className="h-8 w-8 p-0"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Re-layout (apply auto-layout)</p>
          </TooltipContent>
        </Tooltip>

        {/* Fit to View */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onFitView}
              className="h-8 w-8 p-0"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Fit to view</p>
          </TooltipContent>
        </Tooltip>

        {/* Minimap Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              pressed={showMinimap}
              onPressedChange={onMinimapToggle}
              size="sm"
              aria-label="Toggle minimap"
            >
              <Map className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            <p>Minimap: {showMinimap ? "On" : "Off"}</p>
          </TooltipContent>
        </Tooltip>

        {/* Save Status */}
        {(isSaving || pendingUpdates !== undefined && pendingUpdates > 0 || lastSavedAt) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground border-l pl-2 ml-1">
            {isSaving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Saving...</span>
              </>
            ) : pendingUpdates !== undefined && pendingUpdates > 0 ? (
              <>
                <Save className="h-3 w-3" />
                <span>{pendingUpdates} pending</span>
              </>
            ) : lastSavedAt ? (
              <>
                <Check className="h-3 w-3 text-green-600" />
                <span>Saved</span>
              </>
            ) : null}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export const ChartControls = memo(ChartControlsComponent);
