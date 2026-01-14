"use client";

import { useState, useEffect } from "react";
import {
  Database,
  Loader2,
  Check,
  AlertTriangle,
  BarChart3,
  Bell,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { IntegrationListItem } from "@/lib/integrations/oauth/types";
import { HubSpotPropertyPicker } from "./hubspot-property-picker";
import type { HubSpotObject } from "@/lib/integrations/providers/hubspot";

interface CreateDataSourceWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  preselectedIntegration?: IntegrationListItem;
}

type Step =
  | "select-integration"
  | "select-source-type"
  | "configure-query"
  | "select-destination"
  | "configure-destination"
  | "review";

interface SourceTypeOption {
  id: string;
  name: string;
  description: string;
  object: string;
  defaultProperty: string;
  suggestedProperties: string[];
  defaultFilters?: Array<{ propertyName: string; operator: string; value: string }>;
}

const HUBSPOT_SOURCE_TYPES: SourceTypeOption[] = [
  {
    id: "deals_pipeline",
    name: "Deals Pipeline",
    description: "Track deal counts and values by pipeline stage",
    object: "deals",
    defaultProperty: "amount",
    suggestedProperties: [
      "amount",
      "dealstage",
      "hs_deal_stage_probability",
      "hs_arr",
      "opportunity_type",
      "channel_type",
    ],
  },
  {
    id: "deals_won",
    name: "Won Deals",
    description: "Track closed-won deals",
    object: "deals",
    defaultProperty: "amount",
    suggestedProperties: [
      "amount",
      "closedate",
      "hs_arr",
      "gpv_full_year",
      "gp_full_year",
      "solution",
      "channel_type",
    ],
    defaultFilters: [{ propertyName: "dealstage", operator: "EQ", value: "closedwon" }],
  },
  {
    id: "deals_revenue_metrics",
    name: "Revenue Metrics",
    description: "Track GPV, GP, and fee-based revenue metrics",
    object: "deals",
    defaultProperty: "gpv_full_year",
    suggestedProperties: [
      "gpv_in_current_year",
      "gpv_full_year",
      "gp_in_current_year",
      "gp_full_year",
      "platform_fee",
      "setup_fee",
      "product_fee",
    ],
  },
  {
    id: "deals_classification",
    name: "Deal Classification",
    description: "Analyze deals by opportunity type, channel, and solution",
    object: "deals",
    defaultProperty: "amount",
    suggestedProperties: [
      "opportunity_type",
      "opportunity_description",
      "channel_type",
      "solution",
      "buyer_type",
      "integration_type",
    ],
  },
  {
    id: "contacts_count",
    name: "Contact Count",
    description: "Total contacts or contacts by lifecycle stage",
    object: "contacts",
    defaultProperty: "hs_object_id",
    suggestedProperties: ["lifecyclestage", "hs_lead_status"],
  },
  {
    id: "companies_count",
    name: "Company Count",
    description: "Track company records",
    object: "companies",
    defaultProperty: "hs_object_id",
    suggestedProperties: ["industry", "numberofemployees"],
  },
  {
    id: "tickets_open",
    name: "Open Tickets",
    description: "Track open support tickets",
    object: "tickets",
    defaultProperty: "hs_object_id",
    suggestedProperties: ["hs_pipeline_stage", "hs_ticket_priority"],
  },
  {
    id: "feedback_surveys",
    name: "Feedback Surveys",
    description: "NPS scores, CSAT ratings, and survey responses",
    object: "feedback_submissions",
    defaultProperty: "hs_response_value",
    suggestedProperties: ["hs_survey_type", "hs_response_value", "hs_sentiment"],
  },
  {
    id: "custom",
    name: "Custom Query",
    description: "Build a custom query with any object and property",
    object: "deals",
    defaultProperty: "amount",
    suggestedProperties: [],
  },
];

const DESTINATION_TYPES = [
  {
    id: "scorecard_metric",
    name: "Scorecard Metric",
    description: "Update a metric value on your scorecard",
    icon: BarChart3,
  },
  {
    id: "signal",
    name: "Signal",
    description: "Store as a signal for analysis and alerting",
    icon: Zap,
  },
  {
    id: "issue_detection",
    name: "Issue Detection",
    description: "Create issues when thresholds are breached",
    icon: AlertTriangle,
  },
];

const SYNC_FREQUENCIES = [
  { value: "5min", label: "Every 5 minutes" },
  { value: "15min", label: "Every 15 minutes" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "manual", label: "Manual only" },
];

const AGGREGATIONS = [
  { value: "count", label: "Count" },
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
  { value: "min", label: "Minimum" },
  { value: "max", label: "Maximum" },
];

export function CreateDataSourceWizard({
  open,
  onOpenChange,
  onCreated,
  preselectedIntegration,
}: CreateDataSourceWizardProps) {
  const [integrations, setIntegrations] = useState<IntegrationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Navigation
  const [step, setStep] = useState<Step>("select-integration");

  // Form state
  const [selectedIntegration, setSelectedIntegration] =
    useState<IntegrationListItem | null>(preselectedIntegration || null);
  const [selectedSourceType, setSelectedSourceType] =
    useState<SourceTypeOption | null>(null);

  // Query config
  const [object, setObject] = useState("deals");
  const [property, setProperty] = useState("amount");
  const [aggregation, setAggregation] = useState("sum");
  const [customProperty, setCustomProperty] = useState("");

  // Destination
  const [destinationType, setDestinationType] = useState("scorecard_metric");
  const [createNewMetric, setCreateNewMetric] = useState(true);
  const [metricName, setMetricName] = useState("");
  const [thresholdType, setThresholdType] = useState<"above" | "below">("below");
  const [thresholdValue, setThresholdValue] = useState("");

  // Final details
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [syncFrequency, setSyncFrequency] = useState("15min");

  useEffect(() => {
    if (open) {
      fetchIntegrations();
      if (preselectedIntegration) {
        setSelectedIntegration(preselectedIntegration);
        setStep("select-source-type");
      }
    }
  }, [open, preselectedIntegration]);

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/integrations-v2");
      if (response.ok) {
        const data = await response.json();
        // Filter to only active integrations
        const active = data.filter(
          (i: IntegrationListItem) => i.status === "active"
        );
        setIntegrations(active);
      }
    } catch (err) {
      console.error("Failed to fetch integrations:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(preselectedIntegration ? "select-source-type" : "select-integration");
    setSelectedIntegration(preselectedIntegration || null);
    setSelectedSourceType(null);
    setObject("deals");
    setProperty("amount");
    setAggregation("sum");
    setCustomProperty("");
    setDestinationType("scorecard_metric");
    setCreateNewMetric(true);
    setMetricName("");
    setThresholdType("below");
    setThresholdValue("");
    setName("");
    setDescription("");
    setSyncFrequency("15min");
    setError(null);
  };

  const handleIntegrationSelect = (integration: IntegrationListItem) => {
    setSelectedIntegration(integration);
    setStep("select-source-type");
  };

  const handleSourceTypeSelect = (sourceType: SourceTypeOption) => {
    setSelectedSourceType(sourceType);
    setObject(sourceType.object);
    setProperty(sourceType.defaultProperty);
    if (sourceType.id === "custom") {
      setStep("configure-query");
    } else {
      // Use defaults and skip to destination
      setStep("select-destination");
    }
  };

  const handleQueryNext = () => {
    const finalProperty = customProperty || property;
    if (!finalProperty) {
      setError("Property is required");
      return;
    }
    setProperty(finalProperty);
    setError(null);
    setStep("select-destination");
  };

  const handleDestinationSelect = (destType: string) => {
    setDestinationType(destType);
    setStep("configure-destination");
  };

  const handleDestinationConfigNext = () => {
    if (destinationType === "scorecard_metric" && createNewMetric && !metricName) {
      setError("Metric name is required");
      return;
    }
    if (destinationType === "issue_detection" && !thresholdValue) {
      setError("Threshold value is required");
      return;
    }
    setError(null);
    setStep("review");
  };

  const handleSubmit = async () => {
    if (!name) {
      setError("Name is required");
      return;
    }
    if (!selectedIntegration) {
      setError("Integration is required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Build query config
      const queryConfig = {
        object,
        property,
        aggregation,
        filters: selectedSourceType?.defaultFilters || [],
      };

      // Build destination config
      let destinationConfig: Record<string, unknown> = {};
      if (destinationType === "scorecard_metric") {
        destinationConfig = {
          create_if_missing: createNewMetric,
          metric_name: createNewMetric ? (metricName || name) : undefined,
        };
      } else if (destinationType === "issue_detection") {
        destinationConfig = {
          threshold_type: thresholdType,
          threshold_value: parseFloat(thresholdValue),
          issue_title_template: `${name}: {value}`,
        };
      }

      const response = await fetch("/api/integrations-v2/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integration_id: selectedIntegration.id,
          name,
          description: description || null,
          source_type: selectedSourceType?.id || "custom",
          query_config: queryConfig,
          destination_type: destinationType,
          destination_config: destinationConfig,
          sync_frequency: syncFrequency,
        }),
      });

      if (response.ok) {
        resetForm();
        onOpenChange(false);
        onCreated();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create data source");
      }
    } catch (err) {
      setError("Failed to create data source");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const getSourceTypesForProvider = (provider: string): SourceTypeOption[] => {
    switch (provider) {
      case "hubspot":
        return HUBSPOT_SOURCE_TYPES;
      default:
        return [
          {
            id: "custom",
            name: "Custom Query",
            description: "Build a custom query",
            object: "records",
            defaultProperty: "value",
            suggestedProperties: [],
          },
        ];
    }
  };

  const renderStep = () => {
    switch (step) {
      case "select-integration":
        return (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : integrations.length === 0 ? (
              <div className="text-center py-8">
                <Database className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">
                  No active integrations found.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => window.location.href = "/settings/integrations"}
                >
                  Connect an Integration
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {integrations.map((integration) => (
                  <button
                    key={integration.id}
                    onClick={() => handleIntegrationSelect(integration)}
                    className="w-full text-left rounded-lg border p-4 hover:border-primary transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium capitalize">
                          {integration.provider}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {integration.external_account_name ||
                            integration.display_name ||
                            "Connected"}
                        </p>
                      </div>
                      <Badge variant="secondary" className="capitalize">
                        {integration.provider}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case "select-source-type":
        const sourceTypes = selectedIntegration
          ? getSourceTypesForProvider(selectedIntegration.provider)
          : [];
        return (
          <div className="space-y-4">
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {sourceTypes.map((sourceType) => (
                <button
                  key={sourceType.id}
                  onClick={() => handleSourceTypeSelect(sourceType)}
                  className={cn(
                    "w-full text-left rounded-lg border p-4 hover:border-primary transition-colors",
                    selectedSourceType?.id === sourceType.id &&
                      "border-primary bg-primary/5"
                  )}
                >
                  <h4 className="font-medium">{sourceType.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {sourceType.description}
                  </p>
                </button>
              ))}
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setStep("select-integration")}
              >
                Back
              </Button>
            </div>
          </div>
        );

      case "configure-query":
        return (
          <div className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Object</Label>
                <Select value={object} onValueChange={setObject}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deals">Deals</SelectItem>
                    <SelectItem value="contacts">Contacts</SelectItem>
                    <SelectItem value="companies">Companies</SelectItem>
                    <SelectItem value="tickets">Tickets</SelectItem>
                    <SelectItem value="feedback_submissions">
                      Feedback
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Property</Label>
                {selectedIntegration?.provider === "hubspot" ? (
                  <HubSpotPropertyPicker
                    object={object as HubSpotObject}
                    value={property}
                    onChange={(value) => {
                      setProperty(value);
                      setCustomProperty("");
                    }}
                  />
                ) : (
                  <Input
                    placeholder="e.g., amount, hs_object_id"
                    value={customProperty || property}
                    onChange={(e) => setCustomProperty(e.target.value)}
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  The property to fetch and aggregate
                </p>
              </div>

              <div className="space-y-2">
                <Label>Aggregation</Label>
                <Select value={aggregation} onValueChange={setAggregation}>
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
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setStep("select-source-type")}
              >
                Back
              </Button>
              <Button onClick={handleQueryNext}>Continue</Button>
            </div>
          </div>
        );

      case "select-destination":
        return (
          <div className="space-y-4">
            <div className="grid gap-3">
              {DESTINATION_TYPES.map((dest) => (
                <button
                  key={dest.id}
                  onClick={() => handleDestinationSelect(dest.id)}
                  className={cn(
                    "flex items-start gap-4 rounded-lg border p-4 text-left hover:border-primary transition-colors",
                    destinationType === dest.id && "border-primary bg-primary/5"
                  )}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <dest.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-medium">{dest.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {dest.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() =>
                  setStep(
                    selectedSourceType?.id === "custom"
                      ? "configure-query"
                      : "select-source-type"
                  )
                }
              >
                Back
              </Button>
            </div>
          </div>
        );

      case "configure-destination":
        return (
          <div className="space-y-4">
            {destinationType === "scorecard_metric" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="create-new"
                    checked={createNewMetric}
                    onChange={(e) => setCreateNewMetric(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="create-new">
                    Create a new scorecard metric
                  </Label>
                </div>

                {createNewMetric && (
                  <div className="space-y-2">
                    <Label>Metric Name</Label>
                    <Input
                      placeholder="e.g., Monthly Deal Revenue"
                      value={metricName}
                      onChange={(e) => setMetricName(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {destinationType === "issue_detection" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Threshold Type</Label>
                  <Select
                    value={thresholdType}
                    onValueChange={(v) => setThresholdType(v as "above" | "below")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="below">
                        Create issue when value is BELOW threshold
                      </SelectItem>
                      <SelectItem value="above">
                        Create issue when value is ABOVE threshold
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Threshold Value</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 100"
                    value={thresholdValue}
                    onChange={(e) => setThresholdValue(e.target.value)}
                  />
                </div>
              </div>
            )}

            {destinationType === "signal" && (
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  Signals are stored for analysis and can trigger alerts. No
                  additional configuration needed.
                </p>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setStep("select-destination")}
              >
                Back
              </Button>
              <Button onClick={handleDestinationConfigNext}>Continue</Button>
            </div>
          </div>
        );

      case "review":
        return (
          <div className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Data Source Name *</Label>
                <Input
                  placeholder="e.g., Monthly Won Deals"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="What data does this source pull?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
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

              {/* Summary */}
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <h4 className="font-medium">Summary</h4>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-muted-foreground">Integration:</span>{" "}
                    <span className="capitalize">
                      {selectedIntegration?.provider}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Source Type:</span>{" "}
                    {selectedSourceType?.name}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Query:</span>{" "}
                    {aggregation}({property}) from {object}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Destination:</span>{" "}
                    {DESTINATION_TYPES.find((d) => d.id === destinationType)?.name}
                  </p>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setStep("configure-destination")}
              >
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || !name}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Create Data Source
              </Button>
            </div>
          </div>
        );
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case "select-integration":
        return "Select Integration";
      case "select-source-type":
        return "Select Source Type";
      case "configure-query":
        return "Configure Query";
      case "select-destination":
        return "Select Destination";
      case "configure-destination":
        return "Configure Destination";
      case "review":
        return "Review & Create";
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case "select-integration":
        return "Choose which integration to pull data from.";
      case "select-source-type":
        return "What type of data do you want to fetch?";
      case "configure-query":
        return "Configure the query parameters.";
      case "select-destination":
        return "Where should the data go?";
      case "configure-destination":
        return "Configure the destination settings.";
      case "review":
        return "Review and create your data source.";
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
          <DialogDescription>{getStepDescription()}</DialogDescription>
        </DialogHeader>

        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}
