"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Compass, ChevronDown, ChevronUp } from "lucide-react";

interface StepVTOProps {
  organizationId: string;
  onComplete: () => void;
  onBack: () => void;
}

interface VTOData {
  coreValues: Array<{ value: string; description: string }>;
  purpose: string;
  niche: string;
  tenYearTarget: string;
  targetMarket: string;
  threeUniques: string[];
  guarantee: string;
  threeYearPicture: string;
  oneYearPlan: string;
}

export function StepVTO({ organizationId, onComplete, onBack }: StepVTOProps) {
  const [vto, setVTO] = useState<VTOData>({
    coreValues: [{ value: "", description: "" }],
    purpose: "",
    niche: "",
    tenYearTarget: "",
    targetMarket: "",
    threeUniques: ["", "", ""],
    guarantee: "",
    threeYearPicture: "",
    oneYearPlan: "",
  });
  const [expandedSections, setExpandedSections] = useState<string[]>(["core"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: 4,
          data: {
            organizationId,
            vto: {
              ...vto,
              coreValues: vto.coreValues.filter((cv) => cv.value.trim()),
              threeUniques: vto.threeUniques.filter((u) => u.trim()),
            },
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save V/TO");
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: 4,
          data: { organizationId, vto: {} },
        }),
      });
      onComplete();
    } catch {
      onComplete(); // Continue anyway
    }
  };

  const SectionHeader = ({
    title,
    section,
    description,
  }: {
    title: string;
    section: string;
    description: string;
  }) => (
    <button
      type="button"
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
    >
      <div className="text-left">
        <h3 className="font-medium text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      {expandedSections.includes(section) ? (
        <ChevronUp className="h-5 w-5 text-slate-400" />
      ) : (
        <ChevronDown className="h-5 w-5 text-slate-400" />
      )}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
          <Compass className="h-6 w-6 text-amber-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">
          Vision/Traction Organizer
        </h2>
        <p className="text-slate-500 mt-2">
          Your strategic foundation. Take your time or skip for now.
        </p>
      </div>

      <div className="space-y-4 max-w-2xl mx-auto">
        {/* Core Values & Focus */}
        <div className="space-y-3">
          <SectionHeader
            title="Core Values & Focus"
            section="core"
            description="What you believe and what you do best"
          />
          {expandedSections.includes("core") && (
            <div className="p-4 border rounded-lg space-y-4">
              <div className="space-y-2">
                <Label>Core Values</Label>
                {vto.coreValues.map((cv, index) => (
                  <div key={index} className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Value (e.g., Integrity)"
                      value={cv.value}
                      onChange={(e) => {
                        const updated = [...vto.coreValues];
                        updated[index] = { ...cv, value: e.target.value };
                        setVTO({ ...vto, coreValues: updated });
                      }}
                    />
                    <Input
                      placeholder="Description"
                      value={cv.description}
                      onChange={(e) => {
                        const updated = [...vto.coreValues];
                        updated[index] = { ...cv, description: e.target.value };
                        setVTO({ ...vto, coreValues: updated });
                      }}
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setVTO({
                      ...vto,
                      coreValues: [...vto.coreValues, { value: "", description: "" }],
                    })
                  }
                >
                  + Add Value
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Purpose (Why)</Label>
                  <Textarea
                    placeholder="Why does your organization exist?"
                    value={vto.purpose}
                    onChange={(e) => setVTO({ ...vto, purpose: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Niche (What)</Label>
                  <Textarea
                    placeholder="What do you do better than anyone?"
                    value={vto.niche}
                    onChange={(e) => setVTO({ ...vto, niche: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 10-Year Target */}
        <div className="space-y-3">
          <SectionHeader
            title="10-Year Target"
            section="10year"
            description="Your big, hairy, audacious goal"
          />
          {expandedSections.includes("10year") && (
            <div className="p-4 border rounded-lg">
              <Textarea
                placeholder="Where will you be in 10 years? Be specific and measurable."
                value={vto.tenYearTarget}
                onChange={(e) => setVTO({ ...vto, tenYearTarget: e.target.value })}
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Marketing Strategy */}
        <div className="space-y-3">
          <SectionHeader
            title="Marketing Strategy"
            section="marketing"
            description="Target market, uniques, and guarantee"
          />
          {expandedSections.includes("marketing") && (
            <div className="p-4 border rounded-lg space-y-4">
              <div className="space-y-2">
                <Label>Target Market</Label>
                <Input
                  placeholder="Who is your ideal customer?"
                  value={vto.targetMarket}
                  onChange={(e) => setVTO({ ...vto, targetMarket: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Three Uniques</Label>
                {vto.threeUniques.map((unique, index) => (
                  <Input
                    key={index}
                    placeholder={`Unique #${index + 1}`}
                    value={unique}
                    onChange={(e) => {
                      const updated = [...vto.threeUniques];
                      updated[index] = e.target.value;
                      setVTO({ ...vto, threeUniques: updated });
                    }}
                  />
                ))}
              </div>
              <div className="space-y-2">
                <Label>Guarantee</Label>
                <Input
                  placeholder="What do you guarantee your customers?"
                  value={vto.guarantee}
                  onChange={(e) => setVTO({ ...vto, guarantee: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>

        {/* 3-Year Picture & 1-Year Plan */}
        <div className="space-y-3">
          <SectionHeader
            title="3-Year Picture & 1-Year Plan"
            section="planning"
            description="Where you're headed and this year's goals"
          />
          {expandedSections.includes("planning") && (
            <div className="p-4 border rounded-lg space-y-4">
              <div className="space-y-2">
                <Label>3-Year Picture</Label>
                <Textarea
                  placeholder="What does success look like in 3 years?"
                  value={vto.threeYearPicture}
                  onChange={(e) => setVTO({ ...vto, threeYearPicture: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>1-Year Plan</Label>
                <Textarea
                  placeholder="What must you accomplish this year?"
                  value={vto.oneYearPlan}
                  onChange={(e) => setVTO({ ...vto, oneYearPlan: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>
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
          <Button variant="ghost" onClick={handleSkip} disabled={loading}>
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
