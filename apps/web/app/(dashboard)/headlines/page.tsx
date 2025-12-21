"use client";

import { useEffect, useState } from "react";
import { Plus, Megaphone, Trophy, User, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HeadlineCard } from "@/components/headlines/headline-card";
import { CreateHeadlineDialog } from "@/components/headlines/create-headline-dialog";

interface Headline {
  id: string;
  title: string;
  description: string | null;
  headline_type: "customer" | "employee" | "general";
  created_by_profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  mentioned_member: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  reactions: Record<string, string[]>;
  created_at: string;
}

const typeConfig = {
  customer: { label: "Customer Win", icon: Trophy, color: "bg-green-100 text-green-700" },
  employee: { label: "Employee Shoutout", icon: User, color: "bg-blue-100 text-blue-700" },
  general: { label: "Good News", icon: MessageSquare, color: "bg-gray-100 text-gray-700" },
};

export default function HeadlinesPage() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchHeadlines = async (type?: string) => {
    setLoading(true);
    try {
      const url = type && type !== "all" ? `/api/headlines?type=${type}` : "/api/headlines";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setHeadlines(data);
      }
    } catch (error) {
      console.error("Failed to fetch headlines:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch("/api/users/me");
      if (response.ok) {
        const data = await response.json();
        setCurrentUserId(data.id);
      }
    } catch (error) {
      console.error("Failed to fetch current user:", error);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    fetchHeadlines(activeTab);
  }, [activeTab]);

  const handleReaction = async (headlineId: string, emoji: string) => {
    try {
      const response = await fetch(`/api/headlines/${headlineId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });

      if (response.ok) {
        const { reactions } = await response.json();
        setHeadlines((prev) =>
          prev.map((h) =>
            h.id === headlineId ? { ...h, reactions } : h
          )
        );
      }
    } catch (error) {
      console.error("Failed to add reaction:", error);
    }
  };

  const handleDelete = async (headlineId: string) => {
    try {
      const response = await fetch(`/api/headlines/${headlineId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setHeadlines((prev) => prev.filter((h) => h.id !== headlineId));
      }
    } catch (error) {
      console.error("Failed to delete headline:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Headlines</h1>
          <p className="text-sm text-muted-foreground">
            Celebrate wins and recognize team members
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Share a Win
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="customer" className="gap-2">
            <Trophy className="h-4 w-4" />
            Customer
          </TabsTrigger>
          <TabsTrigger value="employee" className="gap-2">
            <User className="h-4 w-4" />
            Employee
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            General
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : headlines.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No headlines yet</p>
                <p className="text-sm text-muted-foreground mb-4 text-center">
                  Share customer wins, recognize team members, or celebrate good news.
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Share a Win
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {headlines.map((headline) => (
                <HeadlineCard
                  key={headline.id}
                  headline={headline}
                  currentUserId={currentUserId}
                  onReaction={handleReaction}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateHeadlineDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => fetchHeadlines(activeTab)}
      />
    </div>
  );
}
