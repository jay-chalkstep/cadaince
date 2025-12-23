"use client";

import { useState } from "react";
import { Loader2, AlertTriangle, CheckCircle2, MessageCircle, Flag } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PrivateNote {
  id: string;
  content: string;
  status: "pending" | "acknowledged" | "discussed" | "escalated" | "resolved";
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    role: string;
  };
  recipient: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    role: string;
  };
  linked_rock: { id: string; title: string } | null;
  linked_metric: { id: string; name: string } | null;
  escalated_to_issue: { id: string; title: string } | null;
}

interface NoteDetailSheetProps {
  note: PrivateNote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  direction: "received" | "sent";
}

const statusConfig = {
  pending: { label: "Pending", color: "bg-yellow-500" },
  acknowledged: { label: "Acknowledged", color: "bg-blue-500" },
  discussed: { label: "Discussed", color: "bg-purple-500" },
  escalated: { label: "Escalated", color: "bg-orange-500" },
  resolved: { label: "Resolved", color: "bg-green-500" },
};

export function NoteDetailSheet({
  note,
  open,
  onOpenChange,
  onUpdate,
  direction,
}: NoteDetailSheetProps) {
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");

  if (!note) return null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleStatusUpdate = async (status: string) => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/private-notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          resolution_note: status === "resolved" ? resolutionNote : null,
        }),
      });

      if (response.ok) {
        onUpdate();
        setResolutionNote("");
        setNewStatus("");
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setUpdating(false);
    }
  };

  const person = direction === "received" ? note.author : note.recipient;
  const status = statusConfig[note.status];
  const canUpdateStatus = direction === "received" && note.status !== "resolved";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={person.avatar_url || undefined} />
              <AvatarFallback>{getInitials(person.full_name)}</AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="text-left">
                {direction === "received" ? "From" : "To"}: {person.full_name}
              </SheetTitle>
              <SheetDescription className="text-left">{person.role}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={status.color + " text-white border-0"}>
              {status.label}
            </Badge>
            {note.escalated_to_issue && (
              <Badge variant="outline" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Escalated to Issue
              </Badge>
            )}
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label>Message</Label>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
            </div>
          </div>

          {/* Linked Items */}
          {(note.linked_rock || note.linked_metric) && (
            <div className="space-y-2">
              <Label>Related To</Label>
              <div className="space-y-2">
                {note.linked_rock && (
                  <Badge variant="outline">Rock: {note.linked_rock.title}</Badge>
                )}
                {note.linked_metric && (
                  <Badge variant="outline">Metric: {note.linked_metric.name}</Badge>
                )}
              </div>
            </div>
          )}

          {/* Resolution Note */}
          {note.resolution_note && (
            <div className="space-y-2">
              <Label>Resolution</Label>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm">{note.resolution_note}</p>
              </div>
            </div>
          )}

          <Separator />

          {/* Update Status (only for received notes) */}
          {canUpdateStatus && (
            <div className="space-y-4">
              <Label>Update Status</Label>
              <div className="flex gap-2 flex-wrap">
                {note.status === "pending" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusUpdate("acknowledged")}
                    disabled={updating}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Acknowledge
                  </Button>
                )}
                {(note.status === "pending" || note.status === "acknowledged") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusUpdate("discussed")}
                    disabled={updating}
                  >
                    <MessageCircle className="mr-1 h-4 w-4" />
                    Mark Discussed
                  </Button>
                )}
                {note.status !== "escalated" && note.status !== "resolved" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusUpdate("escalated")}
                    disabled={updating}
                  >
                    <Flag className="mr-1 h-4 w-4" />
                    Escalate
                  </Button>
                )}
              </div>

              {/* Resolve with Note */}
              {note.status !== "resolved" && (
                <div className="space-y-2 pt-2">
                  <Label>Resolve</Label>
                  <Textarea
                    placeholder="Add resolution notes (optional)..."
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    rows={2}
                  />
                  <Button
                    onClick={() => handleStatusUpdate("resolved")}
                    disabled={updating}
                    className="w-full"
                  >
                    {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Mark as Resolved
                  </Button>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Timestamps */}
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Sent {formatDate(note.created_at)}</p>
            {note.resolved_at && <p>Resolved {formatDate(note.resolved_at)}</p>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
