"use client";

import { CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PreviewSection } from "./PreviewSection";

interface CarryoverTodo {
  id: string;
  title: string;
  due_date: string;
  owner: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

interface CarryoverTodosListProps {
  todos: CarryoverTodo[];
}

export function CarryoverTodosList({ todos }: CarryoverTodosListProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getDaysOverdue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - due.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatDueDate = (dueDate: string) => {
    const date = new Date(dueDate);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <PreviewSection
      title="Carryover To-Dos"
      count={todos.length}
      icon={<CheckSquare className="h-4 w-4 text-blue-600" />}
      defaultExpanded={false}
    >
      <div className="space-y-2">
        {todos.map((todo) => {
          const owner = Array.isArray(todo.owner) ? todo.owner[0] : todo.owner;
          const daysOverdue = getDaysOverdue(todo.due_date);

          return (
            <div
              key={todo.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              <CheckSquare className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm line-clamp-1">{todo.title}</h4>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {owner && (
                    <>
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={owner.avatar_url || undefined} />
                        <AvatarFallback className="text-[8px]">
                          {getInitials(owner.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{owner.full_name}</span>
                    </>
                  )}
                </div>
              </div>
              <Badge variant="destructive" className="shrink-0">
                {daysOverdue === 1
                  ? "1 day overdue"
                  : `${daysOverdue} days overdue`}
              </Badge>
            </div>
          );
        })}
      </div>
    </PreviewSection>
  );
}
