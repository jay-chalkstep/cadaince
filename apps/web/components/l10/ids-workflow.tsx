"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  ChevronRight,
  Check,
  X,
  ArrowRight,
  Plus,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Issue {
  id: string;
  title: string;
  description: string | null;
  priority: number | null;
  status: string;
  raised_by?: {
    id: string;
    full_name: string;
  };
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string;
}

interface IDSWorkflowProps {
  issues: Issue[];
  meetingId: string;
  profiles: Profile[];
  onResolve: (
    issueId: string,
    outcome: "solved" | "todo_created" | "pushed" | "killed",
    data: {
      decision_notes?: string;
      todo_title?: string;
      todo_owner_id?: string;
      todo_due_date?: string;
    }
  ) => Promise<void>;
}

type IDSStep = "identify" | "discuss" | "solve";

export function IDSWorkflow({ issues, meetingId, profiles, onResolve }: IDSWorkflowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<IDSStep>("identify");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [todoTitle, setTodoTitle] = useState("");
  const [todoOwnerId, setTodoOwnerId] = useState("");
  const [todoDueDate, setTodoDueDate] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolvedIssues, setResolvedIssues] = useState<Set<string>>(new Set());

  const currentIssue = issues[currentIndex];
  const remainingIssues = issues.filter((i) => !resolvedIssues.has(i.id));

  useEffect(() => {
    // Set default due date to next Friday
    const today = new Date();
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + ((5 - today.getDay() + 7) % 7 || 7));
    setTodoDueDate(nextFriday.toISOString().split("T")[0]);
  }, []);

  const handleResolve = async (outcome: "solved" | "todo_created" | "pushed" | "killed") => {
    if (!currentIssue) return;

    setResolving(true);
    try {
      await onResolve(currentIssue.id, outcome, {
        decision_notes: decisionNotes || undefined,
        todo_title: outcome === "todo_created" ? todoTitle : undefined,
        todo_owner_id: outcome === "todo_created" ? todoOwnerId : undefined,
        todo_due_date: outcome === "todo_created" ? todoDueDate : undefined,
      });

      setResolvedIssues((prev) => new Set(prev).add(currentIssue.id));
      resetForm();

      // Move to next unresolved issue
      const nextIndex = issues.findIndex(
        (i, idx) => idx > currentIndex && !resolvedIssues.has(i.id)
      );
      if (nextIndex !== -1) {
        setCurrentIndex(nextIndex);
      }
    } catch (error) {
      console.error("Failed to resolve issue:", error);
    } finally {
      setResolving(false);
    }
  };

  const resetForm = () => {
    setStep("identify");
    setDecisionNotes("");
    setTodoTitle("");
    setTodoOwnerId("");
  };

  const nextStep = () => {
    if (step === "identify") setStep("discuss");
    else if (step === "discuss") setStep("solve");
  };

  const prevStep = () => {
    if (step === "solve") setStep("discuss");
    else if (step === "discuss") setStep("identify");
  };

  if (remainingIssues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Check className="h-12 w-12 text-green-600 mb-4" />
        <h3 className="text-lg font-medium">All issues resolved!</h3>
        <p className="text-muted-foreground mt-2">
          Great work! You&apos;ve processed all {resolvedIssues.size} issues.
        </p>
      </div>
    );
  }

  if (!currentIssue) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No issues to process
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Issue {currentIndex + 1} of {issues.length}
          {resolvedIssues.size > 0 && (
            <span className="ml-2 text-green-600">
              ({resolvedIssues.size} resolved)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(["identify", "discuss", "solve"] as IDSStep[]).map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  s === step
                    ? "bg-primary text-primary-foreground"
                    : resolvedIssues.has(currentIssue.id) ||
                      (["discuss", "solve"].indexOf(step) >= i)
                    ? "bg-green-100 text-green-700"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </div>
              {i < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
            </div>
          ))}
        </div>
      </div>

      {/* Issue Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{currentIssue.title}</CardTitle>
              <CardDescription>
                Raised by {currentIssue.raised_by?.full_name || "Unknown"} •{" "}
                {new Date(currentIssue.created_at).toLocaleDateString()}
              </CardDescription>
            </div>
            {currentIssue.priority && (
              <Badge variant="outline">Priority {currentIssue.priority}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {currentIssue.description && (
            <p className="text-sm text-muted-foreground mb-4">
              {currentIssue.description}
            </p>
          )}

          <Separator className="my-4" />

          {/* Step Content */}
          {step === "identify" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-50 p-4">
                <h4 className="font-medium text-blue-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Identify
                </h4>
                <p className="mt-1 text-sm text-blue-700">
                  What is the real issue here? Dig deeper to find the root cause.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Discussion Notes</Label>
                <Textarea
                  placeholder="What is the real issue? Capture key points..."
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          {step === "discuss" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-yellow-50 p-4">
                <h4 className="font-medium text-yellow-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Discuss
                </h4>
                <p className="mt-1 text-sm text-yellow-700">
                  Everyone gets 1-2 minutes to share their perspective. No interrupting.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Key Points & Perspectives</Label>
                <Textarea
                  placeholder="Capture key discussion points..."
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}

          {step === "solve" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 p-4">
                <h4 className="font-medium text-green-800 flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Solve
                </h4>
                <p className="mt-1 text-sm text-green-700">
                  Decide on the outcome. Create a to-do if action is needed.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="h-auto py-4"
                  onClick={() => handleResolve("solved")}
                  disabled={resolving}
                >
                  <div className="text-center">
                    <Check className="h-5 w-5 mx-auto mb-1 text-green-600" />
                    <div className="font-medium">Solved</div>
                    <div className="text-xs text-muted-foreground">Issue resolved</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-4"
                  onClick={() => handleResolve("killed")}
                  disabled={resolving}
                >
                  <div className="text-center">
                    <X className="h-5 w-5 mx-auto mb-1 text-red-600" />
                    <div className="font-medium">Kill</div>
                    <div className="text-xs text-muted-foreground">Not a real issue</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-4"
                  onClick={() => handleResolve("pushed")}
                  disabled={resolving}
                >
                  <div className="text-center">
                    <ArrowRight className="h-5 w-5 mx-auto mb-1 text-yellow-600" />
                    <div className="font-medium">Push</div>
                    <div className="text-xs text-muted-foreground">Next week</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-4 border-primary"
                  onClick={() => {
                    // Show todo form
                    setTodoTitle(currentIssue.title);
                  }}
                >
                  <div className="text-center">
                    <Plus className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <div className="font-medium">Create To-Do</div>
                    <div className="text-xs text-muted-foreground">Assign action</div>
                  </div>
                </Button>
              </div>

              {/* Todo creation form */}
              {todoTitle && (
                <div className="space-y-4 rounded-lg border p-4">
                  <h4 className="font-medium">Create To-Do</h4>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={todoTitle}
                      onChange={(e) => setTodoTitle(e.target.value)}
                      placeholder="What needs to be done?"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Owner</Label>
                      <Select value={todoOwnerId} onValueChange={setTodoOwnerId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Assign to..." />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Due Date</Label>
                      <Input
                        type="date"
                        value={todoDueDate}
                        onChange={(e) => setTodoDueDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() => handleResolve("todo_created")}
                    disabled={resolving || !todoTitle || !todoOwnerId || !todoDueDate}
                    className="w-full"
                  >
                    {resolving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create To-Do & Resolve Issue
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={step === "identify" || resolving}
        >
          Back
        </Button>
        {step !== "solve" && (
          <Button onClick={nextStep} disabled={resolving}>
            Continue
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
