"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, Target, Building2, User, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type RockLevel = "company" | "pillar" | "individual";
type RockStatus = "on_track" | "off_track" | "at_risk" | "complete";

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  pillar_id: string | null;
}

interface Pillar {
  id: string;
  name: string;
  color: string | null;
}

interface Quarter {
  id: string;
  year: number;
  quarter: number;
  start_date: string;
  end_date: string;
  planning_status: string;
  is_current?: boolean;
}

interface Rock {
  id: string;
  title: string;
  rock_level: RockLevel;
  pillar_id: string | null;
  pillar?: Pillar | null;
  owner_id: string | null;
  quarter_id: string | null;
}

interface RockFormData {
  title: string;
  description: string;
  rock_level: RockLevel;
  status: RockStatus;
  owner_id: string;
  pillar_id: string;
  parent_rock_id: string;
  quarter_id: string;
  due_date: string;
}

interface RockFormProps {
  initialData?: Partial<RockFormData> & { id?: string };
  onSubmit: (data: RockFormData) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
}

const levelConfig = {
  company: {
    icon: Target,
    label: "Company Rock",
    description: "Strategic priority for the entire organization",
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
  },
  pillar: {
    icon: Building2,
    label: "Pillar Rock",
    description: "Supports a company rock within a pillar",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  individual: {
    icon: User,
    label: "Individual Rock",
    description: "Personal contribution to a pillar rock",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
};

const statusOptions: { value: RockStatus; label: string }[] = [
  { value: "on_track", label: "On Track" },
  { value: "at_risk", label: "At Risk" },
  { value: "off_track", label: "Off Track" },
  { value: "complete", label: "Complete" },
];

export function RockForm({
  initialData,
  onSubmit,
  onCancel,
  isEditing = false,
}: RockFormProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [companyRocks, setCompanyRocks] = useState<Rock[]>([]);
  const [pillarRocks, setPillarRocks] = useState<Rock[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<RockFormData>({
    title: initialData?.title || "",
    description: initialData?.description || "",
    rock_level: initialData?.rock_level || "company",
    status: initialData?.status || "on_track",
    owner_id: initialData?.owner_id || "",
    pillar_id: initialData?.pillar_id || "",
    parent_rock_id: initialData?.parent_rock_id || "",
    quarter_id: initialData?.quarter_id || "",
    due_date: initialData?.due_date || "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  // When quarter changes, update due_date to end of quarter if not set
  useEffect(() => {
    if (formData.quarter_id && !formData.due_date) {
      const quarter = quarters.find((q) => q.id === formData.quarter_id);
      if (quarter) {
        setFormData((prev) => ({ ...prev, due_date: quarter.end_date }));
      }
    }
  }, [formData.quarter_id, quarters]);

  // Reset dependent fields when level changes
  useEffect(() => {
    if (formData.rock_level === "company") {
      setFormData((prev) => ({
        ...prev,
        parent_rock_id: "",
        pillar_id: "",
      }));
    } else if (formData.rock_level === "pillar") {
      setFormData((prev) => ({
        ...prev,
        parent_rock_id: prev.parent_rock_id,
      }));
    }
  }, [formData.rock_level]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profilesRes, pillarsRes, quartersRes, companyRes] =
        await Promise.all([
          fetch("/api/profiles"),
          fetch("/api/pillars"),
          fetch("/api/quarters"),
          fetch("/api/rocks?level=company"),
        ]);

      if (profilesRes.ok) {
        const data = await profilesRes.json();
        setProfiles(data);
      }
      if (pillarsRes.ok) {
        const data = await pillarsRes.json();
        setPillars(data);
      }
      if (quartersRes.ok) {
        const data = await quartersRes.json();
        setQuarters(data);
        // Set default quarter to current if not editing
        if (!initialData?.quarter_id) {
          const currentQuarter = data.find((q: Quarter) => q.is_current);
          if (currentQuarter) {
            setFormData((prev) => ({
              ...prev,
              quarter_id: currentQuarter.id,
              due_date: currentQuarter.end_date,
            }));
          }
        }
      }
      if (companyRes.ok) {
        const data = await companyRes.json();
        setCompanyRocks(data);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch pillar rocks when parent company rock changes
  useEffect(() => {
    if (
      formData.rock_level === "individual" &&
      formData.parent_rock_id === "" &&
      companyRocks.length > 0
    ) {
      // For individual rocks, we need to select from pillar rocks
      // First need to know which company rock to filter by
    }
  }, [formData.rock_level, formData.parent_rock_id, companyRocks]);

  // Fetch pillar rocks for individual level
  useEffect(() => {
    const fetchPillarRocks = async () => {
      if (formData.rock_level === "individual") {
        try {
          let url = "/api/rocks?level=pillar";
          if (formData.pillar_id) {
            url += `&pillar_id=${formData.pillar_id}`;
          }
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            setPillarRocks(data);
          }
        } catch (error) {
          console.error("Failed to fetch pillar rocks:", error);
        }
      }
    };

    fetchPillarRocks();
  }, [formData.rock_level, formData.pillar_id]);

  // Filter profiles by pillar for individual rocks
  const filteredProfiles = useMemo(() => {
    if (formData.rock_level === "individual" && formData.pillar_id) {
      return profiles.filter((p) => p.pillar_id === formData.pillar_id);
    }
    return profiles;
  }, [profiles, formData.rock_level, formData.pillar_id]);

  const handleChange = (field: keyof RockFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.owner_id) return;

    setSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error("Failed to submit rock:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const formatQuarterLabel = (q: Quarter) => {
    return `Q${q.quarter} ${q.year}${q.is_current ? " (Current)" : ""}`;
  };

  const LevelIcon = levelConfig[formData.rock_level].icon;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Rock Level Selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label>Rock Level</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  <strong>Company:</strong> Organization-wide strategic priority
                </p>
                <p>
                  <strong>Pillar:</strong> Supports company rock within a
                  functional area
                </p>
                <p>
                  <strong>Individual:</strong> Personal contribution to a pillar
                  rock
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(levelConfig) as RockLevel[]).map((level) => {
            const config = levelConfig[level];
            const Icon = config.icon;
            const isSelected = formData.rock_level === level;
            const isDisabled = isEditing && initialData?.rock_level !== level;

            return (
              <button
                key={level}
                type="button"
                disabled={isDisabled}
                onClick={() => handleChange("rock_level", level)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                  isSelected
                    ? `border-current ${config.bgColor} ${config.color}`
                    : "border-muted hover:border-muted-foreground/50",
                  isDisabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <Icon className={cn("h-6 w-6", isSelected && config.color)} />
                <span className="text-sm font-medium">{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quarter Selection */}
      <div className="space-y-2">
        <Label htmlFor="quarter">Quarter *</Label>
        <Select
          value={formData.quarter_id}
          onValueChange={(v) => handleChange("quarter_id", v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select quarter" />
          </SelectTrigger>
          <SelectContent>
            {quarters.map((quarter) => (
              <SelectItem key={quarter.id} value={quarter.id}>
                <div className="flex items-center gap-2">
                  {formatQuarterLabel(quarter)}
                  {quarter.planning_status === "planning" && (
                    <Badge variant="outline" className="text-xs">
                      Planning
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Parent Rock Selection - for pillar and individual levels */}
      {formData.rock_level === "pillar" && (
        <div className="space-y-2">
          <Label htmlFor="parent_rock">Parent Company Rock *</Label>
          <Select
            value={formData.parent_rock_id}
            onValueChange={(v) => handleChange("parent_rock_id", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select company rock to support" />
            </SelectTrigger>
            <SelectContent>
              {companyRocks
                .filter(
                  (r) => !formData.quarter_id || r.quarter_id === formData.quarter_id
                )
                .map((rock) => (
                  <SelectItem key={rock.id} value={rock.id}>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-indigo-600" />
                      {rock.title}
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {formData.rock_level === "individual" && (
        <div className="space-y-2">
          <Label htmlFor="parent_rock">Parent Pillar Rock *</Label>
          <Select
            value={formData.parent_rock_id}
            onValueChange={(v) => handleChange("parent_rock_id", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select pillar rock to support" />
            </SelectTrigger>
            <SelectContent>
              {pillarRocks
                .filter(
                  (r) =>
                    (!formData.quarter_id || r.quarter_id === formData.quarter_id) &&
                    (!formData.pillar_id || r.pillar_id === formData.pillar_id)
                )
                .map((rock) => (
                  <SelectItem key={rock.id} value={rock.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-blue-600" />
                      {rock.title}
                      {rock.pillar && (
                        <Badge
                          variant="outline"
                          className="text-xs ml-2"
                          style={{
                            borderColor: rock.pillar.color || undefined,
                            color: rock.pillar.color || undefined,
                          }}
                        >
                          {rock.pillar.name}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Pillar Selection - for pillar and individual levels */}
      {(formData.rock_level === "pillar" ||
        formData.rock_level === "individual") && (
        <div className="space-y-2">
          <Label htmlFor="pillar">Pillar *</Label>
          <Select
            value={formData.pillar_id}
            onValueChange={(v) => handleChange("pillar_id", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select pillar" />
            </SelectTrigger>
            <SelectContent>
              {pillars.map((pillar) => (
                <SelectItem key={pillar.id} value={pillar.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: pillar.color || "#6366F1" }}
                    />
                    {pillar.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          placeholder={
            formData.rock_level === "company"
              ? "e.g., Achieve $10M ARR"
              : formData.rock_level === "pillar"
                ? "e.g., Launch enterprise sales motion"
                : "e.g., Close 5 enterprise deals"
          }
          value={formData.title}
          onChange={(e) => handleChange("title", e.target.value)}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="What does achieving this rock mean? What are the key milestones?"
          value={formData.description}
          onChange={(e) => handleChange("description", e.target.value)}
          rows={3}
        />
      </div>

      {/* Owner */}
      <div className="space-y-2">
        <Label htmlFor="owner">Owner *</Label>
        <Select
          value={formData.owner_id}
          onValueChange={(v) => handleChange("owner_id", v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select owner" />
          </SelectTrigger>
          <SelectContent>
            {filteredProfiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {formData.rock_level === "individual" &&
          formData.pillar_id &&
          filteredProfiles.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No team members found in this pillar. Showing all profiles.
            </p>
          )}
      </div>

      {/* Status - only show when editing */}
      {isEditing && (
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(v) => handleChange("status", v as RockStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Due Date */}
      <div className="space-y-2">
        <Label htmlFor="due_date">Due Date</Label>
        <Input
          id="due_date"
          type="date"
          value={formData.due_date}
          onChange={(e) => handleChange("due_date", e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Defaults to end of selected quarter
        </p>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            submitting ||
            !formData.title ||
            !formData.owner_id ||
            !formData.quarter_id ||
            (formData.rock_level !== "company" && !formData.pillar_id) ||
            (formData.rock_level !== "company" && !formData.parent_rock_id)
          }
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? "Save Changes" : "Create Rock"}
        </Button>
      </div>
    </form>
  );
}
