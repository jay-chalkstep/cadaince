"use client";

import { useEffect, useState } from "react";
import {
  MessageSquareLock,
  Plus,
  Send,
  Inbox,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NoteDetailSheet } from "@/components/notes/note-detail-sheet";
import { CreateNoteDialog } from "@/components/notes/create-note-dialog";

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

const statusConfig = {
  pending: { label: "Pending", color: "bg-yellow-500" },
  acknowledged: { label: "Acknowledged", color: "bg-blue-500" },
  discussed: { label: "Discussed", color: "bg-purple-500" },
  escalated: { label: "Escalated", color: "bg-orange-500" },
  resolved: { label: "Resolved", color: "bg-green-500" },
};

export default function NotesPage() {
  const [notes, setNotes] = useState<PrivateNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState<PrivateNote | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [direction, setDirection] = useState<"received" | "sent">("received");

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/private-notes?direction=${direction}`);
      if (response.ok) {
        const data = await response.json();
        setNotes(data);
      }
    } catch (error) {
      console.error("Failed to fetch notes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [direction]);

  const handleNoteClick = (note: PrivateNote) => {
    setSelectedNote(note);
    setSheetOpen(true);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const pendingCount = notes.filter((n) => n.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Private Notes</h1>
          <p className="text-sm text-muted-foreground">
            Confidential communication with team members
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Note
        </Button>
      </div>

      <Tabs value={direction} onValueChange={(v) => setDirection(v as "received" | "sent")}>
        <TabsList>
          <TabsTrigger value="received" className="gap-2">
            <Inbox className="h-4 w-4" />
            Received
            {pendingCount > 0 && direction === "received" && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-2">
            <Send className="h-4 w-4" />
            Sent
          </TabsTrigger>
        </TabsList>

        <TabsContent value={direction} className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-1 flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : notes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquareLock className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No private notes</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {direction === "received"
                    ? "You haven't received any private notes yet."
                    : "You haven't sent any private notes yet."}
                </p>
                {direction === "sent" && (
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Send a Note
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {notes.map((note) => {
                const person = direction === "received" ? note.author : note.recipient;
                const status = statusConfig[note.status];

                return (
                  <Card
                    key={note.id}
                    className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                      note.status === "pending" && direction === "received"
                        ? "border-yellow-500 border-l-4"
                        : ""
                    }`}
                    onClick={() => handleNoteClick(note)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={person.avatar_url || undefined} />
                          <AvatarFallback>{getInitials(person.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{person.full_name}</span>
                            <Badge
                              variant="outline"
                              className={status.color + " text-white border-0 text-xs"}
                            >
                              {status.label}
                            </Badge>
                            {note.escalated_to_issue && (
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {note.content}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span>{formatDate(note.created_at)}</span>
                            {note.linked_rock && (
                              <Badge variant="outline" className="text-xs">
                                Rock: {note.linked_rock.title}
                              </Badge>
                            )}
                            {note.linked_metric && (
                              <Badge variant="outline" className="text-xs">
                                Metric: {note.linked_metric.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <NoteDetailSheet
        note={selectedNote}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdate={fetchNotes}
        direction={direction}
      />

      <CreateNoteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={fetchNotes}
      />
    </div>
  );
}
