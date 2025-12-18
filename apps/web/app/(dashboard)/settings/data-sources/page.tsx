"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DataSourceCard, DataSourceCardSkeleton } from "@/components/data-sources/data-source-card";
import { CreateDataSourceDialog } from "@/components/data-sources/create-data-source-dialog";

interface DataSource {
  id: string;
  name: string;
  description: string | null;
  source_type: "hubspot" | "bigquery";
  unit: string | null;
  metrics_count: number;
  created_at: string;
}

export default function DataSourcesPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDataSources = async () => {
    try {
      const response = await fetch("/api/data-sources");
      if (response.status === 403) {
        setError("You don't have permission to view data sources. Admin access required.");
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to fetch data sources");
      }
      const data = await response.json();
      setDataSources(data);
    } catch (err) {
      setError("Failed to load data sources");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDataSources();
  }, []);

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Data Sources</h1>
            <p className="text-sm text-muted-foreground">
              Reusable query definitions for Scorecard metrics
            </p>
          </div>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Data Sources</h1>
          <p className="text-sm text-muted-foreground">
            Reusable query definitions for Scorecard metrics
          </p>
        </div>
        <CreateDataSourceDialog onCreated={fetchDataSources}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Data Source
          </Button>
        </CreateDataSourceDialog>
      </div>

      {/* Data Source Cards */}
      <div className="grid gap-4">
        {loading ? (
          <>
            <DataSourceCardSkeleton />
            <DataSourceCardSkeleton />
            <DataSourceCardSkeleton />
          </>
        ) : dataSources.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <h3 className="font-medium">No data sources yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create a data source to start syncing metrics from HubSpot or BigQuery.
            </p>
            <CreateDataSourceDialog onCreated={fetchDataSources}>
              <Button className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Data Source
              </Button>
            </CreateDataSourceDialog>
          </div>
        ) : (
          dataSources.map((dataSource) => (
            <DataSourceCard
              key={dataSource.id}
              dataSource={dataSource}
              onDelete={fetchDataSources}
            />
          ))
        )}
      </div>

      {/* Info Section */}
      {!loading && dataSources.length > 0 && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <h3 className="font-medium mb-2">About Data Sources</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>
              <strong>Define once, use many:</strong> Create a data source and reference it in multiple metrics with different time windows.
            </li>
            <li>
              <strong>Multi-window metrics:</strong> Display W / M / YTD values in a single scorecard row.
            </li>
            <li>
              <strong>Centralized updates:</strong> Change the underlying query in one place, and all metrics update.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
