"use client";

import { Plus, Check, X, User } from "lucide-react";
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
  team_member: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    email: string;
    title: string | null;
  };
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
  gets_it: boolean;
  wants_it: boolean;
  capacity_to_do: boolean;
  core_values_match: boolean;
  color: string | null;
  assignments: Assignment[];
}

interface SeatCardProps {
  seat: Seat;
  onClick: () => void;
  onAddChild: () => void;
}

export function SeatCard({ seat, onClick, onAddChild }: SeatCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const primaryAssignment = seat.assignments?.find((a) => a.is_primary);
  const hasAssignment = seat.assignments && seat.assignments.length > 0;
  const allGwc = seat.gets_it && seat.wants_it && seat.capacity_to_do;

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
          <div className="text-center mb-3">
            <h3 className="font-semibold text-base">{seat.name}</h3>
            {seat.pillar && (
              <Badge variant="secondary" className="mt-1 text-xs">
                {seat.pillar.name}
              </Badge>
            )}
          </div>

          {/* Assignee */}
          <div className="flex justify-center mb-3">
            {primaryAssignment ? (
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

          {/* Roles preview */}
          {seat.roles && seat.roles.length > 0 && (
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
