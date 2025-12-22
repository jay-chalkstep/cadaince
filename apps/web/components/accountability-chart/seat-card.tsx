"use client";

import { Plus, Check, X, User, Users } from "lucide-react";
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

interface Assignment {
  id: string;
  is_primary: boolean;
  assignment_type?: "holder" | "co-holder" | "backup" | "fractional" | "dotted-line";
  team_member: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    email: string;
    title: string | null;
  };
}

interface SeatFunction {
  id: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  is_eos_default: boolean;
}

interface FunctionAssignment {
  id: string;
  assignment_type: "primary" | "shared" | "supporting";
  sort_order: number;
  function: SeatFunction;
}

interface Seat {
  id: string;
  name: string;
  pillar: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  roles: string[];
  seat_type?: "single" | "unit";
  eos_role?: "visionary" | "integrator" | "leader" | null;
  display_as_unit?: boolean;
  gets_it: boolean;
  wants_it: boolean;
  capacity_to_do: boolean;
  core_values_match: boolean;
  color: string | null;
  assignments: Assignment[];
  function_assignments?: FunctionAssignment[];
}

interface SeatCardProps {
  seat: Seat;
  onClick: () => void;
  onAddChild: () => void;
}

const ASSIGNMENT_TYPE_LABELS: Record<string, string> = {
  holder: "",
  "co-holder": "Co-Holder",
  backup: "Backup",
  fractional: "Fractional",
  "dotted-line": "Dotted Line",
};

const EOS_ROLE_LABELS: Record<string, string> = {
  visionary: "V",
  integrator: "I",
  leader: "L",
};

export function SeatCard({ seat, onClick, onAddChild }: SeatCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isUnit = seat.seat_type === "unit" && seat.display_as_unit;
  const coHolders = seat.assignments?.filter(
    (a) => a.assignment_type === "co-holder" || a.assignment_type === "holder"
  ) || [];
  const otherAssignments = seat.assignments?.filter(
    (a) => a.assignment_type !== "co-holder" && a.assignment_type !== "holder"
  ) || [];

  const primaryAssignment = seat.assignments?.find((a) => a.is_primary);
  const hasAssignment = seat.assignments && seat.assignments.length > 0;
  const allGwc = seat.gets_it && seat.wants_it && seat.capacity_to_do;

  // Get primary functions to display
  const primaryFunctions = seat.function_assignments?.filter(
    (fa) => fa.assignment_type === "primary"
  ) || [];

  return (
    <div className="relative group">
      <Card
        className="w-64 cursor-pointer hover:shadow-md transition-shadow border-2"
        style={{
          borderColor: seat.color || (hasAssignment ? "hsl(var(--border))" : "hsl(var(--muted))"),
        }}
        onClick={onClick}
      >
        <CardContent className="p-4">
          {/* Header with name and EOS role badge */}
          <div className="text-center mb-3">
            <div className="flex items-center justify-center gap-2">
              <h3 className="font-semibold text-base">{seat.name}</h3>
              {seat.eos_role && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="h-5 w-5 p-0 flex items-center justify-center text-xs font-bold"
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
            {seat.pillar && (
              <Badge variant="secondary" className="mt-1 text-xs">
                {seat.pillar.name}
              </Badge>
            )}
            {isUnit && (
              <Badge variant="outline" className="mt-1 ml-1 text-xs">
                <Users className="h-3 w-3 mr-1" />
                Unit
              </Badge>
            )}
          </div>

          {/* Assignees - Unit view (side by side) or single view */}
          <div className="flex justify-center mb-3">
            {isUnit && coHolders.length > 0 ? (
              // Unit display: co-holders side by side
              <div className="flex flex-col items-center">
                <div className="flex -space-x-2 mb-1">
                  {coHolders.slice(0, 3).map((assignment, idx) => (
                    <TooltipProvider key={assignment.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Avatar
                            className="h-10 w-10 border-2 border-background"
                            style={{ zIndex: coHolders.length - idx }}
                          >
                            <AvatarImage
                              src={assignment.team_member.avatar_url || undefined}
                            />
                            <AvatarFallback>
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
                <span className="text-sm font-medium text-center">
                  {coHolders
                    .slice(0, 2)
                    .map((a) => a.team_member.full_name.split(" ")[0])
                    .join(" + ")}
                  {coHolders.length > 2 && ` +${coHolders.length - 2}`}
                </span>
              </div>
            ) : primaryAssignment ? (
              // Single seat display
              <div className="flex flex-col items-center">
                <Avatar className="h-12 w-12 mb-1">
                  <AvatarImage src={primaryAssignment.team_member.avatar_url || undefined} />
                  <AvatarFallback>
                    {getInitials(primaryAssignment.team_member.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">
                  {primaryAssignment.team_member.full_name}
                </span>
                {primaryAssignment.team_member.title && (
                  <span className="text-xs text-muted-foreground">
                    {primaryAssignment.team_member.title}
                  </span>
                )}
                {primaryAssignment.assignment_type &&
                  primaryAssignment.assignment_type !== "holder" && (
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {ASSIGNMENT_TYPE_LABELS[primaryAssignment.assignment_type]}
                    </Badge>
                  )}
              </div>
            ) : (
              <div className="flex flex-col items-center text-muted-foreground">
                <div className="h-12 w-12 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center mb-1">
                  <User className="h-6 w-6" />
                </div>
                <span className="text-sm">Open Seat</span>
              </div>
            )}
          </div>

          {/* Other assignments (backup, fractional, etc.) */}
          {otherAssignments.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1 mb-2">
              {otherAssignments.map((assignment) => (
                <TooltipProvider key={assignment.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {assignment.team_member.full_name.split(" ")[0]}
                        {" • "}
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
              <div className="flex justify-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        seat.gets_it
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
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
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        seat.wants_it
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
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
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        seat.capacity_to_do
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
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

          {/* Functions preview (if using functions) */}
          {primaryFunctions.length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground text-center">
              {primaryFunctions
                .slice(0, 2)
                .map((fa) => fa.function.name)
                .join(" • ")}
              {primaryFunctions.length > 2 && ` +${primaryFunctions.length - 2}`}
            </div>
          )}

          {/* Roles preview (legacy, if no functions) */}
          {primaryFunctions.length === 0 && seat.roles && seat.roles.length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground text-center">
              {seat.roles.slice(0, 2).join(" • ")}
              {seat.roles.length > 2 && ` +${seat.roles.length - 2}`}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Child Button */}
      <Button
        size="sm"
        variant="outline"
        className="absolute -bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 rounded-full"
        onClick={(e) => {
          e.stopPropagation();
          onAddChild();
        }}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}
