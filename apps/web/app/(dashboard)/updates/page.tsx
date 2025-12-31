"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, MessageSquare, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { CreateUpdateDialog } from "@/components/updates/create-update-dialog";
import {
  UpdateExpandableCard,
  Update,
  UpdateActions,
} from "@/components/updates/update-expandable-card";
import { ConvertToIssueDialog } from "@/components/updates/convert-to-issue-dialog";

interface CurrentUser {
  id: string;
  access_level: string;
}

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [updateToConvert, setUpdateToConvert] = useState<Update | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const { toast } = useToast();

  // Fetch current user profile
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch("/api/profiles/me");
        if (response.ok) {
          const data = await response.json();
          setCurrentUser(data);
        }
      } catch (error) {
        console.error("Failed to fetch current user:", error);
      }
    };
    fetchCurrentUser();
  }, []);

  const fetchUpdates = useCallback(async (type?: string, filterUnread?: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (type && type !== "all") {
        params.set("type", type);
      }
      if (filterUnread) {
        params.set("unread", "true");
      }
      const url = `/api/updates${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setUpdates(data);
      }
    } catch (error) {
      console.error("Failed to fetch updates:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUpdates(activeTab === "all" ? undefined : activeTab, unreadOnly);
  }, [activeTab, unreadOnly, fetchUpdates]);

  // Action handlers
  const handleMarkAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/updates/${id}/read`, { method: "POST" });
      if (response.ok) {
        setUpdates((prev) =>
          prev.map((u) =>
            u.id === id ? { ...u, read_at: new Date().toISOString() } : u
          )
        );
        toast({ title: "Marked as read" });
      }
    } catch (error) {
      toast({ title: "Failed to mark as read", variant: "destructive" });
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      const response = await fetch(`/api/updates/${id}/acknowledge`, { method: "POST" });
      if (response.ok) {
        const now = new Date().toISOString();
        setUpdates((prev) =>
          prev.map((u) =>
            u.id === id ? { ...u, read_at: u.read_at || now, acknowledged_at: now } : u
          )
        );
        toast({ title: "Acknowledged" });
      }
    } catch (error) {
      toast({ title: "Failed to acknowledge", variant: "destructive" });
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const response = await fetch(`/api/updates/${id}/archive`, { method: "POST" });
      if (response.ok) {
        // Remove from current list (archived updates are hidden by default)
        setUpdates((prev) => prev.filter((u) => u.id !== id));
        toast({ title: "Archived" });
      }
    } catch (error) {
      toast({ title: "Failed to archive", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this update?")) return;

    try {
      const response = await fetch(`/api/updates/${id}`, { method: "DELETE" });
      if (response.ok) {
        setUpdates((prev) => prev.filter((u) => u.id !== id));
        toast({ title: "Deleted" });
      }
    } catch (error) {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleConvertToIssue = (update: Update) => {
    setUpdateToConvert(update);
    setConvertDialogOpen(true);
  };

  const handleConverted = () => {
    // Refresh the list to show the converted badge
    fetchUpdates(activeTab === "all" ? undefined : activeTab, unreadOnly);
    toast({ title: "Issue created", description: "The update has been converted to an issue." });
  };

  const actions: UpdateActions = {
    onMarkAsRead: handleMarkAsRead,
    onAcknowledge: handleAcknowledge,
    onArchive: handleArchive,
    onDelete: handleDelete,
    onConvertToIssue: handleConvertToIssue,
  };

  // Check if user can delete an update
  const canDelete = (update: Update) => {
    if (!currentUser) return false;
    return currentUser.access_level === "admin" || update.author.id === currentUser.id;
  };

  // Count unread updates
  const unreadCount = updates.filter((u) => !u.read_at).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Updates</h1>
          <p className="text-sm text-muted-foreground">
            Video and text updates from the team
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Post Update
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="rock">Rocks</TabsTrigger>
            <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
            <TabsTrigger value="incident">Incidents</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Switch
              id="unread-filter"
              checked={unreadOnly}
              onCheckedChange={setUnreadOnly}
            />
            <Label htmlFor="unread-filter" className="text-sm cursor-pointer">
              Unread only
              {unreadCount > 0 && !unreadOnly && (
                <span className="ml-1 text-muted-foreground">({unreadCount})</span>
              )}
            </Label>
          </div>
        </div>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Skeleton className="h-16 w-24 md:h-20 md:w-32 rounded-md flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-4 w-full" />
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-5 rounded-full" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : updates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">
                  {unreadOnly ? "No unread updates" : "No updates yet"}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {unreadOnly
                    ? "You're all caught up!"
                    : "Share an update with your team."}
                </p>
                {!unreadOnly && (
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Post Update
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {updates.map((update) => (
                <UpdateExpandableCard
                  key={update.id}
                  update={update}
                  isExpanded={expandedId === update.id}
                  onToggleExpand={setExpandedId}
                  actions={actions}
                  canDelete={canDelete(update)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateUpdateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => fetchUpdates(activeTab === "all" ? undefined : activeTab, unreadOnly)}
      />

      <ConvertToIssueDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        update={updateToConvert}
        onConverted={handleConverted}
      />
    </div>
  );
}
