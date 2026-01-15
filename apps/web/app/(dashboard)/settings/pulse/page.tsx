"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Save, Users } from "lucide-react";

interface Owner {
  hubspot_owner_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  is_active: boolean;
  deal_count: number;
  ticket_count: number;
}

interface PulseSettings {
  growth_pulse_excluded_owners: string[];
  customer_pulse_excluded_owners: string[];
}

export default function PulseSettingsPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [settings, setSettings] = useState<PulseSettings>({
    growth_pulse_excluded_owners: [],
    customer_pulse_excluded_owners: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/settings/pulse");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch settings");
      }
      const data = await res.json();
      setOwners(data.owners);
      setSettings(data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleGrowthOwnerToggle = (ownerId: string, checked: boolean) => {
    setSettings((prev) => {
      const excluded = new Set(prev.growth_pulse_excluded_owners);
      if (checked) {
        excluded.delete(ownerId);
      } else {
        excluded.add(ownerId);
      }
      return {
        ...prev,
        growth_pulse_excluded_owners: Array.from(excluded),
      };
    });
    setHasChanges(true);
  };

  const handleCustomerOwnerToggle = (ownerId: string, checked: boolean) => {
    setSettings((prev) => {
      const excluded = new Set(prev.customer_pulse_excluded_owners);
      if (checked) {
        excluded.delete(ownerId);
      } else {
        excluded.add(ownerId);
      }
      return {
        ...prev,
        customer_pulse_excluded_owners: Array.from(excluded),
      };
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/pulse", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save settings");
      }
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const getOwnerName = (owner: Owner) => {
    const name = `${owner.first_name || ""} ${owner.last_name || ""}`.trim();
    return name || owner.email || owner.hubspot_owner_id;
  };

  const growthIncludedCount = owners.filter(
    (o) => !settings.growth_pulse_excluded_owners.includes(o.hubspot_owner_id)
  ).length;

  const customerIncludedCount = owners.filter(
    (o) => !settings.customer_pulse_excluded_owners.includes(o.hubspot_owner_id)
  ).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pulse Settings</h1>
          <p className="text-muted-foreground">Configure which HubSpot owners appear in Pulse dashboards</p>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pulse Settings</h1>
          <p className="text-muted-foreground">Configure which HubSpot owners appear in Pulse dashboards</p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pulse Settings</h1>
          <p className="text-muted-foreground">Configure which HubSpot owners appear in Pulse dashboards</p>
        </div>
        {hasChanges && (
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>

      {owners.length === 0 ? (
        <Alert>
          <Users className="h-4 w-4" />
          <AlertDescription>
            No HubSpot owners found. Sync your HubSpot data to see owners here.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Growth Pulse Owners */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Growth Pulse Owners</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {growthIncludedCount} of {owners.length} included
                </span>
              </CardTitle>
              <CardDescription>
                Select which owners (sellers) to include in Growth Pulse reporting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {owners.map((owner) => {
                  const isIncluded = !settings.growth_pulse_excluded_owners.includes(
                    owner.hubspot_owner_id
                  );
                  return (
                    <label
                      key={owner.hubspot_owner_id}
                      className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={isIncluded}
                        onCheckedChange={(checked) =>
                          handleGrowthOwnerToggle(owner.hubspot_owner_id, checked === true)
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{getOwnerName(owner)}</div>
                        {owner.email && (
                          <div className="text-xs text-muted-foreground truncate">
                            {owner.email}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground whitespace-nowrap">
                        {owner.deal_count} deals
                      </div>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Customer Pulse Owners */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Customer Pulse Owners</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {customerIncludedCount} of {owners.length} included
                </span>
              </CardTitle>
              <CardDescription>
                Select which owners (CSRs) to include in Customer Pulse reporting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {owners.map((owner) => {
                  const isIncluded = !settings.customer_pulse_excluded_owners.includes(
                    owner.hubspot_owner_id
                  );
                  return (
                    <label
                      key={owner.hubspot_owner_id}
                      className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={isIncluded}
                        onCheckedChange={(checked) =>
                          handleCustomerOwnerToggle(owner.hubspot_owner_id, checked === true)
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{getOwnerName(owner)}</div>
                        {owner.email && (
                          <div className="text-xs text-muted-foreground truncate">
                            {owner.email}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground whitespace-nowrap">
                        {owner.deal_count} deals
                      </div>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
