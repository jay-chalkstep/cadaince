"use client";

import { useState } from "react";
import { Loader2, Copy, Check } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Pillar {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface InviteTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pillars: Pillar[];
  onSuccess: () => void;
}

export function InviteTeamMemberDialog({
  open,
  onOpenChange,
  pillars,
  onSuccess,
}: InviteTeamMemberDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [accessLevel, setAccessLevel] = useState("slt");
  const [pillarId, setPillarId] = useState("");
  const [isPillarLead, setIsPillarLead] = useState(false);

  const resetForm = () => {
    setEmail("");
    setFullName("");
    setTitle("");
    setAccessLevel("slt");
    setPillarId("");
    setIsPillarLead(false);
    setInviteUrl(null);
    setCopied(false);
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          full_name: fullName,
          title: title || null,
          access_level: accessLevel,
          pillar_id: pillarId || null,
          is_pillar_lead: isPillarLead,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setInviteUrl(data.invitation.invite_url);
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to send invitation");
      }
    } catch (error) {
      console.error("Failed to send invitation:", error);
      alert("Failed to send invitation");
    } finally {
      setSubmitting(false);
    }
  };

  const copyInviteUrl = async () => {
    if (inviteUrl) {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join the team. They&apos;ll receive a link to create their account.
          </DialogDescription>
        </DialogHeader>

        {inviteUrl ? (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Invitation created! Share this link with <strong>{fullName}</strong>:
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Input value={inviteUrl} readOnly className="font-mono text-sm" />
              <Button variant="outline" onClick={copyInviteUrl}>
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    placeholder="John Smith"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Director of Sales"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accessLevel">Access Level *</Label>
                  <Select value={accessLevel} onValueChange={setAccessLevel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin (Full access)</SelectItem>
                      <SelectItem value="elt">ELT (Executive Leadership)</SelectItem>
                      <SelectItem value="slt">SLT (Senior Leadership)</SelectItem>
                      <SelectItem value="consumer">Consumer (Read-only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pillar">Pillar</Label>
                  <Select value={pillarId} onValueChange={setPillarId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select pillar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {pillars.map((pillar) => (
                        <SelectItem key={pillar.id} value={pillar.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: pillar.color }}
                            />
                            {pillar.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {pillarId && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isPillarLead"
                    checked={isPillarLead}
                    onCheckedChange={(checked) => setIsPillarLead(checked as boolean)}
                  />
                  <Label htmlFor="isPillarLead" className="text-sm font-normal">
                    This person is the Pillar Lead
                  </Label>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !email || !fullName}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invitation
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
