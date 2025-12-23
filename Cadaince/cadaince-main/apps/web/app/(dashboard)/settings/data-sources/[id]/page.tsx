"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Database, Loader2, Play, Save } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DataSource {
  id: string;
  name: string;
  description: string | null;
  source_type: "hubspot" | "bigquery";
  hubspot_object: string | null;
  hubspot_property: string | null;
  hubspot_aggregation: string | null;
  hubspot_filters: unknown[] | null;
  bigquery_query: string | null;
  bigquery_value_column: string | null;
  unit: string | null;
  metrics: Array<{
    id: string;
    name: string;
    metric_type: string;
    time_windows: string[];
    last_sync_at: string | null;
    sync_error: string | null;
  }>;
}

export default function EditDataSourcePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    value?: number;
    formatted_value?: string;
    error?: string;
  } | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("");
  const [hubspotObject, setHubspotObject] = useState("");
  const [hubspotProperty, setHubspotProperty] = useState("");
  const [hubspotAggregation, setHubspotAggregation] = useState("");
  const [bigqueryQuery, setBigqueryQuery] = useState("");
  const [bigqueryValueColumn, setBigqueryValueColumn] = useState("");

  useEffect(() => {
    const fetchDataSource = async () => {
      try {
        const response = await fetch(`/api/data-sources/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch data source");
        }
        const data = await response.json();
        setDataSource(data);

        // Populate form
        setName(data.name || "");
        setDescription(data.description || "");
        setUnit(data.unit || "");
        setHubspotObject(data.hubspot_object || "");
        setHubspotProperty(data.hubspot_property || "");
        setHubspotAggregation(data.hubspot_aggregation || "");
        setBigqueryQuery(data.bigquery_query || "");
        setBigqueryValueColumn(data.bigquery_value_column || "");
      } catch (err) {
        setError("Failed to load data source");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDataSource();
  }, [id]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/data-sources/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          unit: unit || null,
          hubspot_object: dataSource?.source_type === "hubspot" ? hubspotObject : null,
          hubspot_property: dataSource?.source_type === "hubspot" ? hubspotProperty : null,
          hubspot_aggregation: dataSource?.source_type === "hubspot" ? hubspotAggregation : null,
          bigquery_query: dataSource?.source_type === "bigquery" ? bigqueryQuery : null,
          bigquery_value_column: dataSource?.source_type === "bigquery" ? bigqueryValueColumn : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update data source");
      }

      setSuccess("Data source updated successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update data source");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`/api/data-sources/${id}/test`, {
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
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dataSource) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/settings/data-sources">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Data Sources
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertDescription>Data source not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings/data-sources">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Edit Data Source</h1>
            <p className="text-sm text-muted-foreground">
              Modify the configuration for this data source
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {dataSource.source_type}
          </Badge>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>
                Basic information about this data source
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="$">$ (Currency)</SelectItem>
                    <SelectItem value="%">% (Percentage)</SelectItem>
                    <SelectItem value="count">Count</SelectItem>
                    <SelectItem value="users">Users</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Source Configuration */}
          {dataSource.source_type === "hubspot" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HubSpotIcon className="h-5 w-5 text-orange-600" />
                  HubSpot Configuration
                </CardTitle>
                <CardDescription>
                  Configure the HubSpot object, property, and aggregation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="hubspot-object">Object</Label>
                  <Select value={hubspotObject} onValueChange={setHubspotObject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select HubSpot object" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deals">Deals</SelectItem>
                      <SelectItem value="contacts">Contacts</SelectItem>
                      <SelectItem value="tickets">Tickets</SelectItem>
                      <SelectItem value="feedback_submissions">Feedback Submissions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hubspot-property">Property</Label>
                  <Input
                    id="hubspot-property"
                    value={hubspotProperty}
                    onChange={(e) => setHubspotProperty(e.target.value)}
                    placeholder="e.g., amount, hs_lead_status"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hubspot-aggregation">Aggregation</Label>
                  <Select value={hubspotAggregation} onValueChange={setHubspotAggregation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select aggregation method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sum">Sum</SelectItem>
                      <SelectItem value="avg">Average</SelectItem>
                      <SelectItem value="count">Count</SelectItem>
                      <SelectItem value="min">Minimum</SelectItem>
                      <SelectItem value="max">Maximum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {dataSource.source_type === "bigquery" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  BigQuery Configuration
                </CardTitle>
                <CardDescription>
                  Configure the SQL query and value column
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bigquery-query">SQL Query</Label>
                  <Textarea
                    id="bigquery-query"
                    value={bigqueryQuery}
                    onChange={(e) => setBigqueryQuery(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Must include {"{{start}}"} and {"{{end}}"} placeholders for date filtering
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bigquery-value-column">Value Column</Label>
                  <Input
                    id="bigquery-value-column"
                    value={bigqueryValueColumn}
                    onChange={(e) => setBigqueryValueColumn(e.target.value)}
                    placeholder="e.g., value, total_amount"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Save Button */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Test Query
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>

          {/* Test Result */}
          {testResult && (
            <Card className={testResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <CardContent className="pt-6">
                {testResult.success ? (
                  <p className="text-green-800">
                    Test passed - This week value:{" "}
                    <strong>{testResult.formatted_value || testResult.value}</strong>
                  </p>
                ) : (
                  <p className="text-red-800">Test failed: {testResult.error}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metrics Using This Source</CardTitle>
            </CardHeader>
            <CardContent>
              {dataSource.metrics.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No metrics are using this data source yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {dataSource.metrics.map((metric) => (
                    <li key={metric.id} className="text-sm">
                      <div className="font-medium">{metric.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {metric.metric_type === "multi_window"
                          ? `Windows: ${metric.time_windows.join(", ")}`
                          : metric.metric_type}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Time Window Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li><strong>day</strong> - Today</li>
                <li><strong>week</strong> - This Week (Mon-Sun)</li>
                <li><strong>mtd</strong> - Month to Date</li>
                <li><strong>qtd</strong> - Quarter to Date</li>
                <li><strong>ytd</strong> - Year to Date</li>
                <li><strong>trailing_7</strong> - Last 7 Days</li>
                <li><strong>trailing_30</strong> - Last 30 Days</li>
                <li><strong>trailing_90</strong> - Last 90 Days</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
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
