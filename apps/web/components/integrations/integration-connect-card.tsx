"use client";

import { useState } from "react";
import {
  Loader2,
  ExternalLink,
  Unplug,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Briefcase,
  Cloud,
  MessageSquare,
  Phone,
  Zap,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import type {
  IntegrationProvider,
  IntegrationStatus,
  IntegrationListItem,
} from "@/lib/integrations/oauth";

interface IntegrationConnectCardProps {
  provider: IntegrationProvider;
  name: string;
  description: string;
  integration: IntegrationListItem | null;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onRefresh?: () => Promise<void>;
  isLoading?: boolean;
}

interface TestResult {
  success: boolean;
  error?: string;
  details?: {
    portalId?: string;
    accountType?: string;
    timeZone?: string;
  };
}

// Map provider to icon
const PROVIDER_ICONS: Record<IntegrationProvider, React.ReactNode> = {
  hubspot: <Briefcase className="h-5 w-5" />,
  salesforce: <Cloud className="h-5 w-5" />,
  slack: <MessageSquare className="h-5 w-5" />,
  gong: <Phone className="h-5 w-5" />,
  salesloft: <Zap className="h-5 w-5" />,
  bigquery: <Database className="h-5 w-5" />,
};

// Status badge configuration
function getStatusConfig(status: IntegrationStatus | null) {
  switch (status) {
    case "active":
      return {
        label: "Connected",
        variant: "default" as const,
        icon: <CheckCircle2 className="h-3 w-3" />,
      };
    case "error":
      return {
        label: "Error",
        variant: "destructive" as const,
        icon: <AlertCircle className="h-3 w-3" />,
      };
    case "expired":
      return {
        label: "Expired",
        variant: "secondary" as const,
        icon: <Clock className="h-3 w-3" />,
      };
    case "disconnected":
      return {
        label: "Disconnected",
        variant: "outline" as const,
        icon: <XCircle className="h-3 w-3" />,
      };
    case "pending":
      return {
        label: "Pending",
        variant: "secondary" as const,
        icon: <Clock className="h-3 w-3" />,
      };
    default:
      return {
        label: "Not Connected",
        variant: "outline" as const,
        icon: null,
      };
  }
}

export function IntegrationConnectCard({
  provider,
  name,
  description,
  integration,
  onConnect,
  onDisconnect,
  onRefresh,
  isLoading = false,
}: IntegrationConnectCardProps) {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const isConnected = integration?.status === "active";
  const hasError = integration?.status === "error";
  const statusConfig = getStatusConfig(integration?.status ?? null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`/api/integrations-v2/${provider}/test`, {
        method: "POST",
      });
      const data = await response.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: "Failed to test connection" });
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await onConnect();
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await onDisconnect();
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card className={hasError ? "border-destructive/50" : undefined}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              isConnected
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {PROVIDER_ICONS[provider]}
          </div>
          <div>
            <CardTitle className="text-base">{name}</CardTitle>
            <CardDescription className="text-sm">{description}</CardDescription>
          </div>
        </div>
        <Badge variant={statusConfig.variant} className="flex items-center gap-1">
          {statusConfig.icon}
          {statusConfig.label}
        </Badge>
      </CardHeader>
      <CardContent>
        {/* Connected state details */}
        {integration && isConnected && (
          <div className="mb-3 space-y-1 text-sm text-muted-foreground">
            {integration.external_account_name && (
              <p>
                <span className="font-medium text-foreground">
                  {integration.external_account_name}
                </span>
              </p>
            )}
            {/* Show test result with portal info */}
            {testResult?.success && testResult.details?.portalId && (
              <p>
                <span className="font-medium text-foreground">
                  Portal ID: {testResult.details.portalId}
                </span>
                {testResult.details.accountType && (
                  <span className="ml-2 text-muted-foreground">
                    ({testResult.details.accountType})
                  </span>
                )}
              </p>
            )}
            {integration.last_successful_connection_at && (
              <p>
                Connected{" "}
                {new Date(
                  integration.last_successful_connection_at
                ).toLocaleDateString()}
              </p>
            )}
            {integration.data_source_count !== undefined &&
              integration.data_source_count > 0 && (
                <p>
                  {integration.data_source_count} data source
                  {integration.data_source_count === 1 ? "" : "s"}
                </p>
              )}
          </div>
        )}

        {/* Test result error */}
        {testResult && !testResult.success && (
          <div className="mb-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
            <p className="font-medium">Test Failed</p>
            <p className="text-xs opacity-90">{testResult.error}</p>
          </div>
        )}

        {/* Error state */}
        {integration && hasError && integration.last_error && (
          <div className="mb-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
            <p className="font-medium">Connection Error</p>
            <p className="text-xs opacity-90">{integration.last_error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-muted-foreground">
            {isLoading ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </span>
            ) : null}
          </div>
          <div className="flex gap-2">
            {isConnected ? (
              <>
                {/* Test connection button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={testing}
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span className="ml-1.5">Test</span>
                </Button>

                {/* Refresh token button (for OAuth providers with refresh) */}
                {hasError && onRefresh && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={refreshing}
                  >
                    {refreshing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-1.5">Retry</span>
                  </Button>
                )}

                {/* Disconnect button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={disconnecting}>
                      {disconnecting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Unplug className="h-4 w-4" />
                      )}
                      <span className="ml-1.5">Disconnect</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect {name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the connection to {name}. Any data sources
                        using this integration will stop syncing.
                        {integration?.data_source_count
                          ? ` ${integration.data_source_count} data source${integration.data_source_count === 1 ? "" : "s"} will be affected.`
                          : ""}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDisconnect}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              /* Connect button */
              <Button
                variant="default"
                size="sm"
                onClick={handleConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                <span className="ml-1.5">Connect</span>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function IntegrationConnectCardSkeleton() {
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
        <div className="h-5 w-20 bg-muted rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between pt-2">
          <div />
          <div className="h-8 w-24 bg-muted rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}
