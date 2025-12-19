"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Plus, Trash2, BarChart3 } from "lucide-react";

interface Metric {
  name: string;
  ownerId: string;
  pillarId: string;
  goal: string;
  unit: string;
}

interface StepMetricsProps {
  organizationId: string;
  teamMembers: Array<{ id: string; fullName: string; email: string }>;
  pillars: Array<{ id: string; name: string; slug: string; color: string }>;
  onComplete: () => void;
  onBack: () => void;
}

const SUGGESTED_METRICS = [
  { name: "Revenue", unit: "$" },
  { name: "Pipeline Value", unit: "$" },
  { name: "Customer Count", unit: "#" },
  { name: "NPS Score", unit: "#" },
  { name: "Conversion Rate", unit: "%" },
  { name: "Churn Rate", unit: "%" },
];

export function StepMetrics({
  organizationId,
  teamMembers,
  pillars,
  onComplete,
  onBack,
}: StepMetricsProps) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [allTeamMembers, setAllTeamMembers] = useState(teamMembers);

  // Fetch all team members if not provided
  useEffect(() => {
    if (allTeamMembers.length === 0) {
      fetch("/api/team")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setAllTeamMembers(
              data.map((m: { id: string; full_name: string; email: string }) => ({
                id: m.id,
                fullName: m.full_name,
                email: m.email,
              }))
            );
          }
        })
        .catch(console.error);
    }
  }, [allTeamMembers.length]);

  const handleAddMetric = (suggested?: { name: string; unit: string }) => {
    setMetrics([
      ...metrics,
      {
        name: suggested?.name || "",
        ownerId: allTeamMembers[0]?.id || "",
        pillarId: "",
        goal: "",
        unit: suggested?.unit || "#",
      },
    ]);
  };

  const handleRemove = (index: number) => {
    setMetrics(metrics.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof Metric, value: string) => {
    const updated = [...metrics];
    updated[index] = { ...updated[index], [field]: value };
    setMetrics(updated);
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    // Filter out empty metrics
    const validMetrics = metrics.filter((m) => m.name && m.ownerId);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: 5,
          data: {
            organizationId,
            metrics: validMetrics.map((m) => ({
              name: m.name,
              ownerId: m.ownerId,
              pillarId: m.pillarId || null,
              goal: m.goal ? parseFloat(m.goal) : null,
              unit: m.unit,
            })),
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save metrics");
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
          <BarChart3 className="h-6 w-6 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">
          Initial Scorecard Metrics
        </h2>
        <p className="text-slate-500 mt-2">
          Add a few key metrics to get started. You can add more from the Scorecard later.
        </p>
      </div>

      {/* Suggested metrics */}
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTED_METRICS.map((suggestion) => (
          <Button
            key={suggestion.name}
            variant="outline"
            size="sm"
            onClick={() => handleAddMetric(suggestion)}
          >
            + {suggestion.name}
          </Button>
        ))}
      </div>

      <div className="space-y-4 max-w-2xl mx-auto">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className="p-4 bg-slate-50 rounded-lg space-y-3"
          >
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-slate-700">
                Metric {index + 1}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(index)}
              >
                <Trash2 className="h-4 w-4 text-slate-400" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Metric Name</Label>
                <Input
                  placeholder="e.g., Weekly Revenue"
                  value={metric.name}
                  onChange={(e) => handleChange(index, "name", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Owner</Label>
                <Select
                  value={metric.ownerId}
                  onValueChange={(v) => handleChange(index, "ownerId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTeamMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Goal</Label>
                <Input
                  type="number"
                  placeholder="100"
                  value={metric.goal}
                  onChange={(e) => handleChange(index, "goal", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit</Label>
                <Select
                  value={metric.unit}
                  onValueChange={(v) => handleChange(index, "unit", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="#"># (Count)</SelectItem>
                    <SelectItem value="$">$ (Currency)</SelectItem>
                    <SelectItem value="%">% (Percentage)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}

        {metrics.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            Click a suggested metric above or add a custom one below.
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAddMetric()}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Custom Metric
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg max-w-2xl mx-auto">
          {error}
        </div>
      )}

      <div className="flex justify-between max-w-2xl mx-auto">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleSkip}>
            Skip for now
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              "Saving..."
            ) : (
              <>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
