"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import type { HubSpotProperty, HubSpotObject } from "@/lib/integrations/providers/hubspot";

interface HubSpotPropertyPickerProps {
  object: HubSpotObject;
  value: string;
  onChange: (property: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface PropertiesResponse {
  object: string;
  properties: HubSpotProperty[];
  groups: Record<string, HubSpotProperty[]>;
  totalCount: number;
}

export function HubSpotPropertyPicker({
  object,
  value,
  onChange,
  placeholder = "Select property...",
  disabled = false,
}: HubSpotPropertyPickerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<HubSpotProperty[]>([]);
  const [groups, setGroups] = useState<Record<string, HubSpotProperty[]>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchProperties = useCallback(async () => {
    if (!object) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/integrations-v2/hubspot/properties?object=${object}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch properties");
      }

      const data: PropertiesResponse = await response.json();
      setProperties(data.properties);
      setGroups(data.groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch properties");
      setProperties([]);
      setGroups({});
    } finally {
      setLoading(false);
    }
  }, [object]);

  // Fetch properties when object changes
  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  // Find the selected property
  const selectedProperty = properties.find((p) => p.name === value);

  // Get sorted group names for display
  const sortedGroupNames = Object.keys(groups).sort((a, b) => {
    // Put common groups first
    const priority = ["dealinformation", "contactinformation", "companyinformation", "ticketinformation"];
    const aIndex = priority.indexOf(a.toLowerCase());
    const bIndex = priority.indexOf(b.toLowerCase());
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || loading}
        >
          {loading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading properties...
            </span>
          ) : selectedProperty ? (
            <span className="truncate">
              {selectedProperty.label}
              <span className="ml-2 text-muted-foreground text-xs">
                ({selectedProperty.type})
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search properties..." />
          <CommandList>
            {error ? (
              <div className="py-6 text-center text-sm text-destructive">
                {error}
              </div>
            ) : properties.length === 0 && !loading ? (
              <CommandEmpty>No properties found.</CommandEmpty>
            ) : (
              <>
                {sortedGroupNames.map((groupName) => (
                  <CommandGroup key={groupName} heading={formatGroupName(groupName)}>
                    {groups[groupName].map((property) => (
                      <CommandItem
                        key={property.name}
                        value={`${property.name} ${property.label}`}
                        onSelect={() => {
                          onChange(property.name);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === property.name ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span>{property.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {property.name} ({property.type})
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Format group name for display
 * e.g., "dealinformation" -> "Deal Information"
 */
function formatGroupName(name: string): string {
  // Handle common patterns
  const formatted = name
    .replace(/information$/i, " Information")
    .replace(/details$/i, " Details")
    .replace(/activity$/i, " Activity")
    .replace(/^hs_/, "HubSpot ");

  // Capitalize first letter
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export default HubSpotPropertyPicker;
