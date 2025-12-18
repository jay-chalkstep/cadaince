"use client";

import { useState } from "react";
import Link from "next/link";
import { Database, Loader2, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionStatus } from "./connection-status";

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

interface IntegrationCardProps {
  integration: Integration;
  description: string;
  icon: React.ReactNode;
  onSync?: () => void;
}

export function IntegrationCard({ integration, description, icon, onSync }: IntegrationCardProps) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch(`/api/integrations/${integration.id}/sync`, {
        method: "POST",
      });
      if (response.ok) {
        onSync?.();
      }
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            {icon}
          </div>
          <div>
            <CardTitle className="text-base">{integration.name}</CardTitle>
            <CardDescription className="text-sm">{description}</CardDescription>
          </div>
        </div>
        <ConnectionStatus
          isActive={integration.is_active}
          credentialsSet={integration.credentials_set}
          lastSyncAt={integration.last_sync_at}
          lastError={integration.last_error}
        />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-muted-foreground">
            {integration.last_sync_at ? (
              <>Last sync: {new Date(integration.last_sync_at).toLocaleString()}</>
            ) : (
              "Never synced"
            )}
          </div>
          <div className="flex gap-2">
            {integration.is_active && integration.credentials_set && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-1.5">Sync Now</span>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href={`/settings/integrations/${integration.type}`}>
                <Settings className="mr-1.5 h-4 w-4" />
                Configure
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function IntegrationCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            <div className="h-3 w-48 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="h-6 w-24 bg-muted rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between pt-2">
          <div className="h-4 w-36 bg-muted rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-24 bg-muted rounded animate-pulse" />
            <div className="h-8 w-24 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
