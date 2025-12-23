"use client";

import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ArrowRight, Plus, Trash2, Users } from "lucide-react";

interface TeamMember {
  email: string;
  fullName: string;
  title: string;
  accessLevel: string;
  pillarId: string;
  isPillarLead: boolean;
}

interface StepTeamProps {
  organizationId: string;
  pillars: Array<{ id: string; name: string; slug: string; color: string }>;
  onComplete: (members: Array<{ id: string; fullName: string; email: string }>) => void;
  onBack: () => void;
}

export function StepTeam({ organizationId, pillars, onComplete, onBack }: StepTeamProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAddMember = () => {
    setMembers([
      ...members,
      {
        email: "",
        fullName: "",
        title: "",
        accessLevel: "slt",
        pillarId: "",
        isPillarLead: false,
      },
    ]);
  };

  const handleRemove = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof TeamMember, value: string | boolean) => {
    const updated = [...members];
    updated[index] = { ...updated[index], [field]: value };
    setMembers(updated);
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    // Filter out empty members
    const validMembers = members.filter((m) => m.email && m.fullName);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: 3,
          data: {
            organizationId,
            members: validMembers,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to invite team members");
      }

      onComplete(data.members || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    onComplete([]);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <Users className="h-6 w-6 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">
          Invite your team
        </h2>
        <p className="text-slate-500 mt-2">
          Add team members now or invite them later from Settings.
        </p>
      </div>

      <div className="space-y-4 max-w-2xl mx-auto">
        {members.map((member, index) => (
          <div
            key={index}
            className="p-4 bg-slate-50 rounded-lg space-y-3"
          >
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-slate-700">
                Team Member {index + 1}
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
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  placeholder="jane@company.com"
                  value={member.email}
                  onChange={(e) => handleChange(index, "email", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Full Name</Label>
                <Input
                  placeholder="Jane Smith"
                  value={member.fullName}
                  onChange={(e) => handleChange(index, "fullName", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Title</Label>
                <Input
                  placeholder="VP of Sales"
                  value={member.title}
                  onChange={(e) => handleChange(index, "title", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <Select
                  value={member.accessLevel}
                  onValueChange={(v) => handleChange(index, "accessLevel", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="elt">ELT (Executive)</SelectItem>
                    <SelectItem value="slt">SLT (Senior)</SelectItem>
                    <SelectItem value="consumer">Consumer (Read-only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pillar</Label>
                <Select
                  value={member.pillarId}
                  onValueChange={(v) => handleChange(index, "pillarId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select pillar" />
                  </SelectTrigger>
                  <SelectContent>
                    {pillars.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`lead-${index}`}
                    checked={member.isPillarLead}
                    onCheckedChange={(checked) =>
                      handleChange(index, "isPillarLead", checked === true)
                    }
                  />
                  <Label htmlFor={`lead-${index}`} className="text-xs">
                    Pillar Lead
                  </Label>
                </div>
              </div>
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={handleAddMember}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Team Member
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
