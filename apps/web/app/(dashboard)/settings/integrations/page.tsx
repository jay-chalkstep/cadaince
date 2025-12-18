"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Database, AlertCircle } from "lucide-react";
import { IntegrationCard, IntegrationCardSkeleton } from "@/components/integrations/integration-card";
import { SyncLogsTable } from "@/components/integrations/sync-logs-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

const INTEGRATION_META: Record<string, { description: string; icon: React.ReactNode }> = {
  hubspot: {
    description: "Pipeline, CSAT, support tickets",
    icon: <HubSpotIcon className="h-5 w-5 text-orange-600" />,
  },
  bigquery: {
    description: "Custom metrics, disbursement volume",
    icon: <Database className="h-5 w-5 text-blue-600" />,
  },
};

export default function IntegrationsPage() {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = async () => {
    try {
      const response = await fetch("/api/integrations");
      if (response.status === 403) {
        setError("You don't have permission to view integrations. Admin access required.");
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to fetch integrations");
      }
      const data = await response.json();
      setIntegrations(data);
    } catch (err) {
      setError("Failed to load integrations");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Manage external data sources for Scorecard metrics
          </p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Manage external data sources for Scorecard metrics
        </p>
      </div>

      {/* Integration Cards */}
      <div className="grid gap-4">
        {loading ? (
          <>
            <IntegrationCardSkeleton />
            <IntegrationCardSkeleton />
          </>
        ) : (
          integrations.map((integration) => {
            const meta = INTEGRATION_META[integration.type] || {
              description: "External integration",
              icon: <Database className="h-5 w-5" />,
            };
            return (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                description={meta.description}
                icon={meta.icon}
                onSync={fetchIntegrations}
              />
            );
          })
        )}
      </div>

      {/* Recent Sync Logs */}
      {!loading && integrations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Sync Activity</CardTitle>
            <CardDescription>
              Latest synchronization attempts across all integrations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SyncLogsTable limit={5} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Simple HubSpot icon component
function HubSpotIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.984 2.21 2.21 0 00-2.21-2.21 2.21 2.21 0 00-2.21 2.21c0 .867.501 1.617 1.229 1.974v2.857a5.185 5.185 0 00-2.395 1.106l-6.4-4.988a2.607 2.607 0 00.09-.627A2.612 2.612 0 004.93.818a2.612 2.612 0 00-2.604 2.604A2.612 2.612 0 004.93 6.026c.493 0 .953-.138 1.346-.375l6.27 4.887a5.212 5.212 0 00-.514 2.259 5.212 5.212 0 00.576 2.4l-1.955 1.955a1.883 1.883 0 00-.56-.087 1.89 1.89 0 00-1.888 1.888 1.89 1.89 0 001.888 1.888 1.89 1.89 0 001.888-1.888c0-.2-.032-.392-.087-.573l1.93-1.93a5.222 5.222 0 003.395 1.254 5.23 5.23 0 005.218-5.218 5.221 5.221 0 00-4.273-5.136zm-.944 7.806a2.676 2.676 0 01-2.673-2.673 2.676 2.676 0 012.673-2.673 2.676 2.676 0 012.673 2.673 2.676 2.676 0 01-2.673 2.673z" />
    </svg>
  );
}
