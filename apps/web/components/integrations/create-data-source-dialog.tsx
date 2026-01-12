"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { PropertyCheckboxList } from "./property-checkbox-list";
import type { HubSpotObject } from "@/lib/integrations/providers/hubspot";

interface Integration {
  id: string;
  provider: string;
  display_name: string | null;
  status: string;
}

interface CreateDataSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

// HubSpot object types available for data sourcing
const HUBSPOT_OBJECTS: { value: HubSpotObject; label: string; description: string }[] = [
  { value: "tickets", label: "Tickets", description: "Support tickets and customer issues" },
  { value: "deals", label: "Deals", description: "Sales opportunities and pipeline" },
  { value: "contacts", label: "Contacts", description: "Individual contact records" },
  { value: "companies", label: "Companies", description: "Company/organization records" },
  { value: "products", label: "Products", description: "Product catalog items" },
  { value: "line_items", label: "Line Items", description: "Deal line items" },
  { value: "feedback_submissions", label: "Feedback", description: "Customer feedback and NPS" },
];

const SYNC_FREQUENCIES = [
  { value: "5min", label: "Every 5 minutes" },
  { value: "15min", label: "Every 15 minutes" },
  { value: "hourly", label: "Every hour" },
  { value: "daily", label: "Daily" },
  { value: "manual", label: "Manual only" },
];

export function CreateDataSourceDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateDataSourceDialogProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  // Form state
  const [selectedIntegration, setSelectedIntegration] = useState<string>("");
  const [selectedObject, setSelectedObject] = useState<HubSpotObject | "">("");
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [syncFrequency, setSyncFrequency] = useState("hourly");

  // Fetch active integrations
  useEffect(() => {
    if (open) {
      fetchIntegrations();
    }
  }, [open]);

  // Auto-generate name when object changes
  useEffect(() => {
    if (selectedObject) {
      const objLabel = HUBSPOT_OBJECTS.find((o) => o.value === selectedObject)?.label;
      setName(objLabel ? `${objLabel} Data` : "");
    }
  }, [selectedObject]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedIntegration("");
      setSelectedObject("");
      setSelectedProperties([]);
      setName("");
      setSyncFrequency("hourly");
    }
  }, [open]);

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/integrations-v2");
      if (response.ok) {
        const data = await response.json();
        // Only show active HubSpot integrations (for now)
        const active = data.filter(
          (i: Integration) => i.status === "active" && i.provider === "hubspot"
        );
        setIntegrations(active);
        // Auto-select if only one integration
        if (active.length === 1) {
          setSelectedIntegration(active[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch integrations:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedIntegration || !selectedObject || selectedProperties.length === 0 || !name) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields and select at least one property.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/integrations-v2/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integration_id: selectedIntegration,
          name,
          source_type: selectedObject,
          query_config: {
            object: selectedObject,
            properties: selectedProperties,
          },
          destination_type: "raw_records",
          destination_config: {},
          sync_frequency: syncFrequency,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create data source");
      }

      toast({
        title: "Data source created",
        description: `${name} is ready. Click "Sync Now" to fetch records.`,
      });

      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast({
        title: "Creation failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const selectedProvider = integrations.find((i) => i.id === selectedIntegration)?.provider;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Data Source</DialogTitle>
          <DialogDescription>
            Select which data to pull from your integration.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : integrations.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No active integrations found.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Connect HubSpot first in the Integrations tab.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Integration selector (if multiple) */}
            {integrations.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="integration">Integration</Label>
                <Select value={selectedIntegration} onValueChange={setSelectedIntegration}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select integration" />
                  </SelectTrigger>
                  <SelectContent>
                    {integrations.map((integration) => (
                      <SelectItem key={integration.id} value={integration.id}>
                        {integration.display_name || integration.provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Object type selector */}
            {selectedIntegration && selectedProvider === "hubspot" && (
              <div className="space-y-2">
                <Label htmlFor="object">Object Type</Label>
                <Select
                  value={selectedObject}
                  onValueChange={(v) => {
                    setSelectedObject(v as HubSpotObject);
                    setSelectedProperties([]); // Reset properties when object changes
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select what data to pull" />
                  </SelectTrigger>
                  <SelectContent>
                    {HUBSPOT_OBJECTS.map((obj) => (
                      <SelectItem key={obj.value} value={obj.value}>
                        <div>
                          <span className="font-medium">{obj.label}</span>
                          <span className="text-muted-foreground text-xs ml-2">
                            {obj.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Property selection */}
            {selectedObject && (
              <div className="space-y-2">
                <Label>Select Properties to Ingest</Label>
                <div className="border rounded-md p-3">
                  <PropertyCheckboxList
                    object={selectedObject as HubSpotObject}
                    selectedProperties={selectedProperties}
                    onChange={setSelectedProperties}
                    disabled={creating}
                  />
                </div>
              </div>
            )}

            {/* Name and sync frequency */}
            {selectedProperties.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Support Tickets"
                    disabled={creating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sync">Sync Frequency</Label>
                  <Select value={syncFrequency} onValueChange={setSyncFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SYNC_FREQUENCIES.map((freq) => (
                        <SelectItem key={freq.value} value={freq.value}>
                          {freq.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={
              creating ||
              !selectedIntegration ||
              !selectedObject ||
              selectedProperties.length === 0 ||
              !name
            }
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Data Source"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateDataSourceDialog;
