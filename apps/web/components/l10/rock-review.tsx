"use client";

import { CircleDot, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Rock {
  id: string;
  title: string;
  status: string;
  due_date: string;
  owner?: {
    id: string;
    full_name: string;
  };
}

interface RockReviewProps {
  rocks: Rock[];
}

export function RockReview({ rocks }: RockReviewProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "on_track":
        return {
          label: "On Track",
          color: "bg-green-600",
          icon: CheckCircle2,
        };
      case "at_risk":
        return {
          label: "At Risk",
          color: "bg-yellow-500",
          icon: AlertCircle,
        };
      case "off_track":
        return {
          label: "Off Track",
          color: "bg-red-600",
          icon: XCircle,
        };
      case "complete":
        return {
          label: "Complete",
          color: "bg-blue-600",
          icon: CheckCircle2,
        };
      default:
        return {
          label: "Not Started",
          color: "bg-gray-500",
          icon: CircleDot,
        };
    }
  };

  const getDaysRemaining = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (rocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No rocks to review
      </div>
    );
  }

  // Group by status
  const groupedRocks = rocks.reduce(
    (acc, rock) => {
      const group = rock.status === "complete" ? "complete" : "active";
      acc[group].push(rock);
      return acc;
    },
    { active: [] as Rock[], complete: [] as Rock[] }
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review quarterly rock progress. Update status if needed.
      </p>

      {/* Active Rocks */}
      {groupedRocks.active.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {groupedRocks.active.map((rock) => {
            const config = getStatusConfig(rock.status);
            const daysRemaining = getDaysRemaining(rock.due_date);
            const StatusIcon = config.icon;

            return (
              <Card key={rock.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium line-clamp-2">{rock.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {rock.owner?.full_name || "Unassigned"}
                      </p>
                    </div>
                    <Badge className={`${config.color} shrink-0`}>
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {config.label}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Due: {new Date(rock.due_date).toLocaleDateString()}</span>
                    <span
                      className={
                        daysRemaining < 0
                          ? "text-red-500"
                          : daysRemaining < 14
                            ? "text-yellow-500"
                            : ""
                      }
                    >
                      {daysRemaining < 0
                        ? `${Math.abs(daysRemaining)} days overdue`
                        : `${daysRemaining} days remaining`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Completed Rocks */}
      {groupedRocks.complete.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Completed</h4>
          <div className="space-y-2">
            {groupedRocks.complete.map((rock) => (
              <div
                key={rock.id}
                className="flex items-center gap-2 rounded-lg bg-muted/50 p-3"
              >
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm">{rock.title}</span>
                <span className="text-xs text-muted-foreground">
                  — {rock.owner?.full_name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
