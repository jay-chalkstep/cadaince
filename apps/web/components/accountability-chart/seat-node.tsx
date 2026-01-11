"use client";

import { memo, useCallback } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { User, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
 * Handle styles - subtle but visible, highlight on hover via CSS
 */
const handleStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  background: "#94a3b8", // Subtle gray matching edges
  border: "2px solid #ffffff",
  borderRadius: "50%",
  zIndex: 50,
  transition: "all 0.15s ease",
};

/**
 * SeatNode - Custom React Flow node for accountability chart seats
 *
 * Features:
 * - Auto-scaling based on dimensions prop
 * - Connection handles for creating reporting relationships (like Visio)
 * - GWC indicators
 * - Avatar display (single or unit)
 */
function SeatNodeComponent({ data, selected }: NodeProps<SeatNodeType>) {
  const { seat, dimensions, onSeatClick, onAddChild } = data;

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

  return (
    <div className="relative group">
      {/* Top handle - this seat can RECEIVE a reporting line (drop here to make something report TO this seat) */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        isConnectable={true}
        isConnectableStart={false}
        isConnectableEnd={true}
        style={handleStyle}
        className="!bg-slate-400 hover:!bg-green-500 hover:!scale-150"
      />

      <Card
        className={cn(
          "transition-all border-2",
          selected && "ring-2 ring-primary ring-offset-2"
        )}
        style={{
          width: dimensions.width,
          minHeight: dimensions.height,
          borderColor:
            seat.color ||
            (hasAssignment ? "hsl(var(--border))" : "hsl(var(--muted))"),
        }}
        onClick={handleClick}
      >
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
            <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
              {seat.pillars && seat.pillars.length > 0 ? (
                <Badge variant="secondary" className={cn(badgeSize)}>
                  {/* Show all pillars with slash separator, primary first */}
                  {[
                    ...seat.pillars.filter(p => p.is_primary),
                    ...seat.pillars.filter(p => !p.is_primary)
                  ].map(p => p.name).join("/")}
                </Badge>
              ) : seat.pillar ? (
                <Badge variant="secondary" className={cn(badgeSize)}>
                  {seat.pillar.name}
                </Badge>
              ) : null}
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

      {/* Bottom handle - drag FROM here to reparent this seat (this seat will report to the drop target) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        isConnectable={true}
        isConnectableStart={true}
        isConnectableEnd={false}
        style={handleStyle}
        className="!bg-slate-400 hover:!bg-blue-500 hover:!scale-150"
      />
    </div>
  );
}

export const SeatNode = memo(SeatNodeComponent);
