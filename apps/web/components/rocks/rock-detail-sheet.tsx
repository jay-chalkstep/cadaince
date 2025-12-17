"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Rock {
  id: string;
  name: string;
  description: string | null;
  status: "not_started" | "on_track" | "off_track" | "complete";
  quarter: number;
  year: number;
  owner: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  pillar: {
    id: string;
    name: string;
  } | null;
}

interface RockDetailSheetProps {
  rock: Rock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const statusConfig = {
  not_started: { label: "Not Started", color: "bg-gray-500" },
  on_track: { label: "On Track", color: "bg-green-600" },
  off_track: { label: "Off Track", color: "bg-red-600" },
  complete: { label: "Complete", color: "bg-blue-600" },
};

export function RockDetailSheet({
  rock,
  open,
  onOpenChange,
  onUpdate,
}: RockDetailSheetProps) {
  const [updating, setUpdating] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!rock) return;

    setUpdating(true);
    try {
      const response = await fetch(`/api/rocks/${rock.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to update rock status:", error);
    } finally {
      setUpdating(false);
    }
  };

  if (!rock) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{rock.name}</SheetTitle>
          <SheetDescription>
            Q{rock.quarter} {rock.year}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select
              value={rock.status}
              onValueChange={handleStatusChange}
              disabled={updating}
            >
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {updating && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Badge
                      variant="outline"
                      className={statusConfig[rock.status].color + " text-white border-0"}
                    >
                      {statusConfig[rock.status].label}
                    </Badge>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusConfig).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    <Badge
                      variant="outline"
                      className={config.color + " text-white border-0"}
                    >
                      {config.label}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pillar */}
          {rock.pillar && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Pillar</label>
              <Badge variant="secondary">{rock.pillar.name}</Badge>
            </div>
          )}

          {/* Description */}
          {rock.description && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <p className="text-sm text-muted-foreground">{rock.description}</p>
            </div>
          )}

          <Separator />

          {/* Owner */}
          {rock.owner && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Owner</label>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={rock.owner.avatar_url || undefined} />
                  <AvatarFallback>{getInitials(rock.owner.full_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{rock.owner.full_name}</p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Milestones placeholder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Milestones</label>
              <Button variant="outline" size="sm" disabled>
                Add Milestone
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              No milestones yet. Add milestones to track progress toward completing this rock.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
