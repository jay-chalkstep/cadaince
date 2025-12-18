"use client";

import { useState, useEffect } from "react";
import { Database, FileText, Loader2, Plus, Check } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface DataSource {
  id: string;
  name: string;
  description: string | null;
  source_type: "hubspot" | "bigquery";
  unit: string | null;
}

interface CreateMetricWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

type Step = "path" | "manual" | "select-source" | "configure-windows" | "set-goals" | "preview";
type MetricPath = "manual" | "data-source";

const TIME_WINDOWS = [
  { value: "week", label: "Weekly (W)", shortLabel: "W" },
  { value: "mtd", label: "Month to Date (M)", shortLabel: "M" },
  { value: "ytd", label: "Year to Date (YTD)", shortLabel: "YTD" },
  { value: "qtd", label: "Quarter to Date (Q)", shortLabel: "Q" },
  { value: "day", label: "Today (D)", shortLabel: "D" },
  { value: "trailing_7", label: "Last 7 Days", shortLabel: "7D" },
  { value: "trailing_30", label: "Last 30 Days", shortLabel: "30D" },
  { value: "trailing_90", label: "Last 90 Days", shortLabel: "90D" },
];

export function CreateMetricWizard({
  open,
  onOpenChange,
  onCreated,
}: CreateMetricWizardProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Navigation state
  const [step, setStep] = useState<Step>("path");
  const [metricPath, setMetricPath] = useState<MetricPath | null>(null);

  // Manual metric form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [goal, setGoal] = useState("");
  const [unit, setUnit] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [thresholdRed, setThresholdRed] = useState("");
  const [thresholdYellow, setThresholdYellow] = useState("");

  // Data source metric form
  const [selectedDataSource, setSelectedDataSource] = useState<DataSource | null>(null);
  const [windowType, setWindowType] = useState<"single" | "multi">("multi");
  const [singleWindow, setSingleWindow] = useState("mtd");
  const [selectedWindows, setSelectedWindows] = useState<string[]>(["week", "mtd", "ytd"]);
  const [goalsByWindow, setGoalsByWindow] = useState<Record<string, string>>({});
  const [thresholdsByWindow, setThresholdsByWindow] = useState<Record<string, { yellow: string; red: string }>>({});
  const [syncFrequency, setSyncFrequency] = useState("15min");

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profilesRes, dataSourcesRes] = await Promise.all([
        fetch("/api/profiles"),
        fetch("/api/data-sources"),
      ]);

      if (profilesRes.ok) {
        const profilesData = await profilesRes.json();
        setProfiles(profilesData);
      }

      if (dataSourcesRes.ok) {
        const dataSourcesData = await dataSourcesRes.json();
        setDataSources(dataSourcesData);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep("path");
    setMetricPath(null);
    setName("");
    setDescription("");
    setOwnerId("");
    setGoal("");
    setUnit("");
    setFrequency("weekly");
    setThresholdRed("");
    setThresholdYellow("");
    setSelectedDataSource(null);
    setWindowType("multi");
    setSingleWindow("mtd");
    setSelectedWindows(["week", "mtd", "ytd"]);
    setGoalsByWindow({});
    setThresholdsByWindow({});
    setSyncFrequency("15min");
    setError(null);
  };

  const handlePathSelect = (path: MetricPath) => {
    setMetricPath(path);
    setStep(path === "manual" ? "manual" : "select-source");
  };

  const handleDataSourceSelect = (ds: DataSource) => {
    setSelectedDataSource(ds);
    if (ds.unit) setUnit(ds.unit);
    setStep("configure-windows");
  };

  const handleWindowsNext = () => {
    if (windowType === "multi" && selectedWindows.length === 0) {
      setError("Please select at least one time window");
      return;
    }
    setError(null);
    setStep("set-goals");
  };

  const handleGoalsNext = () => {
    setStep("preview");
  };

  const toggleWindow = (window: string) => {
    setSelectedWindows((prev) =>
      prev.includes(window)
        ? prev.filter((w) => w !== window)
        : [...prev, window]
    );
  };

  const handleSubmitManual = async () => {
    if (!name || !ownerId) {
      setError("Name and owner are required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          owner_id: ownerId,
          goal: goal ? parseFloat(goal) : null,
          unit: unit || null,
          frequency,
          threshold_red: thresholdRed ? parseFloat(thresholdRed) : null,
          threshold_yellow: thresholdYellow ? parseFloat(thresholdYellow) : null,
          metric_type: "manual",
        }),
      });

      if (response.ok) {
        resetForm();
        onOpenChange(false);
        onCreated();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create metric");
      }
    } catch (error) {
      setError("Failed to create metric");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDataSource = async () => {
    if (!name || !ownerId || !selectedDataSource) {
      setError("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const effectiveWindows = windowType === "single" ? [singleWindow] : selectedWindows;
      const metricType = windowType === "single" ? "single_window" : "multi_window";

      // Build goals and thresholds
      const goals: Record<string, number> = {};
      const thresholds: Record<string, { yellow: number; red: number }> = {};

      effectiveWindows.forEach((w) => {
        if (goalsByWindow[w]) {
          goals[w] = parseFloat(goalsByWindow[w]);
        }
        if (thresholdsByWindow[w]?.yellow || thresholdsByWindow[w]?.red) {
          thresholds[w] = {
            yellow: parseFloat(thresholdsByWindow[w]?.yellow || "0"),
            red: parseFloat(thresholdsByWindow[w]?.red || "0"),
          };
        }
      });

      const response = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          owner_id: ownerId,
          unit: unit || selectedDataSource.unit || null,
          metric_type: metricType,
          data_source_id: selectedDataSource.id,
          time_window: windowType === "single" ? singleWindow : null,
          time_windows: windowType === "multi" ? selectedWindows : null,
          goals_by_window: windowType === "multi" ? goals : null,
          thresholds_by_window: windowType === "multi" ? thresholds : null,
          goal: windowType === "single" && goalsByWindow[singleWindow] ? parseFloat(goalsByWindow[singleWindow]) : null,
          threshold_red: windowType === "single" && thresholdsByWindow[singleWindow]?.red ? parseFloat(thresholdsByWindow[singleWindow].red) : null,
          threshold_yellow: windowType === "single" && thresholdsByWindow[singleWindow]?.yellow ? parseFloat(thresholdsByWindow[singleWindow].yellow) : null,
          sync_frequency: syncFrequency,
        }),
      });

      if (response.ok) {
        resetForm();
        onOpenChange(false);
        onCreated();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create metric");
      }
    } catch (error) {
      setError("Failed to create metric");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case "path":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 py-4">
              <button
                onClick={() => handlePathSelect("manual")}
                className="flex flex-col items-center gap-3 rounded-lg border-2 border-muted p-6 hover:border-primary transition-colors"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <h3 className="font-medium">Manual Entry</h3>
                  <p className="text-sm text-muted-foreground">
                    Enter values manually each period
                  </p>
                </div>
              </button>
              <button
                onClick={() => handlePathSelect("data-source")}
                className="flex flex-col items-center gap-3 rounded-lg border-2 border-muted p-6 hover:border-primary transition-colors"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <Database className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-center">
                  <h3 className="font-medium">From Data Source</h3>
                  <p className="text-sm text-muted-foreground">
                    Auto-sync from HubSpot or BigQuery
                  </p>
                </div>
              </button>
            </div>
          </div>
        );

      case "manual":
        return (
          <form onSubmit={(e) => { e.preventDefault(); handleSubmitManual(); }} className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Weekly Sales Revenue"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="What does this metric measure?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="owner">Owner *</Label>
                <Select value={ownerId} onValueChange={setOwnerId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {loading ? (
                      <SelectItem value="__loading__" disabled>Loading...</SelectItem>
                    ) : (
                      profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.full_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="goal">Goal</Label>
                  <Input
                    id="goal"
                    type="number"
                    step="any"
                    placeholder="Target value"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    placeholder="e.g., %, $, users"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="threshold-yellow">Yellow Threshold</Label>
                  <Input
                    id="threshold-yellow"
                    type="number"
                    step="any"
                    placeholder="At risk below"
                    value={thresholdYellow}
                    onChange={(e) => setThresholdYellow(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="threshold-red">Red Threshold</Label>
                  <Input
                    id="threshold-red"
                    type="number"
                    step="any"
                    placeholder="Off track below"
                    value={thresholdRed}
                    onChange={(e) => setThresholdRed(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-between pt-4">
              <Button type="button" variant="outline" onClick={() => setStep("path")}>
                Back
              </Button>
              <Button type="submit" disabled={submitting || !name || !ownerId}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Metric
              </Button>
            </div>
          </form>
        );

      case "select-source":
        return (
          <div className="space-y-4">
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {dataSources.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No data sources available.</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => window.open("/settings/data-sources", "_blank")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Data Source
                  </Button>
                </div>
              ) : (
                dataSources.map((ds) => (
                  <button
                    key={ds.id}
                    onClick={() => handleDataSourceSelect(ds)}
                    className={cn(
                      "w-full text-left rounded-lg border p-4 hover:border-primary transition-colors",
                      selectedDataSource?.id === ds.id && "border-primary bg-primary/5"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{ds.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {ds.description || "No description"}
                        </p>
                      </div>
                      <Badge variant="secondary" className="capitalize">
                        {ds.source_type}
                      </Badge>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep("path")}>
                Back
              </Button>
            </div>
          </div>
        );

      case "configure-windows":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label>Display Type</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setWindowType("single")}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-colors",
                      windowType === "single" && "border-primary bg-primary/5"
                    )}
                  >
                    <h4 className="font-medium">Single Window</h4>
                    <p className="text-sm text-muted-foreground">
                      Show one value (e.g., &quot;MTD Revenue&quot;)
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWindowType("multi")}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-colors",
                      windowType === "multi" && "border-primary bg-primary/5"
                    )}
                  >
                    <h4 className="font-medium">Multiple Windows</h4>
                    <p className="text-sm text-muted-foreground">
                      Show W / M / YTD in one row
                    </p>
                  </button>
                </div>
              </div>

              {windowType === "single" && (
                <div className="space-y-2">
                  <Label>Time Window</Label>
                  <Select value={singleWindow} onValueChange={setSingleWindow}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_WINDOWS.map((tw) => (
                        <SelectItem key={tw.value} value={tw.value}>
                          {tw.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {windowType === "multi" && (
                <div className="space-y-2">
                  <Label>Select Windows to Display</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {TIME_WINDOWS.map((tw) => (
                      <label
                        key={tw.value}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors",
                          selectedWindows.includes(tw.value) && "border-primary bg-primary/5"
                        )}
                      >
                        <Checkbox
                          checked={selectedWindows.includes(tw.value)}
                          onCheckedChange={() => toggleWindow(tw.value)}
                        />
                        <span className="text-sm">{tw.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep("select-source")}>
                Back
              </Button>
              <Button onClick={handleWindowsNext}>Continue</Button>
            </div>
          </div>
        );

      case "set-goals":
        const effectiveWindows = windowType === "single" ? [singleWindow] : selectedWindows;
        return (
          <div className="space-y-6">
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {effectiveWindows.map((window) => {
                const windowInfo = TIME_WINDOWS.find((tw) => tw.value === window);
                return (
                  <div key={window} className="rounded-lg border p-4 space-y-3">
                    <h4 className="font-medium">{windowInfo?.label || window}</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Goal</Label>
                        <Input
                          type="number"
                          step="any"
                          placeholder="Target"
                          value={goalsByWindow[window] || ""}
                          onChange={(e) =>
                            setGoalsByWindow((prev) => ({
                              ...prev,
                              [window]: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Yellow &lt;</Label>
                        <Input
                          type="number"
                          step="any"
                          placeholder="At risk"
                          value={thresholdsByWindow[window]?.yellow || ""}
                          onChange={(e) =>
                            setThresholdsByWindow((prev) => ({
                              ...prev,
                              [window]: { ...prev[window], yellow: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Red &lt;</Label>
                        <Input
                          type="number"
                          step="any"
                          placeholder="Off track"
                          value={thresholdsByWindow[window]?.red || ""}
                          onChange={(e) =>
                            setThresholdsByWindow((prev) => ({
                              ...prev,
                              [window]: { ...prev[window], red: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep("configure-windows")}>
                Back
              </Button>
              <Button onClick={handleGoalsNext}>Continue</Button>
            </div>
          </div>
        );

      case "preview":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="metric-name">Metric Name *</Label>
                <Input
                  id="metric-name"
                  placeholder="e.g., Digital Prepaid Issued"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="metric-description">Description</Label>
                <Textarea
                  id="metric-description"
                  placeholder="What does this metric measure?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="metric-owner">Owner *</Label>
                  <Select value={ownerId} onValueChange={setOwnerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sync-freq">Sync Frequency</Label>
                  <Select value={syncFrequency} onValueChange={setSyncFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5min">Every 5 minutes</SelectItem>
                      <SelectItem value="15min">Every 15 minutes</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Preview Card */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <h4 className="font-medium mb-2">Preview</h4>
                <div className="rounded border bg-background p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{name || "Metric Name"}</span>
                    <div className="flex items-center gap-4">
                      {(windowType === "single" ? [singleWindow] : selectedWindows).map((w) => {
                        const windowInfo = TIME_WINDOWS.find((tw) => tw.value === w);
                        return (
                          <div key={w} className="text-center">
                            <div className="text-xs text-muted-foreground">
                              {windowInfo?.shortLabel}
                            </div>
                            <div className="font-mono text-sm">--</div>
                          </div>
                        );
                      })}
                      <div className="text-sm text-muted-foreground">
                        {profiles.find((p) => p.id === ownerId)?.full_name || "Owner"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep("set-goals")}>
                Back
              </Button>
              <Button onClick={handleSubmitDataSource} disabled={submitting || !name || !ownerId}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Create Metric
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => {
      onOpenChange(value);
      if (!value) resetForm();
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "path" && "Create Metric"}
            {step === "manual" && "Create Manual Metric"}
            {step === "select-source" && "Select Data Source"}
            {step === "configure-windows" && "Configure Time Windows"}
            {step === "set-goals" && "Set Goals & Thresholds"}
            {step === "preview" && "Metric Details & Preview"}
          </DialogTitle>
          <DialogDescription>
            {step === "path" && "Choose how you want to track this metric."}
            {step === "manual" && "Enter metric details for manual tracking."}
            {step === "select-source" && "Choose a data source to sync from."}
            {step === "configure-windows" && "Choose which time windows to display."}
            {step === "set-goals" && "Set goals and thresholds for each window."}
            {step === "preview" && "Review and create your metric."}
          </DialogDescription>
        </DialogHeader>

        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}
