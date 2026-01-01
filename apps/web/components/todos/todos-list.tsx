"use client";

import { useEffect, useState } from "react";
import { Plus, CheckCircle2, Circle, Calendar, Loader2, Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CreateTodoDialog } from "@/components/todos/create-todo-dialog";

interface Todo {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  is_complete: boolean;
  completed_at: string | null;
  visibility: "private" | "team";
  owner: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  team?: {
    id: string;
    name: string;
  } | null;
}

interface TodosListProps {
  teamId?: string;
  showTeamBadge?: boolean;
  showHeader?: boolean;
  showVisibilityTabs?: boolean;
  compact?: boolean;
}

export function TodosList({
  teamId,
  showTeamBadge = false,
  showHeader = true,
  showVisibilityTabs = true,
  compact = false,
}: TodosListProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeStatusTab, setActiveStatusTab] = useState("open");
  const [activeVisibilityTab, setActiveVisibilityTab] = useState("team");
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [defaultVisibility, setDefaultVisibility] = useState<"private" | "team">("team");

  const fetchTodos = async (status: string, visibility: string) => {
    setLoading(true);
    try {
      let url = `/api/todos?status=${status}&visibility=${visibility}`;
      if (teamId) {
        url += `&team_id=${teamId}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setTodos(data);
      }
    } catch (error) {
      console.error("Failed to fetch todos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos(activeStatusTab, activeVisibilityTab);
  }, [activeStatusTab, activeVisibilityTab, teamId]);

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todoDate = new Date(d);
    todoDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((todoDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
    if (diffDays <= 7) return `In ${diffDays} days`;

    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const isOverdue = (date: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(date);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  const handleToggleComplete = async (todo: Todo) => {
    setUpdatingIds((prev) => new Set(prev).add(todo.id));

    try {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_complete: !todo.is_complete }),
      });

      if (response.ok) {
        fetchTodos(activeStatusTab, activeVisibilityTab);
      }
    } catch (error) {
      console.error("Failed to update todo:", error);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(todo.id);
        return next;
      });
    }
  };

  const handleOpenDialog = (visibility: "private" | "team") => {
    setDefaultVisibility(visibility);
    setDialogOpen(true);
  };

  const renderTodoList = () => {
    if (loading) {
      return (
        <div className="space-y-2">
          {Array.from({ length: compact ? 3 : 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className={compact ? "p-3" : "p-4"}>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-5 flex-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (todos.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            {activeStatusTab === "open" ? (
              <>
                <Circle className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-medium">
                  No {activeVisibilityTab === "private" ? "private" : "team"} to-dos
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {teamId
                    ? "This team has no open to-dos."
                    : activeVisibilityTab === "private"
                    ? "Private to-dos are only visible to you."
                    : "Team to-dos are visible in L10 meetings."}
                </p>
                <Button size="sm" onClick={() => handleOpenDialog(activeVisibilityTab as "private" | "team")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add To-Do
                </Button>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-medium">No completed to-dos</p>
                <p className="text-sm text-muted-foreground">
                  Completed to-dos will appear here.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-2">
        {todos.map((todo) => (
          <Card
            key={todo.id}
            className={todo.is_complete ? "opacity-60" : ""}
          >
            <CardContent className={compact ? "p-3" : "p-4"}>
              <div className="flex items-start gap-3">
                <div className="pt-0.5">
                  {updatingIds.has(todo.id) ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Checkbox
                      checked={todo.is_complete}
                      onCheckedChange={() => handleToggleComplete(todo)}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3
                      className={`font-medium ${compact ? "text-sm" : ""} ${
                        todo.is_complete ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {todo.title}
                    </h3>
                    {todo.visibility === "private" && (
                      <Badge variant="outline" className="text-xs">
                        <Lock className="h-3 w-3 mr-1" />
                        Private
                      </Badge>
                    )}
                    {showTeamBadge && todo.team && (
                      <Badge variant="secondary" className="text-xs">
                        {todo.team.name}
                      </Badge>
                    )}
                  </div>
                  {!compact && todo.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                      {todo.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {todo.due_date && (
                      <div
                        className={`flex items-center gap-1 text-xs ${
                          !todo.is_complete && isOverdue(todo.due_date)
                            ? "text-red-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        <Calendar className="h-3 w-3" />
                        {formatDate(todo.due_date)}
                      </div>
                    )}
                  </div>
                </div>
                {todo.owner && (
                  <div className="flex items-center gap-2">
                    <Avatar className={compact ? "h-6 w-6" : "h-7 w-7"}>
                      <AvatarImage src={todo.owner.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(todo.owner.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    {!compact && (
                      <span className="text-sm text-muted-foreground hidden sm:inline">
                        {todo.owner.full_name}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">To-Dos</h2>
            <p className="text-sm text-muted-foreground">
              Track 7-day action items
            </p>
          </div>
          <Button size={compact ? "sm" : "default"} onClick={() => handleOpenDialog(activeVisibilityTab as "private" | "team")}>
            <Plus className="mr-2 h-4 w-4" />
            Add To-Do
          </Button>
        </div>
      )}

      {showVisibilityTabs ? (
        <Tabs value={activeVisibilityTab} onValueChange={setActiveVisibilityTab}>
          <TabsList className={compact ? "h-8" : ""}>
            <TabsTrigger value="team" className={compact ? "text-xs h-7 gap-1" : "gap-2"}>
              <Users className={compact ? "h-3 w-3" : "h-4 w-4"} />
              Team
            </TabsTrigger>
            <TabsTrigger value="private" className={compact ? "text-xs h-7 gap-1" : "gap-2"}>
              <Lock className={compact ? "h-3 w-3" : "h-4 w-4"} />
              Private
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeVisibilityTab} className="mt-4">
            <Tabs value={activeStatusTab} onValueChange={setActiveStatusTab}>
              <TabsList className={compact ? "h-8 mb-3" : "mb-4"}>
                <TabsTrigger value="open" className={compact ? "text-xs h-7 gap-1" : "gap-2"}>
                  <Circle className={compact ? "h-3 w-3" : "h-4 w-4"} />
                  Open
                </TabsTrigger>
                <TabsTrigger value="completed" className={compact ? "text-xs h-7 gap-1" : "gap-2"}>
                  <CheckCircle2 className={compact ? "h-3 w-3" : "h-4 w-4"} />
                  Completed
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeStatusTab}>
                {renderTodoList()}
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      ) : (
        <Tabs value={activeStatusTab} onValueChange={setActiveStatusTab}>
          <TabsList className={compact ? "h-8 mb-3" : "mb-4"}>
            <TabsTrigger value="open" className={compact ? "text-xs h-7 gap-1" : "gap-2"}>
              <Circle className={compact ? "h-3 w-3" : "h-4 w-4"} />
              Open
            </TabsTrigger>
            <TabsTrigger value="completed" className={compact ? "text-xs h-7 gap-1" : "gap-2"}>
              <CheckCircle2 className={compact ? "h-3 w-3" : "h-4 w-4"} />
              Completed
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeStatusTab}>
            {renderTodoList()}
          </TabsContent>
        </Tabs>
      )}

      <CreateTodoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => fetchTodos(activeStatusTab, activeVisibilityTab)}
        defaultVisibility={defaultVisibility}
        defaultTeamId={teamId}
      />
    </div>
  );
}
