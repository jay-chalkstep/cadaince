"use client";

import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Pillar {
  id: string;
  name: string;
}

interface Seat {
  id: string;
  name: string;
}

interface CreateSeatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  parentSeatId: string | null;
  existingSeats: Seat[];
}

export function CreateSeatDialog({
  open,
  onOpenChange,
  onCreated,
  parentSeatId,
  existingSeats,
}: CreateSeatDialogProps) {
  const [name, setName] = useState("");
  const [selectedPillar, setSelectedPillar] = useState<string>("");
  const [roles, setRoles] = useState("");
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPillars();
    }
  }, [open]);

  const fetchPillars = async () => {
    try {
      const response = await fetch("/api/pillars");
      if (response.ok) {
        const data = await response.json();
        setPillars(data);
      }
    } catch (error) {
      console.error("Failed to fetch pillars:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/accountability-chart/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          pillar_id: selectedPillar && selectedPillar !== "none" ? selectedPillar : null,
          parent_seat_id: parentSeatId,
          roles: roles
            .split("\n")
            .map((r) => r.trim())
            .filter(Boolean),
        }),
      });

      if (response.ok) {
        setName("");
        setSelectedPillar("");
        setRoles("");
        onCreated();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Failed to create seat:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const parentSeat = parentSeatId
    ? existingSeats.find((s) => s.id === parentSeatId)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Seat</DialogTitle>
          <DialogDescription>
            {parentSeat
              ? `Add a seat reporting to ${parentSeat.name}`
              : "Add a new leadership seat to your accountability chart."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Seat Name *</Label>
            <Input
              id="name"
              placeholder="e.g., VP of Sales, Integrator"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pillar">Pillar</Label>
            <Select value={selectedPillar} onValueChange={setSelectedPillar}>
              <SelectTrigger>
                <SelectValue placeholder="Select pillar (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No pillar</SelectItem>
                {pillars.map((pillar) => (
                  <SelectItem key={pillar.id} value={pillar.id}>
                    {pillar.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="roles">Roles / Responsibilities</Label>
            <Textarea
              id="roles"
              placeholder="Enter each role on a new line..."
              value={roles}
              onChange={(e) => setRoles(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              One responsibility per line
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Seat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
