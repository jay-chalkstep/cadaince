"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock, SkipForward, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface LogEntry {
  id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  status: "pending" | "running" | "success" | "error" | "skipped";
  result: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

interface AutomationLogsProps {
  automationId: string;
}

const STATUS_ICONS = {
  pending: <Clock className="h-4 w-4 text-yellow-500" />,
  running: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  success: <CheckCircle className="h-4 w-4 text-green-500" />,
  error: <XCircle className="h-4 w-4 text-red-500" />,
  skipped: <SkipForward className="h-4 w-4 text-gray-400" />,
};

const STATUS_LABELS = {
  pending: "Pending",
  running: "Running",
  success: "Success",
  error: "Failed",
  skipped: "Skipped",
};

export function AutomationLogs({ automationId }: AutomationLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [automationId]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/automations/${automationId}/logs?limit=50`);
      if (!response.ok) throw new Error("Failed to fetch logs");
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
        {error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No executions yet. This automation hasn't been triggered.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div
          key={log.id}
          className="p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="mt-0.5">{STATUS_ICONS[log.status]}</div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-sm">{log.event_type}</span>
                  <Badge
                    variant={
                      log.status === "success"
                        ? "default"
                        : log.status === "error"
                        ? "destructive"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {STATUS_LABELS[log.status]}
                  </Badge>
                  {log.event_data?.is_test === true && (
                    <Badge variant="outline" className="text-xs">
                      Test
                    </Badge>
                  )}
                </div>

                {typeof log.event_data?.title === "string" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {log.event_data.title}
                  </p>
                )}

                {log.error_message && (
                  <p className="text-sm text-red-600 mt-1">{log.error_message}</p>
                )}

                {log.result && log.status === "success" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatResult(log.result)}
                  </p>
                )}
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(log.started_at), { addSuffix: true })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatResult(result: Record<string, unknown>): string {
  if (result.message_sent) return "Message sent to Slack";
  if (result.dm_sent) return "DM sent";
  if (result.pushed) return "Document pushed to reMarkable";
  if (result.success && result.url) return `Webhook sent to ${result.url}`;
  if (result.reason === "conditions_not_met") return "Conditions not met";
  return JSON.stringify(result);
}
