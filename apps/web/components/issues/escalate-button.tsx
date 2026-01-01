"use client";

import { useState } from "react";
import { ArrowUpRight, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

interface EscalateButtonProps {
  issueId: string;
  issueTitle: string;
  currentTeamName?: string;
  parentTeamName?: string;
  canEscalate?: boolean;
  isEscalated?: boolean;
  onEscalated?: (escalatedIssueId: string) => void;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

/**
 * EscalateButton - Button to escalate an issue to the parent team
 *
 * Features:
 * - Confirmation dialog before escalating
 * - Shows parent team name
 * - Disabled if no parent team or already escalated
 * - Success feedback with link to escalated issue
 */
export function EscalateButton({
  issueId,
  issueTitle,
  currentTeamName,
  parentTeamName,
  canEscalate = true,
  isEscalated = false,
  onEscalated,
  className,
  variant = "outline",
  size = "sm",
}: EscalateButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [escalatedIssue, setEscalatedIssue] = useState<{
    id: string;
    title: string;
    team: { id: string; name: string };
  } | null>(null);

  const handleEscalate = async () => {
    try {
      setLoading(true);

      const res = await fetch(`/api/issues/${issueId}/escalate`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to escalate issue");
      }

      const data = await res.json();
      setEscalatedIssue(data.escalated_issue);
      setSuccess(true);

      toast({
        title: "Issue escalated",
        description: `Issue has been escalated to ${data.escalated_to_team?.name || "parent team"}`,
      });

      onEscalated?.(data.escalated_issue.id);
    } catch (err) {
      toast({
        title: "Failed to escalate",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  // Already escalated state
  if (isEscalated) {
    return (
      <Badge variant="secondary" className={cn("gap-1", className)}>
        <ArrowUpRight className="h-3 w-3" />
        Escalated
      </Badge>
    );
  }

  // Can't escalate (no parent team)
  if (!canEscalate || !parentTeamName) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled
        className={className}
        title="This issue cannot be escalated (no parent team)"
      >
        <ArrowUpRight className="h-4 w-4 mr-1" />
        Escalate
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={className}
      >
        <ArrowUpRight className="h-4 w-4 mr-1" />
        Escalate
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          {success && escalatedIssue ? (
            // Success state
            <>
              <AlertDialogHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <AlertDialogTitle>Issue Escalated</AlertDialogTitle>
                </div>
                <AlertDialogDescription className="pt-2">
                  <p className="mb-4">
                    The issue has been escalated to{" "}
                    <strong>{escalatedIssue.team.name}</strong>. A copy of the issue
                    has been created in the parent team, and this issue has been
                    marked as escalated.
                  </p>
                  <div className="rounded-md border p-3 bg-muted/50">
                    <p className="text-sm font-medium text-foreground">
                      {escalatedIssue.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      in {escalatedIssue.team.name}
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction
                  onClick={() => {
                    setOpen(false);
                    setSuccess(false);
                    setEscalatedIssue(null);
                  }}
                >
                  Done
                </AlertDialogAction>
                <AlertDialogAction
                  onClick={() => {
                    window.location.href = `/issues?id=${escalatedIssue.id}`;
                  }}
                >
                  View Escalated Issue
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            // Confirmation state
            <>
              <AlertDialogHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <AlertDialogTitle>Escalate Issue?</AlertDialogTitle>
                </div>
                <AlertDialogDescription className="pt-2 space-y-3">
                  <p>
                    You are about to escalate this issue to the parent team. This
                    will:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>
                      Create a copy of the issue in{" "}
                      <strong>{parentTeamName}</strong>
                    </li>
                    <li>Mark this issue as &quot;escalated&quot;</li>
                    <li>Link both issues together for tracking</li>
                  </ul>
                  <div className="rounded-md border p-3 bg-muted/50 mt-4">
                    <p className="text-xs text-muted-foreground">Issue</p>
                    <p className="text-sm font-medium text-foreground mt-0.5">
                      {issueTitle}
                    </p>
                    {currentTeamName && (
                      <p className="text-xs text-muted-foreground mt-2">
                        From: {currentTeamName} → To: {parentTeamName}
                      </p>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleEscalate();
                  }}
                  disabled={loading}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Escalating...
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="h-4 w-4 mr-2" />
                      Escalate to {parentTeamName}
                    </>
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * EscalationChain - Shows the escalation history of an issue
 */
interface EscalationChainItem {
  id: string;
  title: string;
  status: string;
  team: { id: string; name: string; level: number } | null;
  direction: "from" | "current" | "to";
}

interface EscalationChainProps {
  issueId: string;
  className?: string;
}

export function EscalationChain({ issueId, className }: EscalationChainProps) {
  const [chain, setChain] = useState<EscalationChainItem[]>([]);
  const [loading, setLoading] = useState(true);

  useState(() => {
    const fetchChain = async () => {
      try {
        const res = await fetch(`/api/issues/${issueId}/escalate`);
        if (res.ok) {
          const data = await res.json();
          setChain(data.chain || []);
        }
      } catch {
        // Ignore errors
      } finally {
        setLoading(false);
      }
    };
    fetchChain();
  });

  if (loading) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        Loading escalation history...
      </div>
    );
  }

  if (chain.length <= 1) {
    return null; // No escalation history
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-muted-foreground">
        Escalation Chain
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {chain.map((item, index) => (
          <div key={item.id} className="flex items-center gap-2">
            <a
              href={`/issues?id=${item.id}`}
              className={cn(
                "px-2 py-1 rounded text-sm border transition-colors",
                item.direction === "current"
                  ? "bg-primary/10 border-primary font-medium"
                  : "hover:bg-muted"
              )}
            >
              {item.team?.name || "Unknown"}
              {item.status === "escalated" && (
                <span className="ml-1 text-muted-foreground">(escalated)</span>
              )}
            </a>
            {index < chain.length - 1 && (
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
