"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight, GripVertical, Plus, Trash2, Layers } from "lucide-react";

interface Pillar {
  id?: string;
  name: string;
  slug: string;
  color: string;
  sortOrder: number;
}

const DEFAULT_PILLARS: Pillar[] = [
  { name: "Executive", slug: "executive", color: "#6366F1", sortOrder: 1 },
  { name: "Growth", slug: "growth", color: "#10B981", sortOrder: 2 },
  { name: "Customer", slug: "customer", color: "#F59E0B", sortOrder: 3 },
  { name: "Product", slug: "product", color: "#3B82F6", sortOrder: 4 },
  { name: "Operations", slug: "operations", color: "#8B5CF6", sortOrder: 5 },
  { name: "Finance", slug: "finance", color: "#EC4899", sortOrder: 6 },
  { name: "People", slug: "people", color: "#14B8A6", sortOrder: 7 },
];

interface StepPillarsProps {
  organizationId: string;
  onComplete: (pillars: Array<{ id: string; name: string; slug: string; color: string }>) => void;
  onBack: () => void;
}

export function StepPillars({ organizationId, onComplete, onBack }: StepPillarsProps) {
  const [pillars, setPillars] = useState<Pillar[]>(DEFAULT_PILLARS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generateSlug = (value: string) => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleNameChange = (index: number, name: string) => {
    const updated = [...pillars];
    updated[index] = {
      ...updated[index],
      name,
      slug: generateSlug(name),
    };
    setPillars(updated);
  };

  const handleColorChange = (index: number, color: string) => {
    const updated = [...pillars];
    updated[index] = { ...updated[index], color };
    setPillars(updated);
  };

  const handleRemove = (index: number) => {
    setPillars(pillars.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    setPillars([
      ...pillars,
      {
        name: "",
        slug: "",
        color: "#94A3B8",
        sortOrder: pillars.length + 1,
      },
    ]);
  };

  const handleUseDefaults = () => {
    setPillars(DEFAULT_PILLARS);
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    // Validate pillars
    const validPillars = pillars.filter((p) => p.name.trim());
    if (validPillars.length === 0) {
      setError("Please add at least one pillar");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: 2,
          data: {
            organizationId,
            pillars: validPillars.map((p, i) => ({
              name: p.name,
              slug: p.slug || generateSlug(p.name),
              color: p.color,
              sortOrder: i + 1,
            })),
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save pillars");
      }

      onComplete(data.pillars);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
          <Layers className="h-6 w-6 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">
          Define your pillars
        </h2>
        <p className="text-slate-500 mt-2">
          Pillars are your functional areas. Customize them or use the EOS defaults.
        </p>
      </div>

      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={handleUseDefaults}>
          Use EOS Standard Pillars
        </Button>
      </div>

      <div className="space-y-3 max-w-lg mx-auto">
        {pillars.map((pillar, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
          >
            <GripVertical className="h-4 w-4 text-slate-400 cursor-grab" />
            <input
              type="color"
              value={pillar.color}
              onChange={(e) => handleColorChange(index, e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0"
            />
            <Input
              value={pillar.name}
              onChange={(e) => handleNameChange(index, e.target.value)}
              placeholder="Pillar name"
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemove(index)}
              disabled={pillars.length <= 1}
            >
              <Trash2 className="h-4 w-4 text-slate-400" />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Pillar
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg max-w-lg mx-auto">
          {error}
        </div>
      )}

      <div className="flex justify-between max-w-lg mx-auto">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
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
  );
}
