"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertCircle, Plus, RefreshCw, Play, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

interface Integration {
  id: string;
  provider: string;
  display_name: string | null;
  status: string;
}

interface DataSourceV2 {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  query_config: Record<string, unknown>;
  destination_type: string;
  destination_config: Record<string, unknown>;
  sync_frequency: string;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  last_sync_records_count: number | null;
  created_at: string;
  integration: Integration;
}

const HUBSPOT_SOURCE_TYPES = [
  { value: "deals", label: "Deals", description: "Pipeline deals and revenue" },
  { value: "contacts", label: "Contacts", description: "Contact records" },
  { value: "companies", label: "Companies", description: "Company records" },
  { value: "tickets", label: "Tickets", description: "Support tickets" },
];

const SYNC_FREQUENCIES = [
  { value: "5min", label: "Every 5 minutes" },
  { value: "15min", label: "Every 15 minutes" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
];

export default function DataSourcesPage() {
  const [dataSources, setDataSources] = useState<DataSourceV2[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  // Form state
  const [formIntegrationId, setFormIntegrationId] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSourceType, setFormSourceType] = useState("");
  const [formSyncFrequency, setFormSyncFrequency] = useState("hourly");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [dsRes, intRes] = await Promise.all([
        fetch("/api/integrations-v2/data-sources"),
        fetch("/api/integrations-v2"),
      ]);

      if (dsRes.ok) {
        const data = await dsRes.json();
        setDataSources(data);
      }

      if (intRes.ok) {
        const data = await intRes.json();
        // Only show active integrations that can have data sources
        setIntegrations(data.filter((i: Integration) => i.status === "active"));
      }
    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!formIntegrationId || !formName || !formSourceType) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
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
          integration_id: formIntegrationId,
          name: formName,
          description: formDescription || undefined,
          source_type: formSourceType,
          query_config: {},
          destination_type: "signal",
          sync_frequency: formSyncFrequency,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create data source");
      }

      toast({
        title: "Data source created",
        description: `${formName} is ready to sync`,
      });

      setCreateDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSync = async (dataSourceId: string, name: string) => {
    setSyncing(dataSourceId);
    try {
      const response = await fetch(`/api/integrations-v2/data-sources/${dataSourceId}/sync`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Sync failed");
      }

      toast({
        title: "Sync complete",
        description: `${name}: ${data.records_fetched || 0} records fetched`,
      });

      fetchData();
    } catch (err) {
      toast({
        title: "Sync failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSyncing(null);
    }
  };

  const handleDelete = async (dataSourceId: string, name: string) => {
    setDeleting(dataSourceId);
    try {
      const response = await fetch(`/api/integrations-v2/data-sources/${dataSourceId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete");
      }

      toast({
        title: "Data source deleted",
        description: `${name} has been removed`,
      });

      fetchData();
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const resetForm = () => {
    setFormIntegrationId("");
    setFormName("");
    setFormDescription("");
    setFormSourceType("");
    setFormSyncFrequency("hourly");
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Data Sources</h1>
          <p className="text-sm text-muted-foreground">
            Pull data from connected integrations
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const activeIntegrations = integrations.filter((i) => i.status === "active");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Data Sources</h1>
          <p className="text-sm text-muted-foreground">
            Pull data from connected integrations
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={activeIntegrations.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              New Data Source
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Data Source</DialogTitle>
              <DialogDescription>
                Configure what data to pull from your integration
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="integration">Integration *</Label>
                <Select value={formIntegrationId} onValueChange={setFormIntegrationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select integration" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeIntegrations.map((int) => (
                      <SelectItem key={int.id} value={int.id}>
                        {int.display_name || int.provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="source_type">Data Type *</Label>
                <Select value={formSourceType} onValueChange={setFormSourceType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select data type" />
                  </SelectTrigger>
                  <SelectContent>
                    {HUBSPOT_SOURCE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label} - {type.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Active Deals"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What this data source tracks"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequency">Sync Frequency</Label>
                <Select value={formSyncFrequency} onValueChange={setFormSyncFrequency}>
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Data Sources */}
      <div className="grid gap-4">
        {loading ? (
          <>
            <DataSourceSkeleton />
            <DataSourceSkeleton />
          </>
        ) : dataSources.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              {activeIntegrations.length === 0 ? (
                <>
                  <h3 className="font-medium">No integrations connected</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Connect an integration first to create data sources.
                  </p>
                  <Button className="mt-4" variant="outline" asChild>
                    <a href="/settings/integrations">Go to Integrations</a>
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="font-medium">No data sources yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a data source to start pulling data from your integrations.
                  </p>
                  <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Data Source
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          dataSources.map((ds) => (
            <Card key={ds.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{ds.name}</CardTitle>
                    <CardDescription>
                      {ds.integration.display_name || ds.integration.provider} &middot; {ds.source_type}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={ds.is_active ? "default" : "secondary"}>
                      {ds.is_active ? "Active" : "Paused"}
                    </Badge>
                    {ds.last_sync_status && (
                      <Badge
                        variant={
                          ds.last_sync_status === "success"
                            ? "outline"
                            : ds.last_sync_status === "error"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {ds.last_sync_status}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-muted-foreground">
                    {ds.last_sync_at ? (
                      <>
                        Last sync: {new Date(ds.last_sync_at).toLocaleString()}
                        {ds.last_sync_records_count !== null && (
                          <> &middot; {ds.last_sync_records_count} records</>
                        )}
                      </>
                    ) : (
                      "Never synced"
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSync(ds.id, ds.name)}
                      disabled={syncing === ds.id}
                    >
                      {syncing === ds.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      <span className="ml-2">Sync Now</span>
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={deleting === ds.id}
                        >
                          {deleting === ds.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {ds.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this data source and all its sync history.
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(ds.id, ds.name)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {ds.last_sync_error && (
                  <p className="text-sm text-destructive mt-2">{ds.last_sync_error}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function DataSourceSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-5 w-48 bg-muted animate-pulse rounded" />
        <div className="h-4 w-32 bg-muted animate-pulse rounded mt-1" />
      </CardHeader>
      <CardContent>
        <div className="h-4 w-64 bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}
