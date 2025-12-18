"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface HubSpotConfigProps {
  integration: {
    id: string;
    config: Record<string, unknown>;
    is_active: boolean;
    credentials_set: boolean;
    last_error: string | null;
  };
  onUpdate: () => void;
}

export function HubSpotConfig({ integration, onUpdate }: HubSpotConfigProps) {
  const [portalId, setPortalId] = useState((integration.config.portal_id as string) || "");
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
            portal_id: portalId,
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

  const scopes = (integration.config.scopes as string[]) || [];

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection Status</CardTitle>
          <CardDescription>
            Test your HubSpot connection and view available scopes
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
                {testResult.details?.available_scopes && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(testResult.details.available_scopes as string[]).map((scope) => (
                      <Badge key={scope} variant="secondary" className="text-xs">
                        {scope}
                      </Badge>
                    ))}
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
            Configure your HubSpot integration settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="portal-id">Portal ID</Label>
            <Input
              id="portal-id"
              value={portalId}
              onChange={(e) => setPortalId(e.target.value)}
              placeholder="Enter your HubSpot Portal ID"
            />
            <p className="text-xs text-muted-foreground">
              You can find this in your HubSpot account settings
            </p>
          </div>

          <div className="space-y-2">
            <Label>Access Token</Label>
            <p className="text-sm text-muted-foreground">
              The access token is configured via the <code className="rounded bg-muted px-1.5 py-0.5 text-xs">HUBSPOT_ACCESS_TOKEN</code> environment variable.
            </p>
          </div>

          <Separator />

          <Button onClick={handleSaveConfig} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Configuration
          </Button>
        </CardContent>
      </Card>

      {/* Available Objects */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Objects</CardTitle>
          <CardDescription>
            HubSpot objects you can sync to Scorecard metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {[
              { name: "Deals", description: "Pipeline value, deal counts, win rates" },
              { name: "Contacts", description: "Customer counts, lifecycle stages" },
              { name: "Tickets", description: "Support ticket counts, resolution times" },
              { name: "Feedback Submissions", description: "NPS scores, CSAT ratings" },
            ].map((obj) => (
              <div key={obj.name} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">{obj.name}</div>
                  <div className="text-sm text-muted-foreground">{obj.description}</div>
                </div>
                <Badge variant="outline">Available</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
