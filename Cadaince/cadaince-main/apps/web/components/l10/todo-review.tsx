"use client";

import { useState } from "react";
import { Check, X, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Todo {
  id: string;
  title: string;
  due_date: string;
  completed_at: string | null;
  owner?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface TodoReviewProps {
  todos: Todo[];
  meetingId: string;
  reviewedTodos: Record<string, string>; // todoId -> status
  onReview: (todoId: string, status: "done" | "not_done" | "pushed") => Promise<void>;
}

export function TodoReview({ todos, meetingId, reviewedTodos, onReview }: TodoReviewProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleReview = async (todoId: string, status: "done" | "not_done" | "pushed") => {
    setLoading(todoId);
    await onReview(todoId, status);
    setLoading(null);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (todos.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No to-dos to review this week
      </div>
    );
  }

  const reviewedCount = Object.keys(reviewedTodos).length;
  const doneCount = Object.values(reviewedTodos).filter((s) => s === "done").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mark each to-do as Done, Not Done, or Push to next week.
        </p>
        <div className="text-sm">
          <span className="font-medium">{reviewedCount}/{todos.length}</span>{" "}
          <span className="text-muted-foreground">reviewed</span>
          {reviewedCount > 0 && (
            <span className="ml-2 text-green-600">
              ({doneCount} done)
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {todos.map((todo) => {
          const status = reviewedTodos[todo.id];
          const isLoading = loading === todo.id;

          return (
            <div
              key={todo.id}
              className={cn(
                "flex items-center gap-4 rounded-lg border p-4 transition-colors",
                status === "done" && "bg-green-50 border-green-200",
                status === "not_done" && "bg-red-50 border-red-200",
                status === "pushed" && "bg-yellow-50 border-yellow-200"
              )}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={todo.owner?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {todo.owner ? getInitials(todo.owner.full_name) : "?"}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="font-medium">{todo.title}</div>
                <div className="text-sm text-muted-foreground">
                  {todo.owner?.full_name || "Unassigned"} •{" "}
                  Due {new Date(todo.due_date).toLocaleDateString()}
                </div>
              </div>

              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={status === "done" ? "default" : "outline"}
                    className={status === "done" ? "bg-green-600 hover:bg-green-700" : ""}
                    onClick={() => handleReview(todo.id, "done")}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={status === "not_done" ? "default" : "outline"}
                    className={status === "not_done" ? "bg-red-600 hover:bg-red-700" : ""}
                    onClick={() => handleReview(todo.id, "not_done")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={status === "pushed" ? "default" : "outline"}
                    className={status === "pushed" ? "bg-yellow-600 hover:bg-yellow-700" : ""}
                    onClick={() => handleReview(todo.id, "pushed")}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
