"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface BigQueryConfigProps {
  integration: {
    id: string;
    config: Record<string, unknown>;
    is_active: boolean;
    credentials_set: boolean;
    last_error: string | null;
  };
  onUpdate: () => void;
}

export function BigQueryConfig({ integration, onUpdate }: BigQueryConfigProps) {
  const [projectId, setProjectId] = useState((integration.config.project_id as string) || "");
  const [dataset, setDataset] = useState((integration.config.dataset as string) || "");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: Record<string, unknown>;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`/api/integrations/${integration.id}/test`, {
        method: "POST",
      });
      const result = await response.json();
      setTestResult(result);
      if (result.success) {
        onUpdate();
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: "Failed to test connection",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/integrations/${integration.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            ...integration.config,
            project_id: projectId,
            dataset,
          },
        }),
      });
      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/integrations/${integration.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_active: !integration.is_active,
        }),
      });
      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to toggle integration:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection Status</CardTitle>
          <CardDescription>
            Test your BigQuery connection and view configuration status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Status</div>
              <div className="text-sm text-muted-foreground">
                {integration.credentials_set
                  ? integration.is_active
                    ? "Connected and active"
                    : "Connected but disabled"
                  : "Not configured"}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Test Connection
              </Button>
              {integration.credentials_set && (
                <Button
                  variant={integration.is_active ? "outline" : "default"}
                  onClick={handleToggleActive}
                  disabled={saving}
                >
                  {integration.is_active ? "Disable" : "Enable"}
                </Button>
              )}
            </div>
          </div>

          {testResult && (
            <div
              className={`flex items-start gap-2 rounded-lg p-3 ${
                testResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <div className="flex-1">
                <div className="font-medium">{testResult.message}</div>
                {testResult.details && (
                  <div className="mt-1 text-sm">
                    {typeof testResult.details.service_account === "string" && (
                      <div>Service Account: {testResult.details.service_account}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {integration.last_error && !testResult && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-red-800">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>{integration.last_error}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
          <CardDescription>
            Configure your BigQuery integration settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-id">Project ID</Label>
            <Input
              id="project-id"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="your-gcp-project-id"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataset">Default Dataset</Label>
            <Input
              id="dataset"
              value={dataset}
              onChange={(e) => setDataset(e.target.value)}
              placeholder="your_dataset_name"
            />
            <p className="text-xs text-muted-foreground">
              Default dataset for metric queries
            </p>
          </div>

          <div className="space-y-2">
            <Label>Service Account Key</Label>
            <p className="text-sm text-muted-foreground">
              The service account key is configured via the{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">BIGQUERY_SERVICE_ACCOUNT_KEY</code>{" "}
              environment variable.
            </p>
          </div>

          <Separator />

          <Button onClick={handleSaveConfig} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Configuration
          </Button>
        </CardContent>
      </Card>

      {/* Query Variables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Query Variables</CardTitle>
          <CardDescription>
            Variables available in metric queries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="rounded-lg border p-3">
              <code className="text-sm font-mono">{"{{period_start}}"}</code>
              <p className="text-sm text-muted-foreground mt-1">
                Start of the current period (based on metric frequency)
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <code className="text-sm font-mono">{"{{period_end}}"}</code>
              <p className="text-sm text-muted-foreground mt-1">
                End of the current period
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <code className="text-sm font-mono">{"{{today}}"}</code>
              <p className="text-sm text-muted-foreground mt-1">
                Current date (YYYY-MM-DD format)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Example Query */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Example Query</CardTitle>
          <CardDescription>
            Sample BigQuery query for a metric
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            readOnly
            className="font-mono text-sm"
            rows={8}
            value={`SELECT
  SUM(amount) as value
FROM
  \`${projectId || "project"}.${dataset || "dataset"}.transactions\`
WHERE
  created_at >= '{{period_start}}'
  AND created_at < '{{period_end}}'`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
