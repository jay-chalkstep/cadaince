"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface SyncLog {
  id: string;
  integration_id: string;
  metric_id: string | null;
  started_at: string;
  completed_at: string | null;
  status: "running" | "success" | "error";
  records_processed: number | null;
  error_message: string | null;
  integration?: {
    id: string;
    type: string;
    name: string;
  };
  metric?: {
    id: string;
    name: string;
  };
}

interface SyncLogsTableProps {
  integrationId?: string;
  limit?: number;
}

export function SyncLogsTable({ integrationId, limit = 10 }: SyncLogsTableProps) {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [integrationId]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (integrationId) params.set("integration_id", integrationId);
      params.set("limit", limit.toString());

      const response = await fetch(`/api/integrations/logs?${params}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch sync logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: SyncLog["status"]) => {
    switch (status) {
      case "running":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Running
          </Badge>
        );
      case "success":
        return (
          <Badge variant="default" className="bg-green-600">
            Success
          </Badge>
        );
      case "error":
        return <Badge variant="destructive">Error</Badge>;
    }
  };

  const formatDuration = (started: string, completed: string | null) => {
    if (!completed) return "—";
    const duration = new Date(completed).getTime() - new Date(started).getTime();
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${Math.round(duration / 1000)}s`;
    return `${Math.round(duration / 60000)}m`;
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No sync logs yet
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Status</TableHead>
          {!integrationId && <TableHead>Integration</TableHead>}
          <TableHead>Metric</TableHead>
          <TableHead className="text-right">Records</TableHead>
          <TableHead className="text-right">Duration</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell className="text-sm">
              {new Date(log.started_at).toLocaleString()}
            </TableCell>
            <TableCell>{getStatusBadge(log.status)}</TableCell>
            {!integrationId && (
              <TableCell className="text-sm">
                {log.integration?.name || "—"}
              </TableCell>
            )}
            <TableCell className="text-sm">
              {log.metric?.name || "All metrics"}
            </TableCell>
            <TableCell className="text-right text-sm">
              {log.records_processed ?? "—"}
            </TableCell>
            <TableCell className="text-right text-sm">
              {formatDuration(log.started_at, log.completed_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
