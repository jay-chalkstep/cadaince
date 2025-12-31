"use client";

import { useEffect, useState } from "react";
import { Plus, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateUpdateDialog } from "@/components/updates/create-update-dialog";
import {
  UpdateExpandableCard,
  Update,
} from "@/components/updates/update-expandable-card";

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const fetchUpdates = async (type?: string) => {
    setLoading(true);
    try {
      const url = type && type !== "all" ? `/api/updates?type=${type}` : "/api/updates";
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
  };

  useEffect(() => {
    fetchUpdates(activeTab === "all" ? undefined : activeTab);
  }, [activeTab]);

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
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="rock">Rocks</TabsTrigger>
          <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
          <TabsTrigger value="incident">Incidents</TabsTrigger>
        </TabsList>

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
                <p className="text-lg font-medium">No updates yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Share an update with your team.
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Post Update
                </Button>
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
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateUpdateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => fetchUpdates(activeTab === "all" ? undefined : activeTab)}
      />
    </div>
  );
}
