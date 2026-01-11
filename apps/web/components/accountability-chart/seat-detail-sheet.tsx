"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, X, Check, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FunctionsEditor } from "./functions-editor";
import { MultiPillarSelect } from "./multi-pillar-select";

interface SeatPillar {
  id: string;
  name: string;
  color: string | null;
  is_primary: boolean;
}

interface Pillar {
  id: string;
  name: string;
  color?: string | null;
}

interface Assignment {
  id: string;
  is_primary: boolean;
  assignment_type?: "holder" | "co-holder" | "backup" | "fractional" | "dotted-line";
  team_member: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    email: string;
    title: string | null;
  };
}

interface SeatFunction {
  id: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  is_eos_default: boolean;
  is_custom: boolean;
}

interface FunctionAssignment {
  id: string;
  assignment_type: "primary" | "shared" | "supporting";
  sort_order: number;
  function: SeatFunction;
}

interface Seat {
  id: string;
  name: string;
  parent_seat_id: string | null;
  pillar_id: string | null;
  pillar: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  pillars?: SeatPillar[];
  roles: string[];
  seat_type?: "single" | "unit";
  eos_role?: "visionary" | "integrator" | "leader" | null;
  display_as_unit?: boolean;
  gets_it: boolean;
  wants_it: boolean;
  capacity_to_do: boolean;
  core_values_match: boolean;
  color: string | null;
  assignments: Assignment[];
  function_assignments?: FunctionAssignment[];
}

interface TeamMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
}

interface SeatDetailSheetProps {
  seat: Seat | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  existingSeats: Seat[];
}

const ASSIGNMENT_TYPE_OPTIONS = [
  { value: "holder", label: "Holder" },
  { value: "co-holder", label: "Co-Holder" },
  { value: "backup", label: "Backup" },
  { value: "fractional", label: "Fractional" },
  { value: "dotted-line", label: "Dotted Line" },
];

const EOS_ROLE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "visionary", label: "Visionary" },
  { value: "integrator", label: "Integrator" },
  { value: "leader", label: "Leader" },
];

export function SeatDetailSheet({
  seat,
  open,
  onOpenChange,
  onUpdate,
  existingSeats,
}: SeatDetailSheetProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [roles, setRoles] = useState("");
  const [seatType, setSeatType] = useState<"single" | "unit">("single");
  const [eosRole, setEosRole] = useState("none");
  const [displayAsUnit, setDisplayAsUnit] = useState(false);
  const [getsIt, setGetsIt] = useState(true);
  const [wantsIt, setWantsIt] = useState(true);
  const [capacityToDo, setCapacityToDo] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedAssignmentType, setSelectedAssignmentType] = useState("holder");
  const [assigning, setAssigning] = useState(false);
  const [parentSeatId, setParentSeatId] = useState<string | null>(null);
  const [descendants, setDescendants] = useState<Set<string>>(new Set());
  const [updatingParent, setUpdatingParent] = useState(false);
  const [availablePillars, setAvailablePillars] = useState<Pillar[]>([]);
  const [selectedPillarIds, setSelectedPillarIds] = useState<string[]>([]);
  const [primaryPillarId, setPrimaryPillarId] = useState<string | null>(null);

  useEffect(() => {
    if (seat && open) {
      setName(seat.name);
      setRoles(seat.roles?.join("\n") || "");
      setSeatType(seat.seat_type || "single");
      setEosRole(seat.eos_role || "none");
      setDisplayAsUnit(seat.display_as_unit || false);
      setGetsIt(seat.gets_it);
      setWantsIt(seat.wants_it);
      setCapacityToDo(seat.capacity_to_do);
      setParentSeatId(seat.parent_seat_id);
      // Initialize pillar state from seat.pillars
      const pillarIds = seat.pillars?.map(p => p.id) || [];
      setSelectedPillarIds(pillarIds);
      const primary = seat.pillars?.find(p => p.is_primary);
      setPrimaryPillarId(primary?.id || (pillarIds.length > 0 ? pillarIds[0] : null));
      fetchTeamMembers();
      fetchDescendants(seat.id);
      fetchPillars();
    }
  }, [seat, open]);

  const fetchTeamMembers = async () => {
    try {
      const response = await fetch("/api/team");
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data);
      }
    } catch (error) {
      console.error("Failed to fetch team members:", error);
    }
  };

  const fetchPillars = async () => {
    try {
      const response = await fetch("/api/pillars");
      if (response.ok) {
        const data = await response.json();
        setAvailablePillars(data);
      }
    } catch (error) {
      console.error("Failed to fetch pillars:", error);
    }
  };

  const handlePillarSelectionChange = (pillarIds: string[], primaryId: string | null) => {
    setSelectedPillarIds(pillarIds);
    setPrimaryPillarId(primaryId);
  };

  const fetchDescendants = async (seatId: string) => {
    try {
      const response = await fetch(
        `/api/accountability-chart/seats/${seatId}/descendants`
      );
      if (response.ok) {
        const data = await response.json();
        setDescendants(new Set(data.map((d: { id: string }) => d.id)));
      }
    } catch (error) {
      console.error("Failed to fetch descendants:", error);
      setDescendants(new Set());
    }
  };

  // Filter available parents: exclude self and descendants
  const availableParents = existingSeats.filter(
    (s) => s.id !== seat?.id && !descendants.has(s.id)
  );

  const handleSave = async () => {
    if (!seat) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/accountability-chart/seats/${seat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          parent_seat_id: parentSeatId,
          pillar_ids: selectedPillarIds,
          primary_pillar_id: primaryPillarId,
          roles: roles
            .split("\n")
            .map((r) => r.trim())
            .filter(Boolean),
          seat_type: seatType,
          eos_role: eosRole && eosRole !== "none" ? eosRole : null,
          display_as_unit: displayAsUnit,
          gets_it: getsIt,
          wants_it: wantsIt,
          capacity_to_do: capacityToDo,
        }),
      });

      if (response.ok) {
        setEditing(false);
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to update seat:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!seat) return;

    try {
      const response = await fetch(`/api/accountability-chart/seats/${seat.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Seat deleted", {
          description: `"${seat.name}" has been removed from the chart.`,
        });
        onUpdate();
        onOpenChange(false);
      } else {
        const data = await response.json();
        toast.error("Cannot delete seat", {
          description: data.error || "Failed to delete seat. Please try again.",
        });
      }
    } catch (error) {
      console.error("Failed to delete seat:", error);
      toast.error("Delete failed", {
        description: "An unexpected error occurred. Please try again.",
      });
    }
  };

  const handleAssign = async () => {
    if (!seat || !selectedMember) return;

    setAssigning(true);
    try {
      const response = await fetch(
        `/api/accountability-chart/seats/${seat.id}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            team_member_id: selectedMember,
            assignment_type: selectedAssignmentType,
          }),
        }
      );

      if (response.ok) {
        setSelectedMember("");
        setSelectedAssignmentType("holder");
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to assign team member:", error);
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (memberId: string) => {
    if (!seat) return;

    try {
      const response = await fetch(
        `/api/accountability-chart/seats/${seat.id}/assign/${memberId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to unassign team member:", error);
    }
  };

  const handleParentChange = async (newParentId: string | null) => {
    if (!seat) return;

    setUpdatingParent(true);
    setParentSeatId(newParentId);

    try {
      const response = await fetch(`/api/accountability-chart/seats/${seat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_seat_id: newParentId }),
      });

      if (response.ok) {
        const newParentName = newParentId
          ? existingSeats.find((s) => s.id === newParentId)?.name
          : null;
        toast.success("Reporting updated", {
          description: newParentName
            ? `${seat.name} now reports to ${newParentName}`
            : `${seat.name} is now a root-level seat`,
        });
        onUpdate();
      } else {
        const data = await response.json();
        toast.error("Update failed", {
          description: data.error || "Could not update reporting relationship.",
        });
        setParentSeatId(seat.parent_seat_id);
      }
    } catch (error) {
      console.error("Failed to update parent:", error);
      toast.error("Update failed", {
        description: "An unexpected error occurred.",
      });
      setParentSeatId(seat.parent_seat_id);
    } finally {
      setUpdatingParent(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAssignmentTypeLabel = (type?: string) => {
    const option = ASSIGNMENT_TYPE_OPTIONS.find((o) => o.value === type);
    return option?.label || "Holder";
  };

  const assignedIds = seat?.assignments?.map((a) => a.team_member.id) || [];
  const availableMembers = teamMembers.filter((m) => !assignedIds.includes(m.id));

  if (!seat) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto px-6">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {editing ? "Edit Seat" : seat.name}
            {seat.seat_type === "unit" && seat.display_as_unit && (
              <Badge variant="outline" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                Unit
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            <div className="flex flex-wrap gap-1">
              {seat.pillars && seat.pillars.length > 0 ? (
                seat.pillars.map((pillar) => (
                  <Badge
                    key={pillar.id}
                    variant={pillar.is_primary ? "default" : "secondary"}
                    style={pillar.color ? { backgroundColor: pillar.color, color: "#fff" } : undefined}
                  >
                    {pillar.name}
                    {pillar.is_primary && seat.pillars!.length > 1 && " ★"}
                  </Badge>
                ))
              ) : seat.pillar ? (
                <Badge variant="secondary">{seat.pillar.name}</Badge>
              ) : null}
              {seat.eos_role && (
                <Badge variant="outline" className="capitalize">
                  {seat.eos_role}
                </Badge>
              )}
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {editing ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Seat Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Reports To */}
              <div className="space-y-2">
                <Label>Reports To</Label>
                <Select
                  value={parentSeatId || "none"}
                  onValueChange={(value) =>
                    setParentSeatId(value === "none" ? null : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent seat (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (root level)</SelectItem>
                    {availableParents.map((parent) => (
                      <SelectItem key={parent.id} value={parent.id}>
                        {parent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Who this seat reports to in the org chart
                </p>
              </div>

              {/* Pillars */}
              <div className="space-y-2">
                <Label>Pillars</Label>
                <MultiPillarSelect
                  pillars={availablePillars}
                  selectedPillarIds={selectedPillarIds}
                  primaryPillarId={primaryPillarId}
                  onSelectionChange={handlePillarSelectionChange}
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  Select which functional areas this seat belongs to
                </p>
              </div>

              {/* Seat Type Toggle */}
              <div className="space-y-3">
                <Label>Seat Type</Label>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Leadership Unit</p>
                    <p className="text-xs text-muted-foreground">
                      Multiple people operating as partners
                    </p>
                  </div>
                  <Switch
                    checked={seatType === "unit"}
                    onCheckedChange={(checked) => {
                      setSeatType(checked ? "unit" : "single");
                      if (checked) setDisplayAsUnit(true);
                    }}
                  />
                </div>
                {seatType === "unit" && (
                  <div className="flex items-center justify-between pl-4">
                    <div>
                      <p className="text-sm font-medium">Display as Unit</p>
                      <p className="text-xs text-muted-foreground">
                        Show holders side-by-side
                      </p>
                    </div>
                    <Switch
                      checked={displayAsUnit}
                      onCheckedChange={setDisplayAsUnit}
                    />
                  </div>
                )}
              </div>

              {/* EOS Role */}
              <div className="space-y-2">
                <Label>EOS Role Tag</Label>
                <Select value={eosRole} onValueChange={setEosRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select EOS role (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {EOS_ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Optional label for EOS methodology
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="roles">Roles / Responsibilities (Legacy)</Label>
                <Textarea
                  id="roles"
                  value={roles}
                  onChange={(e) => setRoles(e.target.value)}
                  rows={4}
                  placeholder="One role per line (use Functions for structured management)"
                />
                <p className="text-xs text-muted-foreground">
                  Consider using Functions below for better organization
                </p>
              </div>

              <div className="space-y-3">
                <Label>GWC Indicators</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="gets_it"
                    checked={getsIt}
                    onCheckedChange={(checked) => setGetsIt(checked as boolean)}
                  />
                  <label htmlFor="gets_it" className="text-sm">
                    Gets It (understands the role)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="wants_it"
                    checked={wantsIt}
                    onCheckedChange={(checked) => setWantsIt(checked as boolean)}
                  />
                  <label htmlFor="wants_it" className="text-sm">
                    Wants It (motivated to do the role)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="capacity"
                    checked={capacityToDo}
                    onCheckedChange={(checked) => setCapacityToDo(checked as boolean)}
                  />
                  <label htmlFor="capacity" className="text-sm">
                    Capacity to Do It (has time and ability)
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditing(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={submitting} className="flex-1">
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Assigned People */}
              <div>
                <Label className="text-sm font-medium">Assigned To</Label>
                <div className="mt-2 space-y-2">
                  {seat.assignments && seat.assignments.length > 0 ? (
                    seat.assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between p-2 rounded-lg border"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={assignment.team_member.avatar_url || undefined}
                            />
                            <AvatarFallback>
                              {getInitials(assignment.team_member.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">
                              {assignment.team_member.full_name}
                            </p>
                            <div className="flex items-center gap-1">
                              <p className="text-xs text-muted-foreground">
                                {assignment.team_member.email}
                              </p>
                              {assignment.assignment_type &&
                                assignment.assignment_type !== "holder" && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1"
                                  >
                                    {getAssignmentTypeLabel(assignment.assignment_type)}
                                  </Badge>
                                )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnassign(assignment.team_member.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No one assigned</p>
                  )}
                </div>

                {/* Assign new member */}
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <Select value={selectedMember} onValueChange={setSelectedMember}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Assign team member" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={selectedAssignmentType}
                      onValueChange={setSelectedAssignmentType}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNMENT_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={handleAssign}
                      disabled={!selectedMember || assigning}
                    >
                      {assigning ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Reports To */}
              <div>
                <Label className="text-sm font-medium">Reports To</Label>
                <Select
                  value={parentSeatId || "none"}
                  onValueChange={(value) =>
                    handleParentChange(value === "none" ? null : value)
                  }
                  disabled={updatingParent}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select parent seat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (root level)</SelectItem>
                    {availableParents.map((parent) => (
                      <SelectItem key={parent.id} value={parent.id}>
                        {parent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Functions Editor */}
              <FunctionsEditor
                seatId={seat.id}
                assignments={seat.function_assignments || []}
                onUpdate={onUpdate}
              />

              <Separator />

              {/* Legacy Roles (if any) */}
              {seat.roles && seat.roles.length > 0 && (
                <>
                  <div>
                    <Label className="text-sm font-medium">
                      Legacy Responsibilities
                    </Label>
                    <ul className="mt-2 space-y-1">
                      {seat.roles.map((role, i) => (
                        <li key={i} className="text-sm text-muted-foreground">
                          • {role}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground mt-2">
                      Migrate these to Functions for better organization
                    </p>
                  </div>
                  <Separator />
                </>
              )}

              {/* GWC */}
              <div>
                <Label className="text-sm font-medium">GWC Assessment</Label>
                <div className="mt-2 flex gap-4">
                  <div className="flex items-center gap-1">
                    {seat.gets_it ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">Gets It</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {seat.wants_it ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">Wants It</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {seat.capacity_to_do ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">Capacity</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditing(true)}
                  className="flex-1"
                >
                  Edit Seat
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Seat?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the seat "{seat.name}" and remove
                        all assignments. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
