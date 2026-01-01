"use client";

import { useEffect, useState } from "react";
import { Plus, AlertCircle, CheckCircle2, ArrowUpRight } from "lucide-react";
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
  status: "open" | "resolved" | "escalated";
  priority: number;
  created_at: string;
  resolved_at: string | null;
  resolution?: string | null;
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
  team?: {
    id: string;
    name: string;
    parent_team_id?: string | null;
  } | null;
  escalated_to_issue_id?: string | null;
}

interface IssuesListProps {
  teamId?: string;
  showTeamBadge?: boolean;
  showHeader?: boolean;
  compact?: boolean;
}

const priorityConfig = {
  1: { label: "High", color: "bg-red-600" },
  2: { label: "Medium", color: "bg-yellow-500" },
  3: { label: "Low", color: "bg-blue-500" },
};

export function IssuesList({
  teamId,
  showTeamBadge = false,
  showHeader = true,
  compact = false,
}: IssuesListProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("open");

  const fetchIssues = async (status: string) => {
    setLoading(true);
    try {
      let url = `/api/issues?status=${status}`;
      if (teamId) {
        url += `&team_id=${teamId}`;
      }
      const response = await fetch(url);
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
  }, [activeTab, teamId]);

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

  const getStatusBadge = (status: Issue["status"]) => {
    switch (status) {
      case "escalated":
        return (
          <Badge variant="outline" className="bg-amber-600 text-white border-0 text-xs">
            <ArrowUpRight className="h-3 w-3 mr-1" />
            Escalated
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Issues</h2>
            <p className="text-sm text-muted-foreground">
              Track and resolve issues
            </p>
          </div>
          <Button size={compact ? "sm" : "default"} onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Issue
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={compact ? "h-8" : ""}>
          <TabsTrigger value="open" className={compact ? "text-xs h-7 gap-1" : "gap-2"}>
            <AlertCircle className={compact ? "h-3 w-3" : "h-4 w-4"} />
            Open
          </TabsTrigger>
          <TabsTrigger value="escalated" className={compact ? "text-xs h-7 gap-1" : "gap-2"}>
            <ArrowUpRight className={compact ? "h-3 w-3" : "h-4 w-4"} />
            Escalated
          </TabsTrigger>
          <TabsTrigger value="resolved" className={compact ? "text-xs h-7 gap-1" : "gap-2"}>
            <CheckCircle2 className={compact ? "h-3 w-3" : "h-4 w-4"} />
            Resolved
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: compact ? 3 : 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className={compact ? "p-3" : "p-4"}>
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : issues.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                {activeTab === "open" ? (
                  <>
                    <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="font-medium">No open issues</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      {teamId ? "This team has no open issues." : "Create an issue to start tracking."}
                    </p>
                    <Button size="sm" onClick={() => setDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Issue
                    </Button>
                  </>
                ) : activeTab === "escalated" ? (
                  <>
                    <ArrowUpRight className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="font-medium">No escalated issues</p>
                    <p className="text-sm text-muted-foreground">
                      Escalated issues will appear here.
                    </p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="font-medium">No resolved issues</p>
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
                  <CardContent className={compact ? "p-3" : "p-4"}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {getPriorityBadge(issue.priority)}
                          {getStatusBadge(issue.status)}
                          {showTeamBadge && issue.team && (
                            <Badge variant="secondary" className="text-xs">
                              {issue.team.name}
                            </Badge>
                          )}
                          <h3 className={`font-medium truncate ${compact ? "text-sm" : ""}`}>
                            {issue.title}
                          </h3>
                        </div>
                        {!compact && issue.description && (
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
                            <Avatar className={compact ? "h-6 w-6" : "h-7 w-7"}>
                              <AvatarImage src={issue.owner.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(issue.owner.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            {!compact && (
                              <span className="text-sm text-muted-foreground hidden sm:inline">
                                {issue.owner.full_name}
                              </span>
                            )}
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
        defaultTeamId={teamId}
      />
    </div>
  );
}
