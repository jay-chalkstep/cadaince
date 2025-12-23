"use client";

import { useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateDataSourceDialogProps {
  children: React.ReactNode;
  onCreated?: () => void;
}

type Step = "type" | "config" | "details";

export function CreateDataSourceDialog({ children, onCreated }: CreateDataSourceDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("type");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [sourceType, setSourceType] = useState<"hubspot" | "bigquery" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("");

  // HubSpot config
  const [hubspotObject, setHubspotObject] = useState<string>("");
  const [hubspotProperty, setHubspotProperty] = useState("");
  const [hubspotAggregation, setHubspotAggregation] = useState<string>("");

  // BigQuery config
  const [bigqueryQuery, setBigqueryQuery] = useState("");
  const [bigqueryValueColumn, setBigqueryValueColumn] = useState("");

  const resetForm = () => {
    setStep("type");
    setSourceType(null);
    setName("");
    setDescription("");
    setUnit("");
    setHubspotObject("");
    setHubspotProperty("");
    setHubspotAggregation("");
    setBigqueryQuery("");
    setBigqueryValueColumn("");
    setError(null);
  };

  const handleTypeSelect = (type: "hubspot" | "bigquery") => {
    setSourceType(type);
    setStep("config");
  };

  const handleConfigNext = () => {
    if (sourceType === "hubspot") {
      if (!hubspotObject || !hubspotProperty || !hubspotAggregation) {
        setError("Please fill in all required fields");
        return;
      }
    } else if (sourceType === "bigquery") {
      if (!bigqueryQuery || !bigqueryValueColumn) {
        setError("Please fill in all required fields");
        return;
      }
      if (!bigqueryQuery.includes("{{start}}") || !bigqueryQuery.includes("{{end}}")) {
        setError("Query must include {{start}} and {{end}} placeholders");
        return;
      }
    }
    setError(null);
    setStep("details");
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          source_type: sourceType,
          unit: unit.trim() || null,
          hubspot_object: sourceType === "hubspot" ? hubspotObject : null,
          hubspot_property: sourceType === "hubspot" ? hubspotProperty : null,
          hubspot_aggregation: sourceType === "hubspot" ? hubspotAggregation : null,
          bigquery_query: sourceType === "bigquery" ? bigqueryQuery : null,
          bigquery_value_column: sourceType === "bigquery" ? bigqueryValueColumn : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create data source");
      }

      resetForm();
      setOpen(false);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create data source");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => {
      setOpen(value);
      if (!value) resetForm();
    }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Create Data Source</DialogTitle>
          <DialogDescription>
            {step === "type" && "Choose the type of data source to create."}
            {step === "config" && `Configure your ${sourceType === "hubspot" ? "HubSpot" : "BigQuery"} data source.`}
            {step === "details" && "Add name and details for your data source."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Choose Type */}
        {step === "type" && (
          <div className="grid grid-cols-2 gap-4 py-4">
            <button
              onClick={() => handleTypeSelect("hubspot")}
              className="flex flex-col items-center gap-3 rounded-lg border-2 border-muted p-6 hover:border-primary transition-colors"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
                <HubSpotIcon className="h-6 w-6 text-orange-600" />
              </div>
              <div className="text-center">
                <h3 className="font-medium">HubSpot</h3>
                <p className="text-sm text-muted-foreground">
                  CRM data like deals, contacts, tickets
                </p>
              </div>
            </button>
            <button
              onClick={() => handleTypeSelect("bigquery")}
              className="flex flex-col items-center gap-3 rounded-lg border-2 border-muted p-6 hover:border-primary transition-colors"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-center">
                <h3 className="font-medium">BigQuery</h3>
                <p className="text-sm text-muted-foreground">
                  Custom SQL queries for any data
                </p>
              </div>
            </button>
          </div>
        )}

        {/* Step 2: Configure Source */}
        {step === "config" && sourceType === "hubspot" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="hubspot-object">Object *</Label>
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
              <Label htmlFor="hubspot-property">Property *</Label>
              <Input
                id="hubspot-property"
                value={hubspotProperty}
                onChange={(e) => setHubspotProperty(e.target.value)}
                placeholder="e.g., amount, hs_lead_status"
              />
              <p className="text-xs text-muted-foreground">
                The HubSpot property to aggregate
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hubspot-aggregation">Aggregation *</Label>
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

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("type")}>
                Back
              </Button>
              <Button onClick={handleConfigNext}>Continue</Button>
            </div>
          </div>
        )}

        {step === "config" && sourceType === "bigquery" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bigquery-query">SQL Query *</Label>
              <Textarea
                id="bigquery-query"
                value={bigqueryQuery}
                onChange={(e) => setBigqueryQuery(e.target.value)}
                placeholder={`SELECT SUM(amount) as value
FROM transactions
WHERE transaction_date BETWEEN '{{start}}' AND '{{end}}'`}
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Must include {"{{start}}"} and {"{{end}}"} placeholders for date filtering
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bigquery-value-column">Value Column *</Label>
              <Input
                id="bigquery-value-column"
                value={bigqueryValueColumn}
                onChange={(e) => setBigqueryValueColumn(e.target.value)}
                placeholder="e.g., value, total_amount"
              />
              <p className="text-xs text-muted-foreground">
                The column name that contains the metric value
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("type")}>
                Back
              </Button>
              <Button onClick={handleConfigNext}>Continue</Button>
            </div>
          </div>
        )}

        {/* Step 3: Details */}
        {step === "details" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Digital Prepaid Volume"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this data source measure?"
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

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("config")}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Data Source
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
