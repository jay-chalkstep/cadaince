"use client";

import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, CircleDot, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ParentRock {
  id: string;
  title: string;
  rock_level: "company" | "pillar";
  owner?: {
    id: string;
    full_name: string;
  } | null;
  team?: {
    id: string;
    name: string;
  } | null;
}

interface ParentRockSelectorProps {
  value?: string | null;
  onChange: (rockId: string | null) => void;
  rockLevel: "pillar" | "individual";
  quarterId?: string;
  teamId?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Get the parent level for a given rock level
 */
function getParentLevel(level: "pillar" | "individual"): "company" | "pillar" {
  return level === "pillar" ? "company" : "pillar";
}

/**
 * ParentRockSelector - Dropdown to select a parent rock for cascade linking
 */
export function ParentRockSelector({
  value,
  onChange,
  rockLevel,
  quarterId,
  teamId,
  disabled = false,
  className,
}: ParentRockSelectorProps) {
  const [open, setOpen] = useState(false);
  const [rocks, setRocks] = useState<ParentRock[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRock, setSelectedRock] = useState<ParentRock | null>(null);

  const parentLevel = getParentLevel(rockLevel);

  // Fetch available parent rocks
  useEffect(() => {
    const fetchRocks = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("level", parentLevel);
        if (quarterId) {
          params.set("quarter_id", quarterId);
        }
        if (teamId && parentLevel === "pillar") {
          params.set("team_id", teamId);
        }

        const res = await fetch(`/api/rocks?${params}`);
        if (res.ok) {
          const data = await res.json();
          setRocks(data.rocks || []);

          // Find selected rock if value is set
          if (value) {
            const found = data.rocks?.find((r: ParentRock) => r.id === value);
            setSelectedRock(found || null);
          }
        }
      } catch (error) {
        console.error("Failed to fetch parent rocks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRocks();
  }, [parentLevel, quarterId, teamId, value]);

  const handleSelect = (rock: ParentRock | null) => {
    setSelectedRock(rock);
    onChange(rock?.id || null);
    setOpen(false);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "justify-between flex-1 min-w-0",
              !selectedRock && "text-muted-foreground"
            )}
          >
            <span className="truncate">
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </span>
              ) : selectedRock ? (
                <span className="flex items-center gap-2">
                  <CircleDot className="h-4 w-4 shrink-0" />
                  {selectedRock.title}
                </span>
              ) : (
                `Select parent ${parentLevel} rock...`
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Search ${parentLevel} rocks...`} />
            <CommandList>
              <CommandEmpty>
                No {parentLevel} rocks found for this quarter.
              </CommandEmpty>
              <CommandGroup>
                {rocks.map((rock) => (
                  <CommandItem
                    key={rock.id}
                    value={rock.title}
                    onSelect={() => handleSelect(rock)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedRock?.id === rock.id
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{rock.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        {rock.owner && <span>{rock.owner.full_name}</span>}
                        {rock.team && (
                          <>
                            {rock.owner && <span>•</span>}
                            <span>{rock.team.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className="ml-2 shrink-0 text-[10px]"
                    >
                      {rock.rock_level}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Clear button */}
      {selectedRock && !disabled && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => handleSelect(null)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Clear selection</span>
        </Button>
      )}
    </div>
  );
}

interface ParentRockDisplayProps {
  parentRockId: string;
  className?: string;
}

/**
 * ParentRockDisplay - Shows the linked parent rock
 */
export function ParentRockDisplay({
  parentRockId,
  className,
}: ParentRockDisplayProps) {
  const [rock, setRock] = useState<ParentRock | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRock = async () => {
      try {
        const res = await fetch(`/api/rocks/${parentRockId}`);
        if (res.ok) {
          const data = await res.json();
          setRock(data.rock);
        }
      } catch (error) {
        console.error("Failed to fetch parent rock:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRock();
  }, [parentRockId]);

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading parent rock...
      </div>
    );
  }

  if (!rock) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <CircleDot className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm">
        Supports:{" "}
        <span className="font-medium">{rock.title}</span>
      </span>
      <Badge variant="secondary" className="text-[10px]">
        {rock.rock_level}
      </Badge>
    </div>
  );
}

interface CascadeLinkProps {
  rockId: string;
  rockLevel: "pillar" | "individual";
  parentRockId?: string | null;
  quarterId?: string;
  teamId?: string;
  onUpdate?: () => void;
  className?: string;
}

/**
 * CascadeLink - Inline editor for rock cascade linking
 */
export function CascadeLink({
  rockId,
  rockLevel,
  parentRockId,
  quarterId,
  teamId,
  onUpdate,
  className,
}: CascadeLinkProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentParentId, setCurrentParentId] = useState<string | null>(
    parentRockId || null
  );

  const handleSave = async (newParentId: string | null) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/rocks/${rockId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_rock_id: newParentId }),
      });

      if (res.ok) {
        setCurrentParentId(newParentId);
        setEditing(false);
        onUpdate?.();
      }
    } catch (error) {
      console.error("Failed to update parent rock:", error);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className={cn("space-y-2", className)}>
        <ParentRockSelector
          value={currentParentId}
          onChange={handleSave}
          rockLevel={rockLevel}
          quarterId={quarterId}
          teamId={teamId}
          disabled={saving}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing(false)}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    );
  }

  if (currentParentId) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded p-1 -m-1",
          className
        )}
        onClick={() => setEditing(true)}
      >
        <ParentRockDisplay parentRockId={currentParentId} />
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("text-muted-foreground", className)}
      onClick={() => setEditing(true)}
    >
      <CircleDot className="h-4 w-4 mr-2" />
      Link to parent rock
    </Button>
  );
}
