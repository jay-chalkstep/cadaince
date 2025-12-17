"use client";

import { useEffect, useState } from "react";
import { Plus, CheckCircle2, Circle, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { CreateTodoDialog } from "@/components/todos/create-todo-dialog";

interface Todo {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  is_complete: boolean;
  completed_at: string | null;
  owner: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("open");
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  const fetchTodos = async (status: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/todos?status=${status}`);
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
    fetchTodos(activeTab);
  }, [activeTab]);

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
        // Refresh the list
        fetchTodos(activeTab);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">To-Dos</h1>
          <p className="text-sm text-muted-foreground">
            Track 7-day action items
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add To-Do
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="open" className="gap-2">
            <Circle className="h-4 w-4" />
            Open
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Completed
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-5 w-5 rounded" />
                      <Skeleton className="h-5 flex-1" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : todos.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                {activeTab === "open" ? (
                  <>
                    <Circle className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">No open to-dos</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create a to-do to track your action items.
                    </p>
                    <Button onClick={() => setDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add To-Do
                    </Button>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">No completed to-dos</p>
                    <p className="text-sm text-muted-foreground">
                      Completed to-dos will appear here.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {todos.map((todo) => (
                <Card
                  key={todo.id}
                  className={todo.is_complete ? "opacity-60" : ""}
                >
                  <CardContent className="p-4">
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
                        <h3
                          className={`font-medium ${
                            todo.is_complete ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {todo.title}
                        </h3>
                        {todo.description && (
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
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={todo.owner.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(todo.owner.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-muted-foreground hidden sm:inline">
                            {todo.owner.full_name}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateTodoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => fetchTodos(activeTab)}
      />
    </div>
  );
}
