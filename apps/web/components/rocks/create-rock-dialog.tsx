"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ParentRockSelector } from "./parent-rock-selector";

interface Profile {
  id: string;
  full_name: string;
}

interface Pillar {
  id: string;
  name: string;
}

interface CreateRockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  defaultQuarter: number;
  defaultYear: number;
  defaultTeamId?: string;
}

export function CreateRockDialog({
  open,
  onOpenChange,
  onCreated,
  defaultQuarter,
  defaultYear,
  defaultTeamId,
}: CreateRockDialogProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [pillarId, setPillarId] = useState("");
  const [quarter, setQuarter] = useState(defaultQuarter.toString());
  const [year, setYear] = useState(defaultYear.toString());
  const [rockLevel, setRockLevel] = useState<"company" | "pillar" | "individual">("company");
  const [parentRockId, setParentRockId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchData();
      setQuarter(defaultQuarter.toString());
      setYear(defaultYear.toString());
    }
  }, [open, defaultQuarter, defaultYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profilesRes, pillarsRes] = await Promise.all([
        fetch("/api/profiles"),
        fetch("/api/pillars"),
      ]);

      if (profilesRes.ok) {
        const profilesData = await profilesRes.json();
        setProfiles(profilesData);
      }
      if (pillarsRes.ok) {
        const pillarsData = await pillarsRes.json();
        setPillars(pillarsData);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setOwnerId("");
    setPillarId("");
    setQuarter(defaultQuarter.toString());
    setYear(defaultYear.toString());
    setRockLevel("company");
    setParentRockId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !ownerId) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/rocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          owner_id: ownerId,
          pillar_id: pillarId || null,
          quarter: parseInt(quarter),
          year: parseInt(year),
          rock_level: rockLevel,
          parent_rock_id: parentRockId,
          team_id: defaultTeamId || null,
        }),
      });

      if (response.ok) {
        resetForm();
        onOpenChange(false);
        onCreated();
      }
    } catch (error) {
      console.error("Failed to create rock:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Rock</DialogTitle>
          <DialogDescription>
            Add a new quarterly rock to track.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Launch new product feature"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What does this rock accomplish?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
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

            <div className="space-y-2">
              <Label htmlFor="rock_level">Rock Level</Label>
              <Select
                value={rockLevel}
                onValueChange={(v) => {
                  setRockLevel(v as "company" | "pillar" | "individual");
                  // Reset parent when changing level
                  setParentRockId(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company Rock</SelectItem>
                  <SelectItem value="pillar">Pillar Rock</SelectItem>
                  <SelectItem value="individual">Individual Rock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {rockLevel !== "company" && (
              <div className="space-y-2">
                <Label htmlFor="parent_rock">
                  Parent {rockLevel === "pillar" ? "Company" : "Pillar"} Rock
                </Label>
                <ParentRockSelector
                  value={parentRockId}
                  onChange={setParentRockId}
                  rockLevel={rockLevel}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="pillar">Pillar</Label>
              <Select value={pillarId || "__none__"} onValueChange={(v) => setPillarId(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select pillar (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {pillars.map((pillar) => (
                    <SelectItem key={pillar.id} value={pillar.id}>
                      {pillar.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quarter">Quarter</Label>
                <Select value={quarter} onValueChange={setQuarter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Q1</SelectItem>
                    <SelectItem value="2">Q2</SelectItem>
                    <SelectItem value="3">Q3</SelectItem>
                    <SelectItem value="4">Q4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={(currentYear - 1).toString()}>{currentYear - 1}</SelectItem>
                    <SelectItem value={currentYear.toString()}>{currentYear}</SelectItem>
                    <SelectItem value={(currentYear + 1).toString()}>{currentYear + 1}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name || !ownerId}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Rock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
