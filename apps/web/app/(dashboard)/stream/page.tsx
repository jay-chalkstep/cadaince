"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Bell, MessageSquare, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateUpdateDialog } from "@/components/updates/create-update-dialog";
import { CreateAlertDialog } from "@/components/alerts/create-alert-dialog";
import { AlertDetailSheet } from "@/components/alerts/alert-detail-sheet";
import { ConvertToIssueDialog } from "@/components/updates/convert-to-issue-dialog";
import {
  StreamItem,
  StreamItemData,
  Alert,
} from "@/components/stream/stream-item";
import { Update, UpdateActions } from "@/components/updates/update-expandable-card";

interface CurrentUser {
  id: string;
  access_level: string;
}

export default function StreamPage() {
  const [streamItems, setStreamItems] = useState<StreamItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [expandedUpdateId, setExpandedUpdateId] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [alertSheetOpen, setAlertSheetOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [updateToConvert, setUpdateToConvert] = useState<Update | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

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

  const fetchStream = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/stream?limit=50");
      if (response.ok) {
        const data = await response.json();
        setStreamItems(data);
      }
    } catch (error) {
      console.error("Failed to fetch stream:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStream();
  }, [fetchStream]);

  // Update action handlers
  const handleMarkAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/updates/${id}/read`, { method: "POST" });
      if (response.ok) {
        setStreamItems((prev) =>
          prev.map((item) => {
            if (item.item_type === "update" && item.id === id) {
              return {
                ...item,
                data: { ...item.data, read_at: new Date().toISOString() } as Update,
              };
            }
            return item;
          })
        );
      }
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const handleAcknowledgeUpdate = async (id: string) => {
    try {
      const response = await fetch(`/api/updates/${id}/acknowledge`, { method: "POST" });
      if (response.ok) {
        const now = new Date().toISOString();
        setStreamItems((prev) =>
          prev.map((item) => {
            if (item.item_type === "update" && item.id === id) {
              const updateData = item.data as Update;
              return {
                ...item,
                data: {
                  ...updateData,
                  read_at: updateData.read_at || now,
                  acknowledged_at: now,
                } as Update,
              };
            }
            return item;
          })
        );
      }
    } catch (error) {
      console.error("Failed to acknowledge:", error);
    }
  };

  const handleArchiveUpdate = async (id: string) => {
    try {
      const response = await fetch(`/api/updates/${id}/archive`, { method: "POST" });
      if (response.ok) {
        setStreamItems((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (error) {
      console.error("Failed to archive:", error);
    }
  };

  const handleDeleteUpdate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this update?")) return;

    try {
      const response = await fetch(`/api/updates/${id}`, { method: "DELETE" });
      if (response.ok) {
        setStreamItems((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const handleConvertToIssue = (update: Update) => {
    setUpdateToConvert(update);
    setConvertDialogOpen(true);
  };

  const handleConverted = () => {
    fetchStream();
  };

  const updateActions: UpdateActions = {
    onMarkAsRead: handleMarkAsRead,
    onAcknowledge: handleAcknowledgeUpdate,
    onArchive: handleArchiveUpdate,
    onDelete: handleDeleteUpdate,
    onConvertToIssue: handleConvertToIssue,
  };

  // Check if user can delete an update
  const canDeleteUpdate = (update: Update) => {
    if (!currentUser) return false;
    return currentUser.access_level === "admin" || update.author.id === currentUser.id;
  };

  // Alert handlers
  const handleAlertClick = (alert: Alert) => {
    setSelectedAlert(alert);
    setAlertSheetOpen(true);
  };

  const handleAlertAcknowledged = () => {
    fetchStream();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Updates and Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Team updates and important notifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setAlertDialogOpen(true)}>
            <Bell className="mr-2 h-4 w-4" />
            Raise Alert
          </Button>
          <Button onClick={() => setUpdateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Post Update
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
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
      ) : streamItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Radio className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No updates or alerts yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Share an update or raise an alert to get started.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setAlertDialogOpen(true)}>
                <Bell className="mr-2 h-4 w-4" />
                Raise Alert
              </Button>
              <Button onClick={() => setUpdateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Post Update
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {streamItems.map((item) => (
            <StreamItem
              key={`${item.item_type}-${item.id}`}
              item={item}
              expandedUpdateId={expandedUpdateId}
              onToggleExpand={setExpandedUpdateId}
              updateActions={updateActions}
              canDeleteUpdate={
                item.item_type === "update"
                  ? canDeleteUpdate(item.data as Update)
                  : false
              }
              currentUserId={currentUser?.id || null}
              onAlertClick={handleAlertClick}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreateUpdateDialog
        open={updateDialogOpen}
        onOpenChange={setUpdateDialogOpen}
        onCreated={fetchStream}
      />

      <CreateAlertDialog
        open={alertDialogOpen}
        onOpenChange={setAlertDialogOpen}
        onCreated={fetchStream}
      />

      <AlertDetailSheet
        alert={selectedAlert}
        open={alertSheetOpen}
        onOpenChange={setAlertSheetOpen}
        onAcknowledge={handleAlertAcknowledged}
        currentUserId={currentUser?.id || null}
      />

      {updateToConvert && (
        <ConvertToIssueDialog
          open={convertDialogOpen}
          onOpenChange={setConvertDialogOpen}
          update={updateToConvert}
          onConverted={handleConverted}
        />
      )}
    </div>
  );
}
