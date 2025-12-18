"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HubSpotConfig } from "@/components/integrations/hubspot-config";
import { BigQueryConfig } from "@/components/integrations/bigquery-config";
import { SyncLogsTable } from "@/components/integrations/sync-logs-table";

interface Integration {
  id: string;
  type: string;
  name: string;
  is_active: boolean;
  credentials_set: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  config: Record<string, unknown>;
}

interface MappedMetric {
  id: string;
  name: string;
  source_type: string;
  source_config: Record<string, unknown> | null;
  last_sync_at: string | null;
  sync_error: string | null;
}

export default function IntegrationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const type = params.type as string;

  const [integration, setIntegration] = useState<Integration | null>(null);
  const [mappedMetrics, setMappedMetrics] = useState<MappedMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegration = async () => {
    try {
      // Get all integrations and find the one by type
      const response = await fetch("/api/integrations");
      if (response.status === 403) {
        setError("You don't have permission to view integrations. Admin access required.");
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to fetch integration");
      }
      const integrations = await response.json();
      const found = integrations.find((i: Integration) => i.type === type);

      if (!found) {
        setError(`Integration type "${type}" not found`);
        return;
      }

      setIntegration(found);

      // Fetch metrics mapped to this integration
      const metricsResponse = await fetch(`/api/metrics?source_type=${type}`);
      if (metricsResponse.ok) {
        const metrics = await metricsResponse.json();
        setMappedMetrics(metrics);
      }
    } catch (err) {
      setError("Failed to load integration details");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegration();
  }, [type]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !integration) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/settings/integrations">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Integrations
          </Link>
        </Button>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || "Integration not found"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const getIntegrationTitle = (type: string) => {
    switch (type) {
      case "hubspot":
        return "HubSpot CRM";
      case "bigquery":
        return "Google BigQuery";
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings/integrations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{getIntegrationTitle(type)}</h1>
          <p className="text-sm text-muted-foreground">
            Configure and manage your {getIntegrationTitle(type)} integration
          </p>
        </div>
      </div>

      {/* Integration-specific config */}
      {type === "hubspot" && (
        <HubSpotConfig integration={integration} onUpdate={fetchIntegration} />
      )}
      {type === "bigquery" && (
        <BigQueryConfig integration={integration} onUpdate={fetchIntegration} />
      )}

      {/* Mapped Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapped Metrics</CardTitle>
          <CardDescription>
            Scorecard metrics configured to sync from this integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mappedMetrics.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No metrics configured for this integration yet.
              <div className="mt-2">
                <Button variant="outline" asChild>
                  <Link href="/scorecard">Go to Scorecard</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {mappedMetrics.map((metric) => (
                <div
                  key={metric.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <div className="font-medium">{metric.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {metric.last_sync_at
                        ? `Last synced: ${new Date(metric.last_sync_at).toLocaleString()}`
                        : "Never synced"}
                    </div>
                  </div>
                  {metric.sync_error && (
                    <div className="text-sm text-red-600">{metric.sync_error}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync History</CardTitle>
          <CardDescription>
            Recent synchronization attempts for this integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SyncLogsTable integrationId={integration.id} limit={10} />
        </CardContent>
      </Card>
    </div>
  );
}
