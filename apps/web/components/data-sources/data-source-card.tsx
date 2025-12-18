"use client";

import { useState } from "react";
import Link from "next/link";
import { Database, Loader2, Play, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

interface DataSource {
  id: string;
  name: string;
  description: string | null;
  source_type: "hubspot" | "bigquery";
  unit: string | null;
  metrics_count: number;
  created_at: string;
}

interface DataSourceCardProps {
  dataSource: DataSource;
  onDelete?: () => void;
  onTest?: (id: string) => void;
}

export function DataSourceCard({ dataSource, onDelete, onTest }: DataSourceCardProps) {
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    value?: number;
    formatted_value?: string;
    error?: string;
  } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`/api/data-sources/${dataSource.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time_window: "week" }),
      });
      const data = await response.json();
      setTestResult({
        success: data.success,
        value: data.result?.value,
        formatted_value: data.result?.formatted_value,
        error: data.result?.error,
      });
      onTest?.(dataSource.id);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : "Test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/data-sources/${dataSource.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        onDelete?.();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete data source");
      }
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete data source");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            {dataSource.source_type === "hubspot" ? (
              <HubSpotIcon className="h-5 w-5 text-orange-600" />
            ) : (
              <Database className="h-5 w-5 text-blue-600" />
            )}
          </div>
          <div>
            <CardTitle className="text-base">{dataSource.name}</CardTitle>
            <CardDescription className="text-sm">
              {dataSource.description || "No description"}
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {dataSource.source_type}
          </Badge>
          {dataSource.unit && (
            <Badge variant="outline">{dataSource.unit}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-muted-foreground">
            {dataSource.metrics_count === 0 ? (
              "No metrics using this source"
            ) : (
              `${dataSource.metrics_count} metric${dataSource.metrics_count === 1 ? "" : "s"} using this source`
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span className="ml-1.5">Test</span>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/settings/data-sources/${dataSource.id}`}>
                <Settings className="mr-1.5 h-4 w-4" />
                Edit
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={deleting || dataSource.metrics_count > 0}
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Data Source</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete &quot;{dataSource.name}&quot;? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`mt-3 rounded-lg p-3 text-sm ${
            testResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}>
            {testResult.success ? (
              <span>
                Test passed - This week value:{" "}
                <strong>{testResult.formatted_value || testResult.value}</strong>
              </span>
            ) : (
              <span>Test failed: {testResult.error}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DataSourceCardSkeleton() {
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
            <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            <div className="h-8 w-8 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// HubSpot icon component
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
