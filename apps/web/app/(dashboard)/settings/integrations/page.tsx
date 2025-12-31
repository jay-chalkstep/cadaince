"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Database, AlertCircle, Calendar, Check, MessageSquare, Tablet } from "lucide-react";
import { IntegrationCard, IntegrationCardSkeleton } from "@/components/integrations/integration-card";
import { SyncLogsTable } from "@/components/integrations/sync-logs-table";
import { CalendarConnectButton } from "@/components/integrations/calendar-connect-button";
import { SlackConnectButton } from "@/components/integrations/slack-connect-button";
import { RemarkablePairing } from "@/components/integrations/remarkable-pairing";
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

interface CalendarIntegration {
  integration_type: string;
  status: string;
  connected_at: string | null;
  config: Record<string, unknown>;
}

interface SlackWorkspace {
  id: string;
  workspace_name: string | null;
  team_icon_url: string | null;
  is_active: boolean;
}

interface RemarkableStatus {
  connected: boolean;
  status: string;
  settings: {
    push_meeting_agendas: boolean;
    push_briefings: boolean;
    minutes_before_meeting: number;
    folder_path: string;
  };
  recent_documents: Array<{
    id: string;
    title: string;
    document_type: string;
    status: string;
    pushed_at: string;
  }>;
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
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [calendarIntegrations, setCalendarIntegrations] = useState<Record<string, CalendarIntegration>>({});
  const [slackWorkspace, setSlackWorkspace] = useState<SlackWorkspace | null>(null);
  const [remarkableStatus, setRemarkableStatus] = useState<RemarkableStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [slackLoading, setSlackLoading] = useState(true);
  const [remarkableLoading, setRemarkableLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle success/error from OAuth callback
  useEffect(() => {
    const success = searchParams.get("success");
    const errorParam = searchParams.get("error");

    if (success === "google_calendar_connected") {
      setSuccessMessage("Google Calendar connected successfully!");
      // Clear the URL params
      router.replace("/settings/integrations");
    } else if (success === "outlook_calendar_connected") {
      setSuccessMessage("Outlook Calendar connected successfully!");
      router.replace("/settings/integrations");
    } else if (success === "slack_connected") {
      setSuccessMessage("Slack workspace connected successfully!");
      router.replace("/settings/integrations");
      fetchSlackWorkspace();
    } else if (errorParam) {
      const errorMessages: Record<string, string> = {
        oauth_denied: "You denied access. Please try again.",
        invalid_state: "Security verification failed. Please try again.",
        state_expired: "The connection request expired. Please try again.",
        token_exchange_failed: "Failed to complete authorization. Please try again.",
        save_failed: "Failed to save connection. Please try again.",
        unexpected_error: "An unexpected error occurred. Please try again.",
        slack_oauth_denied: "You denied access to Slack. Please try again.",
        slack_exchange_failed: "Failed to exchange Slack authorization. Please try again.",
        slack_save_failed: "Failed to save Slack connection. Please try again.",
        admin_required: "Admin access is required to connect Slack.",
      };
      setError(errorMessages[errorParam] || "An error occurred during connection.");
      router.replace("/settings/integrations");
    }
  }, [searchParams, router]);

  // Fetch calendar integrations status
  const fetchCalendarIntegrations = async () => {
    try {
      setCalendarLoading(true);
      const response = await fetch("/api/integrations/status");
      if (response.ok) {
        const data = await response.json();
        setCalendarIntegrations(data.integrations || {});
      }
    } catch (err) {
      console.error("Failed to fetch calendar integrations:", err);
    } finally {
      setCalendarLoading(false);
    }
  };

  // Fetch Slack workspace status
  const fetchSlackWorkspace = async () => {
    try {
      setSlackLoading(true);
      const response = await fetch("/api/integrations/slack/status");
      if (response.ok) {
        const data = await response.json();
        setSlackWorkspace(data.workspace || null);
      }
    } catch (err) {
      console.error("Failed to fetch Slack workspace:", err);
    } finally {
      setSlackLoading(false);
    }
  };

  // Disconnect Slack workspace
  const handleSlackDisconnect = async () => {
    const response = await fetch("/api/integrations/slack", {
      method: "DELETE",
    });

    if (response.ok) {
      await fetchSlackWorkspace();
      setSuccessMessage("Slack workspace disconnected.");
    } else {
      throw new Error("Failed to disconnect");
    }
  };

  // Resync Slack users
  const handleSlackResync = async () => {
    const response = await fetch("/api/integrations/slack/sync-users", {
      method: "POST",
    });

    if (response.ok) {
      const data = await response.json();
      setSuccessMessage(`Synced ${data.synced} Slack users (${data.matched} matched).`);
    } else {
      throw new Error("Failed to sync users");
    }
  };

  // Fetch reMarkable status
  const fetchRemarkableStatus = async () => {
    try {
      setRemarkableLoading(true);
      const response = await fetch("/api/integrations/remarkable/status");
      if (response.ok) {
        const data = await response.json();
        setRemarkableStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch reMarkable status:", err);
    } finally {
      setRemarkableLoading(false);
    }
  };

  // Disconnect reMarkable
  const handleRemarkableDisconnect = async () => {
    const response = await fetch("/api/integrations/remarkable", {
      method: "DELETE",
    });

    if (response.ok) {
      await fetchRemarkableStatus();
      setSuccessMessage("reMarkable disconnected.");
    } else {
      throw new Error("Failed to disconnect");
    }
  };

  // Update reMarkable settings
  const handleRemarkableSettingsChange = async (settings: Record<string, unknown>) => {
    const response = await fetch("/api/integrations/remarkable/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });

    if (response.ok) {
      await fetchRemarkableStatus();
    } else {
      throw new Error("Failed to update settings");
    }
  };

  // Disconnect calendar integration
  const handleCalendarDisconnect = async (provider: "google" | "outlook") => {
    const response = await fetch(`/api/integrations/calendar/${provider}`, {
      method: "DELETE",
    });

    if (response.ok) {
      await fetchCalendarIntegrations();
      setSuccessMessage(`${provider === "google" ? "Google" : "Outlook"} Calendar disconnected.`);
    } else {
      throw new Error("Failed to disconnect");
    }
  };

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
    fetchCalendarIntegrations();
    fetchSlackWorkspace();
    fetchRemarkableStatus();
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

  const googleCalendar = calendarIntegrations["google_calendar"];
  const outlookCalendar = calendarIntegrations["outlook_calendar"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect your calendars and data sources
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <Check className="h-4 w-4 text-green-500" />
          <AlertTitle className="text-green-700 dark:text-green-400">Success</AlertTitle>
          <AlertDescription className="text-green-600 dark:text-green-300">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Calendar Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-base">
            <Calendar className="h-5 w-5 mr-2" />
            Calendar Integrations
          </CardTitle>
          <CardDescription>
            Sync your L10 meetings with your preferred calendar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {calendarLoading ? (
            <div className="space-y-4">
              <div className="h-16 bg-muted animate-pulse rounded-lg" />
              <div className="h-16 bg-muted animate-pulse rounded-lg" />
            </div>
          ) : (
            <>
              <CalendarConnectButton
                provider="google"
                isConnected={googleCalendar?.status === "active"}
                connectedEmail={googleCalendar?.config?.google_email as string | undefined}
                onDisconnect={() => handleCalendarDisconnect("google")}
              />
              <CalendarConnectButton
                provider="outlook"
                isConnected={outlookCalendar?.status === "active"}
                connectedEmail={outlookCalendar?.config?.microsoft_email as string | undefined}
                onDisconnect={() => handleCalendarDisconnect("outlook")}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Slack Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-base">
            <MessageSquare className="h-5 w-5 mr-2" />
            Slack Integration
          </CardTitle>
          <CardDescription>
            Get notifications and use slash commands in Slack
          </CardDescription>
        </CardHeader>
        <CardContent>
          {slackLoading ? (
            <div className="h-16 bg-muted animate-pulse rounded-lg" />
          ) : (
            <SlackConnectButton
              isConnected={slackWorkspace?.is_active ?? false}
              workspaceName={slackWorkspace?.workspace_name ?? undefined}
              workspaceIcon={slackWorkspace?.team_icon_url ?? undefined}
              onDisconnect={handleSlackDisconnect}
              onResync={handleSlackResync}
            />
          )}
        </CardContent>
      </Card>

      {/* reMarkable Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-base">
            <Tablet className="h-5 w-5 mr-2" />
            reMarkable
          </CardTitle>
          <CardDescription>
            Push meeting agendas and briefings to your tablet
          </CardDescription>
        </CardHeader>
        <CardContent>
          {remarkableLoading ? (
            <div className="h-16 bg-muted animate-pulse rounded-lg" />
          ) : (
            <RemarkablePairing
              isConnected={remarkableStatus?.connected ?? false}
              settings={remarkableStatus?.settings}
              recentDocuments={remarkableStatus?.recent_documents}
              onDisconnect={handleRemarkableDisconnect}
              onSettingsChange={handleRemarkableSettingsChange}
            />
          )}
        </CardContent>
      </Card>

      {/* Data Source Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-base">
            <Database className="h-5 w-5 mr-2" />
            Data Sources
          </CardTitle>
          <CardDescription>
            Connect external data sources for Scorecard metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

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
