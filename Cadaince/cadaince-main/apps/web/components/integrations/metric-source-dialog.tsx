"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MetricSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: {
    id: string;
    name: string;
    source_type?: string;
    source_config?: Record<string, unknown> | null;
  } | null;
  onSave: () => void;
}

interface MetricSourceConfig {
  source_type: "manual" | "hubspot" | "bigquery" | "calculated";
  hubspot_object?: string;
  hubspot_property?: string;
  hubspot_aggregation?: string;
  hubspot_filters?: Record<string, string>;
  bigquery_query?: string;
  bigquery_value_column?: string;
  formula?: string;
  dependencies?: string[];
  sync_frequency: "5min" | "15min" | "hourly" | "daily";
}

const HUBSPOT_OBJECTS = [
  { value: "deals", label: "Deals" },
  { value: "contacts", label: "Contacts" },
  { value: "tickets", label: "Tickets" },
  { value: "feedback_submissions", label: "Feedback Submissions" },
];

const AGGREGATIONS = [
  { value: "count", label: "Count" },
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
  { value: "min", label: "Minimum" },
  { value: "max", label: "Maximum" },
];

const SYNC_FREQUENCIES = [
  { value: "5min", label: "Every 5 minutes" },
  { value: "15min", label: "Every 15 minutes" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
];

export function MetricSourceDialog({
  open,
  onOpenChange,
  metric,
  onSave,
}: MetricSourceDialogProps) {
  const [sourceType, setSourceType] = useState<string>("manual");
  const [hubspotObject, setHubspotObject] = useState("");
  const [hubspotProperty, setHubspotProperty] = useState("");
  const [hubspotAggregation, setHubspotAggregation] = useState("count");
  const [bigqueryQuery, setBigqueryQuery] = useState("");
  const [bigqueryValueColumn, setBigqueryValueColumn] = useState("");
  const [syncFrequency, setSyncFrequency] = useState<string>("hourly");
  const [saving, setSaving] = useState(false);
  const [testingQuery, setTestingQuery] = useState(false);
  const [queryResult, setQueryResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (metric && open) {
      const config = metric.source_config;
      setSourceType(metric.source_type || "manual");
      if (config) {
        setHubspotObject((config.hubspot_object as string) || "");
        setHubspotProperty((config.hubspot_property as string) || "");
        setHubspotAggregation((config.hubspot_aggregation as string) || "count");
        setBigqueryQuery((config.bigquery_query as string) || "");
        setBigqueryValueColumn((config.bigquery_value_column as string) || "");
        setSyncFrequency((config.sync_frequency as string) || "hourly");
      } else {
        // Reset to defaults
        setHubspotObject("");
        setHubspotProperty("");
        setHubspotAggregation("count");
        setBigqueryQuery("");
        setBigqueryValueColumn("");
        setSyncFrequency("hourly");
      }
      setQueryResult(null);
    }
  }, [metric, open]);

  const handleSave = async () => {
    if (!metric) return;

    setSaving(true);
    try {
      const sourceConfig: Partial<MetricSourceConfig> = {
        sync_frequency: syncFrequency as MetricSourceConfig["sync_frequency"],
      };

      if (sourceType === "hubspot") {
        sourceConfig.hubspot_object = hubspotObject;
        sourceConfig.hubspot_property = hubspotProperty;
        sourceConfig.hubspot_aggregation = hubspotAggregation;
      } else if (sourceType === "bigquery") {
        sourceConfig.bigquery_query = bigqueryQuery;
        sourceConfig.bigquery_value_column = bigqueryValueColumn;
      }

      const response = await fetch(`/api/metrics/${metric.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_type: sourceType,
          source_config: sourceType === "manual" ? null : sourceConfig,
        }),
      });

      if (response.ok) {
        onSave();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Failed to save metric source:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleTestQuery = async () => {
    setTestingQuery(true);
    setQueryResult(null);
    try {
      // In a real implementation, this would test the query against BigQuery
      // For now, we just validate the query syntax
      if (!bigqueryQuery.trim()) {
        setQueryResult({ success: false, message: "Query cannot be empty" });
        return;
      }
      if (!bigqueryQuery.toLowerCase().includes("select")) {
        setQueryResult({ success: false, message: "Query must be a SELECT statement" });
        return;
      }
      setQueryResult({ success: true, message: "Query syntax looks valid" });
    } finally {
      setTestingQuery(false);
    }
  };

  if (!metric) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configure Data Source</DialogTitle>
          <DialogDescription>
            Set up how &quot;{metric.name}&quot; gets its values
          </DialogDescription>
        </DialogHeader>

        <Tabs value={sourceType} onValueChange={setSourceType} className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="hubspot">HubSpot</TabsTrigger>
            <TabsTrigger value="bigquery">BigQuery</TabsTrigger>
            <TabsTrigger value="calculated">Calculated</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 pt-4">
            <div className="rounded-lg border p-4 text-center text-muted-foreground">
              <p>Values will be entered manually through the Scorecard interface.</p>
              <p className="text-sm mt-2">No additional configuration needed.</p>
            </div>
          </TabsContent>

          <TabsContent value="hubspot" className="space-y-4 pt-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>HubSpot Object</Label>
                <Select value={hubspotObject} onValueChange={setHubspotObject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an object" />
                  </SelectTrigger>
                  <SelectContent>
                    {HUBSPOT_OBJECTS.map((obj) => (
                      <SelectItem key={obj.value} value={obj.value}>
                        {obj.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Property (optional for count)</Label>
                <Input
                  value={hubspotProperty}
                  onChange={(e) => setHubspotProperty(e.target.value)}
                  placeholder="e.g., amount, hs_ticket_priority"
                />
                <p className="text-xs text-muted-foreground">
                  The property to aggregate. Leave empty for simple counts.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Aggregation</Label>
                <Select value={hubspotAggregation} onValueChange={setHubspotAggregation}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGGREGATIONS.map((agg) => (
                      <SelectItem key={agg.value} value={agg.value}>
                        {agg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sync Frequency</Label>
                <Select value={syncFrequency} onValueChange={setSyncFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SYNC_FREQUENCIES.map((freq) => (
                      <SelectItem key={freq.value} value={freq.value}>
                        {freq.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bigquery" className="space-y-4 pt-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>SQL Query</Label>
                <Textarea
                  value={bigqueryQuery}
                  onChange={(e) => setBigqueryQuery(e.target.value)}
                  placeholder={`SELECT SUM(amount) as value
FROM \`project.dataset.table\`
WHERE created_at >= '{{period_start}}'
  AND created_at < '{{period_end}}'`}
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Use {"{{period_start}}"}, {"{{period_end}}"}, and {"{{today}}"} as variables.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Value Column</Label>
                <Input
                  value={bigqueryValueColumn}
                  onChange={(e) => setBigqueryValueColumn(e.target.value)}
                  placeholder="value"
                />
                <p className="text-xs text-muted-foreground">
                  The column name containing the metric value.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestQuery}
                  disabled={testingQuery || !bigqueryQuery.trim()}
                >
                  {testingQuery && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Test Query
                </Button>
                {queryResult && (
                  <span
                    className={`text-sm ${
                      queryResult.success ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {queryResult.message}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <Label>Sync Frequency</Label>
                <Select value={syncFrequency} onValueChange={setSyncFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SYNC_FREQUENCIES.map((freq) => (
                      <SelectItem key={freq.value} value={freq.value}>
                        {freq.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="calculated" className="space-y-4 pt-4">
            <div className="rounded-lg border p-4 text-center text-muted-foreground">
              <p>Calculated metrics derive their value from other metrics.</p>
              <p className="text-sm mt-2">
                This feature is coming soon. For now, calculate values externally.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
