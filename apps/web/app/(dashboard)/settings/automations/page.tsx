"use client";

import { useEffect, useState } from "react";
import { Plus, Zap, MoreVertical, Play, Pause, Trash2, History, TestTube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AutomationBuilder } from "@/components/automations/automation-builder";
import { AutomationLogs } from "@/components/automations/automation-logs";

interface Automation {
  id: string;
  name: string;
  description: string | null;
  trigger_event: string;
  trigger_conditions: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  creator?: { full_name: string };
}

const TRIGGER_LABELS: Record<string, string> = {
  "l10/meeting.created": "Meeting Created",
  "l10/meeting.updated": "Meeting Updated",
  "l10/meeting.starting_soon": "Meeting Starting Soon",
  "l10/meeting.completed": "Meeting Completed",
  "issue/created": "Issue Created",
  "issue/queued": "Issue Queued",
  "issue/resolved": "Issue Resolved",
  "rock/status.changed": "Rock Status Changed",
  "rock/completed": "Rock Completed",
  "todo/created": "To-Do Created",
  "todo/overdue": "To-Do Overdue",
  "headline/created": "Headline Created",
  "scorecard/below_goal": "Metric Below Goal",
};

const ACTION_LABELS: Record<string, string> = {
  slack_channel_message: "Slack Channel Message",
  slack_dm: "Slack Direct Message",
  push_remarkable: "Push to reMarkable",
  webhook: "Webhook",
};

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [logsAutomationId, setLogsAutomationId] = useState<string | null>(null);

  const fetchAutomations = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/automations");
      if (!response.ok) throw new Error("Failed to fetch automations");
      const data = await response.json();
      setAutomations(data.automations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load automations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAutomations();
  }, []);

  const handleToggleActive = async (automation: Automation) => {
    try {
      const response = await fetch(`/api/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !automation.is_active }),
      });

      if (!response.ok) throw new Error("Failed to update automation");
      await fetchAutomations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update automation");
    }
  };

  const handleDelete = async (automationId: string) => {
    if (!confirm("Are you sure you want to delete this automation?")) return;

    try {
      const response = await fetch(`/api/automations/${automationId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete automation");
      await fetchAutomations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete automation");
    }
  };

  const handleTest = async (automationId: string) => {
    try {
      const response = await fetch(`/api/automations/${automationId}/test`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to test automation");
      const data = await response.json();
      alert(data.message || "Test triggered successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to test automation");
    }
  };

  const handleEdit = (automation: Automation) => {
    setEditingAutomation(automation);
    setIsBuilderOpen(true);
  };

  const handleCreate = () => {
    setEditingAutomation(null);
    setIsBuilderOpen(true);
  };

  const handleBuilderClose = () => {
    setIsBuilderOpen(false);
    setEditingAutomation(null);
    fetchAutomations();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Automations</h1>
          <p className="text-sm text-muted-foreground">
            Create rules to automate actions when events occur
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Automation
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 text-red-600">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="py-6">
                <div className="h-6 bg-muted animate-pulse rounded w-1/3 mb-2" />
                <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : automations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No automations yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first automation to trigger actions when events occur
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Automation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {automations.map((automation) => (
            <Card key={automation.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div
                      className={`p-2 rounded-lg ${
                        automation.is_active
                          ? "bg-green-100 text-green-600"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium">{automation.name}</h3>
                        <Badge variant={automation.is_active ? "default" : "secondary"}>
                          {automation.is_active ? "Active" : "Paused"}
                        </Badge>
                      </div>
                      {automation.description && (
                        <p className="text-sm text-muted-foreground">
                          {automation.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-2 mt-1 text-xs text-muted-foreground">
                        <span>When: {TRIGGER_LABELS[automation.trigger_event] || automation.trigger_event}</span>
                        <span>→</span>
                        <span>{ACTION_LABELS[automation.action_type] || automation.action_type}</span>
                      </div>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(automation)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleActive(automation)}>
                        {automation.is_active ? (
                          <>
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Activate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleTest(automation.id)}>
                        <TestTube className="h-4 w-4 mr-2" />
                        Test
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLogsAutomationId(automation.id)}>
                        <History className="h-4 w-4 mr-2" />
                        View Logs
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(automation.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Automation Builder Dialog */}
      <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAutomation ? "Edit Automation" : "Create Automation"}
            </DialogTitle>
            <DialogDescription>
              Define when to trigger and what action to take
            </DialogDescription>
          </DialogHeader>
          <AutomationBuilder
            automation={editingAutomation}
            onClose={handleBuilderClose}
          />
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={!!logsAutomationId} onOpenChange={() => setLogsAutomationId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Execution History</DialogTitle>
            <DialogDescription>
              Recent automation runs and their results
            </DialogDescription>
          </DialogHeader>
          {logsAutomationId && <AutomationLogs automationId={logsAutomationId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
