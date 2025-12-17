"use client";

import { useEffect, useState } from "react";
import { Plus, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IssueDetailSheet } from "@/components/issues/issue-detail-sheet";
import { CreateIssueDialog } from "@/components/issues/create-issue-dialog";

interface Issue {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "resolved";
  priority: number;
  created_at: string;
  resolved_at: string | null;
  owner: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  created_by_profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

const priorityConfig = {
  1: { label: "High", color: "bg-red-600" },
  2: { label: "Medium", color: "bg-yellow-500" },
  3: { label: "Low", color: "bg-blue-500" },
};

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("open");

  const fetchIssues = async (status: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/issues?status=${status}`);
      if (response.ok) {
        const data = await response.json();
        setIssues(data);
      }
    } catch (error) {
      console.error("Failed to fetch issues:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues(activeTab);
  }, [activeTab]);

  const handleIssueClick = (issue: Issue) => {
    setSelectedIssue(issue);
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
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getPriorityBadge = (priority: number) => {
    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig[2];
    return (
      <Badge variant="outline" className={config.color + " text-white border-0 text-xs"}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Issues</h1>
          <p className="text-sm text-muted-foreground">
            Track and resolve organizational issues
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Issue
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="open" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            Open
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Resolved
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : issues.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                {activeTab === "open" ? (
                  <>
                    <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">No open issues</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create an issue to start tracking items that need resolution.
                    </p>
                    <Button onClick={() => setDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Issue
                    </Button>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">No resolved issues</p>
                    <p className="text-sm text-muted-foreground">
                      Resolved issues will appear here.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {issues.map((issue) => (
                <Card
                  key={issue.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleIssueClick(issue)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getPriorityBadge(issue.priority)}
                          <h3 className="font-medium truncate">{issue.title}</h3>
                        </div>
                        {issue.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {issue.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>Created {formatDate(issue.created_at)}</span>
                          {issue.resolved_at && (
                            <span>Resolved {formatDate(issue.resolved_at)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {issue.owner ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={issue.owner.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(issue.owner.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-muted-foreground hidden sm:inline">
                              {issue.owner.full_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <IssueDetailSheet
        issue={selectedIssue}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdate={() => fetchIssues(activeTab)}
      />

      <CreateIssueDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => fetchIssues(activeTab)}
      />
    </div>
  );
}
