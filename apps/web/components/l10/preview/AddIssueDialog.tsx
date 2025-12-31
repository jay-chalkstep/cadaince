"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ExistingIssue {
  id: string;
  title: string;
  description: string | null;
  priority: number | null;
  status: string;
  raised_by_profile?: {
    full_name: string;
  } | null;
}

interface AddIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  onIssueAdded: () => void;
}

export function AddIssueDialog({
  open,
  onOpenChange,
  meetingId,
  onIssueAdded,
}: AddIssueDialogProps) {
  const [activeTab, setActiveTab] = useState<"new" | "existing">("new");
  const [submitting, setSubmitting] = useState(false);

  // New issue form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("");

  // Existing issue selection state
  const [searchQuery, setSearchQuery] = useState("");
  const [existingIssues, setExistingIssues] = useState<ExistingIssue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // Fetch existing open issues
  useEffect(() => {
    if (open && activeTab === "existing") {
      fetchExistingIssues();
    }
  }, [open, activeTab]);

  const fetchExistingIssues = async () => {
    setLoadingIssues(true);
    try {
      const response = await fetch("/api/issues?status=open");
      if (response.ok) {
        const data = await response.json();
        // Filter out issues already queued for a meeting
        const availableIssues = data.filter(
          (issue: ExistingIssue & { queued_for_meeting_id?: string }) =>
            !issue.queued_for_meeting_id
        );
        setExistingIssues(availableIssues);
      }
    } catch (error) {
      console.error("Failed to fetch issues:", error);
    } finally {
      setLoadingIssues(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const body =
        activeTab === "new"
          ? {
              title,
              description: description || undefined,
              priority: priority ? parseInt(priority) : undefined,
            }
          : {
              issue_id: selectedIssueId,
            };

      const response = await fetch(`/api/l10/${meetingId}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        // Reset form
        setTitle("");
        setDescription("");
        setPriority("");
        setSelectedIssueId(null);
        onIssueAdded();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Failed to add issue:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredIssues = existingIssues.filter((issue) =>
    issue.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPriorityLabel = (priority: number | null) => {
    if (priority === null) return null;
    if (priority >= 8) return { label: "High", color: "bg-red-100 text-red-700" };
    if (priority >= 5) return { label: "Medium", color: "bg-yellow-100 text-yellow-700" };
    return { label: "Low", color: "bg-gray-100 text-gray-700" };
  };

  const canSubmit =
    activeTab === "new" ? title.trim().length > 0 : selectedIssueId !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Issue to Meeting</DialogTitle>
          <DialogDescription>
            Create a new issue or select an existing one to discuss in this meeting.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "new" | "existing")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">
              <Plus className="mr-1.5 h-4 w-4" />
              New Issue
            </TabsTrigger>
            <TabsTrigger value="existing">
              <Search className="mr-1.5 h-4 w-4" />
              Existing Issue
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="title">Issue Title *</Label>
              <Input
                id="title"
                placeholder="What's the issue?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Provide more context..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority (optional)</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9">High</SelectItem>
                  <SelectItem value="5">Medium</SelectItem>
                  <SelectItem value="2">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="existing" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Issues</Label>
              <Input
                id="search"
                placeholder="Search by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {loadingIssues ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No open issues available to queue.</p>
                <p className="text-xs mt-1">Create a new issue instead.</p>
              </div>
            ) : (
              <ScrollArea className="h-64 rounded-md border">
                <div className="p-2 space-y-1">
                  {filteredIssues.map((issue) => {
                    const priorityInfo = getPriorityLabel(issue.priority);
                    const isSelected = selectedIssueId === issue.id;

                    return (
                      <button
                        key={issue.id}
                        onClick={() => setSelectedIssueId(issue.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-transparent hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm line-clamp-1">
                              {issue.title}
                            </h4>
                            {issue.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {issue.description}
                              </p>
                            )}
                          </div>
                          {priorityInfo && (
                            <Badge className={priorityInfo.color}>
                              {priorityInfo.label}
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add to Meeting
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
