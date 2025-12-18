"use client";

import { useState } from "react";
import { Loader2, Mail, Shield, Building2, Clock, Globe } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

interface Pillar {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface TeamMember {
  id: string;
  clerk_id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  title: string | null;
  role: string;
  access_level: string;
  pillar_id: string | null;
  pillar: Pillar | null;
  is_pillar_lead: boolean;
  status: string;
  receives_briefing: boolean;
  briefing_time?: string;
  timezone?: string;
}

interface TeamMemberDetailSheetProps {
  member: TeamMember | null;
  onClose: () => void;
  onUpdate: () => void;
  isAdmin: boolean;
  pillars: Pillar[];
}

export function TeamMemberDetailSheet({
  member,
  onClose,
  onUpdate,
  isAdmin,
  pillars,
}: TeamMemberDetailSheetProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<Partial<TeamMember>>({});

  const handleClose = () => {
    setEditing(false);
    setEditData({});
    onClose();
  };

  const startEdit = () => {
    setEditData({
      full_name: member?.full_name,
      title: member?.title,
      access_level: member?.access_level,
      pillar_id: member?.pillar_id,
      is_pillar_lead: member?.is_pillar_lead,
      receives_briefing: member?.receives_briefing,
      briefing_time: member?.briefing_time,
      timezone: member?.timezone,
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditData({});
  };

  const saveChanges = async () => {
    if (!member) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/team/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });

      if (response.ok) {
        setEditing(false);
        setEditData({});
        onUpdate();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update team member");
      }
    } catch (error) {
      console.error("Failed to update team member:", error);
      alert("Failed to update team member");
    } finally {
      setSaving(false);
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

  const getAccessLevelBadge = (level: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      admin: "destructive",
      elt: "default",
      slt: "secondary",
      consumer: "outline",
    };
    return (
      <Badge variant={variants[level] || "outline"}>
        {level.toUpperCase()}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    if (status === "active") {
      return <Badge className="bg-green-100 text-green-800">Active</Badge>;
    }
    if (status === "invited") {
      return <Badge className="bg-yellow-100 text-yellow-800">Invited</Badge>;
    }
    return <Badge variant="outline">Inactive</Badge>;
  };

  if (!member) return null;

  return (
    <Sheet open={!!member} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={member.avatar_url || undefined} />
              <AvatarFallback
                className="text-xl"
                style={{
                  backgroundColor: member.pillar?.color || "#6366F1",
                  color: "white",
                }}
              >
                {getInitials(member.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <SheetTitle className="flex items-center gap-2">
                {member.full_name}
                {member.is_pillar_lead && (
                  <span title="Pillar Lead">
                    <Shield className="h-4 w-4 text-indigo-600" />
                  </span>
                )}
              </SheetTitle>
              <SheetDescription>{member.title || member.role}</SheetDescription>
              <div className="flex items-center gap-2 mt-2">
                {getAccessLevelBadge(member.access_level)}
                {getStatusBadge(member.status)}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  value={editData.full_name || ""}
                  onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editData.title || ""}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                />
              </div>

              {isAdmin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="edit-access">Access Level</Label>
                    <Select
                      value={editData.access_level}
                      onValueChange={(v) => setEditData({ ...editData, access_level: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="elt">ELT</SelectItem>
                        <SelectItem value="slt">SLT</SelectItem>
                        <SelectItem value="consumer">Consumer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-pillar">Pillar</Label>
                    <Select
                      value={editData.pillar_id || ""}
                      onValueChange={(v) => setEditData({ ...editData, pillar_id: v || null })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select pillar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {pillars.map((pillar) => (
                          <SelectItem key={pillar.id} value={pillar.id}>
                            {pillar.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {editData.pillar_id && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-lead"
                        checked={editData.is_pillar_lead}
                        onCheckedChange={(c) =>
                          setEditData({ ...editData, is_pillar_lead: c as boolean })
                        }
                      />
                      <Label htmlFor="edit-lead" className="text-sm font-normal">
                        Pillar Lead
                      </Label>
                    </div>
                  )}
                </>
              )}

              <Separator />

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-briefing"
                  checked={editData.receives_briefing}
                  onCheckedChange={(c) =>
                    setEditData({ ...editData, receives_briefing: c as boolean })
                  }
                />
                <Label htmlFor="edit-briefing" className="text-sm font-normal">
                  Receive daily briefing
                </Label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-time">Briefing Time</Label>
                  <Input
                    id="edit-time"
                    type="time"
                    value={editData.briefing_time || "07:00"}
                    onChange={(e) => setEditData({ ...editData, briefing_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-tz">Timezone</Label>
                  <Select
                    value={editData.timezone || "America/Denver"}
                    onValueChange={(v) => setEditData({ ...editData, timezone: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern</SelectItem>
                      <SelectItem value="America/Chicago">Central</SelectItem>
                      <SelectItem value="America/Denver">Mountain</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={saveChanges} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
                <Button variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Contact Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${member.email}`} className="hover:underline">
                    {member.email}
                  </a>
                </div>
                {member.pillar && (
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: member.pillar.color }}
                      />
                      {member.pillar.name}
                      {member.is_pillar_lead && (
                        <Badge variant="outline" className="text-xs">
                          Lead
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                {member.briefing_time && (
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Briefing at {member.briefing_time}
                      {member.receives_briefing ? "" : " (disabled)"}
                    </span>
                  </div>
                )}
                {member.timezone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span>{member.timezone}</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Actions */}
              <div className="space-y-2">
                <Button variant="outline" className="w-full" onClick={startEdit}>
                  Edit Profile
                </Button>
                {isAdmin && member.status === "invited" && (
                  <Button variant="outline" className="w-full">
                    <Mail className="h-4 w-4 mr-2" />
                    Resend Invitation
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
