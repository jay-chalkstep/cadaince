"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { HubSpotProperty, HubSpotObject } from "@/lib/integrations/providers/hubspot";

interface PropertyCheckboxListProps {
  object: HubSpotObject;
  selectedProperties: string[];
  onChange: (properties: string[]) => void;
  disabled?: boolean;
}

interface PropertiesResponse {
  object: string;
  properties: HubSpotProperty[];
  groups: Record<string, HubSpotProperty[]>;
  totalCount: number;
}

export function PropertyCheckboxList({
  object,
  selectedProperties,
  onChange,
  disabled = false,
}: PropertyCheckboxListProps) {
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<HubSpotProperty[]>([]);
  const [groups, setGroups] = useState<Record<string, HubSpotProperty[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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

      // Expand first group by default
      const groupNames = Object.keys(data.groups);
      if (groupNames.length > 0) {
        setExpandedGroups(new Set([groupNames[0]]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch properties");
      setProperties([]);
      setGroups({});
    } finally {
      setLoading(false);
    }
  }, [object]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleProperty = (propertyName: string) => {
    const newSelected = selectedProperties.includes(propertyName)
      ? selectedProperties.filter((p) => p !== propertyName)
      : [...selectedProperties, propertyName];
    onChange(newSelected);
  };

  const selectAll = () => {
    onChange(properties.map((p) => p.name));
  };

  const deselectAll = () => {
    onChange([]);
  };

  const selectGroupAll = (groupName: string) => {
    const groupProps = groups[groupName]?.map((p) => p.name) || [];
    const currentNonGroup = selectedProperties.filter(
      (p) => !groupProps.includes(p)
    );
    onChange([...currentNonGroup, ...groupProps]);
  };

  const deselectGroupAll = (groupName: string) => {
    const groupProps = groups[groupName]?.map((p) => p.name) || [];
    onChange(selectedProperties.filter((p) => !groupProps.includes(p)));
  };

  // Sort groups - put common ones first
  const sortedGroupNames = Object.keys(groups).sort((a, b) => {
    const priority = [
      "dealinformation",
      "contactinformation",
      "companyinformation",
      "ticketinformation",
    ];
    const aIndex = priority.indexOf(a.toLowerCase());
    const bIndex = priority.indexOf(b.toLowerCase());
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading properties...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        No properties found for this object type.
      </div>
    );
  }

  const isGroupFullySelected = (groupName: string) => {
    const groupProps = groups[groupName]?.map((p) => p.name) || [];
    return groupProps.every((p) => selectedProperties.includes(p));
  };

  const isGroupPartiallySelected = (groupName: string) => {
    const groupProps = groups[groupName]?.map((p) => p.name) || [];
    const selectedCount = groupProps.filter((p) =>
      selectedProperties.includes(p)
    ).length;
    return selectedCount > 0 && selectedCount < groupProps.length;
  };

  return (
    <div className="space-y-3">
      {/* Header with select all controls */}
      <div className="flex items-center justify-between border-b pb-2">
        <span className="text-sm text-muted-foreground">
          {selectedProperties.length} of {properties.length} properties selected
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={selectAll}
            disabled={disabled || selectedProperties.length === properties.length}
          >
            Select All
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={deselectAll}
            disabled={disabled || selectedProperties.length === 0}
          >
            Deselect All
          </Button>
        </div>
      </div>

      {/* Property groups */}
      <div className="max-h-[400px] overflow-y-auto space-y-2">
        {sortedGroupNames.map((groupName) => (
          <Collapsible
            key={groupName}
            open={expandedGroups.has(groupName)}
            onOpenChange={() => toggleGroup(groupName)}
          >
            <div className="flex items-center gap-2 py-1">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-1 h-auto">
                  {expandedGroups.has(groupName) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <Checkbox
                id={`group-${groupName}`}
                checked={isGroupFullySelected(groupName)}
                ref={(el) => {
                  if (el) {
                    (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate =
                      isGroupPartiallySelected(groupName);
                  }
                }}
                onCheckedChange={(checked) => {
                  if (checked) {
                    selectGroupAll(groupName);
                  } else {
                    deselectGroupAll(groupName);
                  }
                }}
                disabled={disabled}
              />
              <Label
                htmlFor={`group-${groupName}`}
                className="font-medium cursor-pointer"
              >
                {formatGroupName(groupName)}
              </Label>
              <span className="text-xs text-muted-foreground">
                ({groups[groupName].length})
              </span>
            </div>

            <CollapsibleContent>
              <div className="ml-8 space-y-1 py-1">
                {groups[groupName].map((property) => (
                  <div
                    key={property.name}
                    className="flex items-start gap-2 py-1"
                  >
                    <Checkbox
                      id={`prop-${property.name}`}
                      checked={selectedProperties.includes(property.name)}
                      onCheckedChange={() => toggleProperty(property.name)}
                      disabled={disabled}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <Label
                        htmlFor={`prop-${property.name}`}
                        className="cursor-pointer text-sm"
                      >
                        {property.label}
                      </Label>
                      <div className="text-xs text-muted-foreground">
                        {property.name} ({property.type})
                        {property.description && (
                          <span className="block mt-0.5 truncate" title={property.description}>
                            {property.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}

/**
 * Format group name for display
 */
function formatGroupName(name: string): string {
  const formatted = name
    .replace(/information$/i, " Information")
    .replace(/details$/i, " Details")
    .replace(/activity$/i, " Activity")
    .replace(/^hs_/, "HubSpot ");

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export default PropertyCheckboxList;
