"use client";

import { memo, useCallback, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { GripVertical, Plus, User, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  type SeatNodeData,
  type SeatNode as SeatNodeType,
  ASSIGNMENT_TYPE_LABELS,
  EOS_ROLE_LABELS,
  getInitials,
} from "./types";

/**
 * SeatNode - Custom React Flow node for accountability chart seats
 *
 * Features:
 * - Auto-scaling based on dimensions prop
 * - Drag-to-reparent drop zone detection
 * - GWC indicators
 * - Avatar display (single or unit)
 */
function SeatNodeComponent({ data, selected }: NodeProps<SeatNodeType>) {
  const { seat, dimensions, onSeatClick, onAddChild, onDrop } = data;
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverSelf, setDragOverSelf] = useState(false);

  const isUnit = seat.seat_type === "unit" && seat.display_as_unit;
  const coHolders =
    seat.assignments?.filter(
      (a) => a.assignment_type === "co-holder" || a.assignment_type === "holder"
    ) || [];
  const otherAssignments =
    seat.assignments?.filter(
      (a) => a.assignment_type !== "co-holder" && a.assignment_type !== "holder"
    ) || [];

  const primaryAssignment = seat.assignments?.find((a) => a.is_primary);
  const hasAssignment = seat.assignments && seat.assignments.length > 0;

  // Scale factors based on dimensions
  const isCompact = dimensions.width <= 200;
  const isStandard = dimensions.width <= 240 && dimensions.width > 200;
  const avatarSize = isCompact ? "h-8 w-8" : isStandard ? "h-10 w-10" : "h-12 w-12";
  const nameSize = isCompact ? "text-xs" : "text-sm";
  const titleSize = isCompact ? "text-[10px]" : "text-xs";
  const badgeSize = isCompact ? "text-[9px]" : "text-[10px]";
  const gwcSize = isCompact ? "w-5 h-5 text-[10px]" : "w-6 h-6 text-xs";

  const handleClick = useCallback(() => {
    onSeatClick(seat);
  }, [seat, onSeatClick]);

  const handleAddChild = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onAddChild(seat);
    },
    [seat, onAddChild]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.types.includes("text/plain")
        ? e.dataTransfer.getData("text/plain")
        : null;

      // Check if dragging over self (getData doesn't work during dragover in some browsers)
      // We'll check the actual ID in handleDropEvent
      e.dataTransfer.dropEffect = "move";
      setIsDragOver(true);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
    setDragOverSelf(false);
  }, []);

  const handleDropEvent = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      setDragOverSelf(false);
      const draggedId = e.dataTransfer.getData("text/plain");
      if (draggedId && draggedId !== seat.id && onDrop) {
        onDrop(draggedId, seat.id);
      }
    },
    [seat.id, onDrop]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", seat.id);
      e.dataTransfer.effectAllowed = "move";
      setIsDragging(true);
    },
    [seat.id]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="relative group">
      {/* Top handle for incoming connections */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-transparent !border-0 !w-4 !h-4"
      />

      <Card
        className={cn(
          "transition-all border-2",
          selected && "ring-2 ring-primary ring-offset-2",
          // Valid drop target - green ring
          isDragOver && !isDragging && "ring-2 ring-green-500 ring-offset-2 bg-green-50/50",
          // Dragging this card - reduced opacity
          isDragging && "opacity-50 ring-2 ring-dashed ring-muted-foreground"
        )}
        style={{
          width: dimensions.width,
          minHeight: dimensions.height,
          borderColor:
            seat.color ||
            (hasAssignment ? "hsl(var(--border))" : "hsl(var(--muted))"),
        }}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropEvent}
      >
        {/* Drag handle - visible on hover, this triggers reparenting */}
        <div className="absolute -left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="p-1 rounded bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing"
                  draggable
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <GripVertical className="h-4 w-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Drag to change reporting</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Drop indicator label */}
        {isDragOver && !isDragging && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded whitespace-nowrap z-10">
            Drop to assign
          </div>
        )}
        <CardContent className={cn("p-3", isCompact && "p-2")}>
          {/* Header with name and EOS role badge */}
          <div className="text-center mb-2">
            <div className="flex items-center justify-center gap-1.5">
              <h3
                className={cn(
                  "font-semibold truncate",
                  isCompact ? "text-sm" : "text-base"
                )}
              >
                {seat.name}
              </h3>
              {seat.eos_role && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className={cn(
                          "flex items-center justify-center font-bold shrink-0",
                          isCompact
                            ? "h-4 w-4 p-0 text-[9px]"
                            : "h-5 w-5 p-0 text-xs"
                        )}
                      >
                        {EOS_ROLE_LABELS[seat.eos_role]}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="capitalize">{seat.eos_role}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="flex items-center justify-center gap-1 mt-1">
              {seat.pillar && (
                <Badge variant="secondary" className={cn(badgeSize)}>
                  {seat.pillar.name}
                </Badge>
              )}
              {isUnit && (
                <Badge variant="outline" className={cn(badgeSize)}>
                  <Users className="h-3 w-3 mr-0.5" />
                  Unit
                </Badge>
              )}
            </div>
          </div>

          {/* Assignees */}
          <div className="flex justify-center mb-2">
            {isUnit && coHolders.length > 0 ? (
              <div className="flex flex-col items-center">
                <div className="flex -space-x-2 mb-1">
                  {coHolders.slice(0, 3).map((assignment, idx) => (
                    <TooltipProvider key={assignment.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Avatar
                            className={cn(avatarSize, "border-2 border-background")}
                            style={{ zIndex: coHolders.length - idx }}
                          >
                            <AvatarImage
                              src={assignment.team_member.avatar_url ?? undefined}
                            />
                            <AvatarFallback className="text-[10px]">
                              {getInitials(assignment.team_member.full_name)}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{assignment.team_member.full_name}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
                <span className={cn(nameSize, "font-medium text-center truncate max-w-full")}>
                  {coHolders
                    .slice(0, 2)
                    .map((a) => a.team_member.full_name.split(" ")[0])
                    .join(" + ")}
                  {coHolders.length > 2 && ` +${coHolders.length - 2}`}
                </span>
              </div>
            ) : primaryAssignment ? (
              <div className="flex flex-col items-center">
                <Avatar className={cn(avatarSize, "mb-1")}>
                  <AvatarImage
                    src={primaryAssignment.team_member.avatar_url ?? undefined}
                  />
                  <AvatarFallback className={isCompact ? "text-[10px]" : "text-xs"}>
                    {getInitials(primaryAssignment.team_member.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className={cn(nameSize, "font-medium truncate max-w-full")}>
                  {primaryAssignment.team_member.full_name}
                </span>
                {primaryAssignment.team_member.title && !isCompact && (
                  <span className={cn(titleSize, "text-muted-foreground truncate max-w-full")}>
                    {primaryAssignment.team_member.title}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center text-muted-foreground">
                <div
                  className={cn(
                    avatarSize,
                    "rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center mb-1"
                  )}
                >
                  <User className={isCompact ? "h-4 w-4" : "h-5 w-5"} />
                </div>
                <span className={cn(nameSize)}>Open Seat</span>
              </div>
            )}
          </div>

          {/* Other assignments */}
          {otherAssignments.length > 0 && !isCompact && (
            <div className="flex flex-wrap justify-center gap-1 mb-2">
              {otherAssignments.slice(0, 2).map((assignment) => (
                <TooltipProvider key={assignment.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className={cn(badgeSize, "px-1.5 py-0")}>
                        {assignment.team_member.full_name.split(" ")[0]}
                        {" "}
                        {ASSIGNMENT_TYPE_LABELS[assignment.assignment_type || "holder"]}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {assignment.team_member.full_name} (
                        {ASSIGNMENT_TYPE_LABELS[assignment.assignment_type || "holder"]})
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          )}

          {/* GWC Indicators */}
          {hasAssignment && (
            <TooltipProvider>
              <div className="flex justify-center gap-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        gwcSize,
                        "rounded-full flex items-center justify-center font-bold",
                        seat.gets_it
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      )}
                    >
                      G
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Gets It: {seat.gets_it ? "Yes" : "No"}</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        gwcSize,
                        "rounded-full flex items-center justify-center font-bold",
                        seat.wants_it
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      )}
                    >
                      W
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Wants It: {seat.wants_it ? "Yes" : "No"}</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        gwcSize,
                        "rounded-full flex items-center justify-center font-bold",
                        seat.capacity_to_do
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      )}
                    >
                      C
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Capacity: {seat.capacity_to_do ? "Yes" : "No"}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      {/* Add Child Button */}
      <Button
        size="sm"
        variant="outline"
        className={cn(
          "absolute -bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity rounded-full",
          isCompact ? "h-5 w-5 p-0" : "h-6 w-6 p-0"
        )}
        onClick={handleAddChild}
      >
        <Plus className={isCompact ? "h-2.5 w-2.5" : "h-3 w-3"} />
      </Button>

      {/* Bottom handle for outgoing connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-transparent !border-0 !w-4 !h-4"
      />
    </div>
  );
}

export const SeatNode = memo(SeatNodeComponent);
