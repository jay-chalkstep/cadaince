"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Automation {
  id: string;
  name: string;
  description: string | null;
  trigger_event: string;
  trigger_conditions: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
}

interface AutomationBuilderProps {
  automation?: Automation | null;
  onClose: () => void;
}

const TRIGGER_EVENTS = [
  { value: "l10/meeting.created", label: "Meeting Created", description: "When a new L10 meeting is scheduled" },
  { value: "l10/meeting.starting_soon", label: "Meeting Starting Soon", description: "Before a meeting starts (customizable timing)" },
  { value: "l10/meeting.completed", label: "Meeting Completed", description: "When a meeting is marked complete" },
  { value: "issue/created", label: "Issue Created", description: "When a new issue is added" },
  { value: "issue/queued", label: "Issue Queued for L10", description: "When an issue is queued for discussion" },
  { value: "issue/resolved", label: "Issue Resolved", description: "When an issue is marked solved" },
  { value: "rock/status.changed", label: "Rock Status Changed", description: "When a rock's status changes" },
  { value: "rock/completed", label: "Rock Completed", description: "When a rock is marked complete" },
  { value: "todo/created", label: "To-Do Created", description: "When a new to-do is added" },
  { value: "todo/overdue", label: "To-Do Overdue", description: "When a to-do passes its due date" },
  { value: "headline/created", label: "Headline Shared", description: "When a headline is shared" },
  { value: "scorecard/below_goal", label: "Metric Below Goal", description: "When a scorecard metric falls below target" },
];

const ACTION_TYPES = [
  { value: "slack_channel_message", label: "Slack Channel Message", description: "Post a message to a Slack channel" },
  { value: "slack_dm", label: "Slack Direct Message", description: "Send a DM to the relevant person" },
  { value: "push_remarkable", label: "Push to reMarkable", description: "Send a document to reMarkable tablet" },
  { value: "webhook", label: "Webhook", description: "Send data to an external URL" },
];

export function AutomationBuilder({ automation, onClose }: AutomationBuilderProps) {
  const [name, setName] = useState(automation?.name || "");
  const [description, setDescription] = useState(automation?.description || "");
  const [triggerEvent, setTriggerEvent] = useState(automation?.trigger_event || "");
  const [actionType, setActionType] = useState(automation?.action_type || "");
  const [actionConfig, setActionConfig] = useState<Record<string, unknown>>(
    automation?.action_config || {}
  );
  const [triggerConditions, setTriggerConditions] = useState<Record<string, unknown>>(
    automation?.trigger_conditions || {}
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Slack channels if needed
  const [slackChannels, setSlackChannels] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

  useEffect(() => {
    if (actionType === "slack_channel_message") {
      fetchSlackChannels();
    }
  }, [actionType]);

  const fetchSlackChannels = async () => {
    try {
      setLoadingChannels(true);
      const response = await fetch("/api/integrations/slack/channels");
      if (response.ok) {
        const data = await response.json();
        setSlackChannels(data.channels || []);
      }
    } catch (err) {
      console.error("Failed to fetch Slack channels:", err);
    } finally {
      setLoadingChannels(false);
    }
  };

  const handleSubmit = async () => {
    if (!name || !triggerEvent || !actionType) {
      setError("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const url = automation ? `/api/automations/${automation.id}` : "/api/automations";
      const method = automation ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          trigger_event: triggerEvent,
          trigger_conditions: triggerConditions,
          action_type: actionType,
          action_config: actionConfig,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save automation");
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save automation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateActionConfig = (key: string, value: unknown) => {
    setActionConfig((prev) => ({ ...prev, [key]: value }));
  };

  const updateTriggerCondition = (key: string, value: unknown) => {
    setTriggerConditions((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Notify team when rock goes off-track"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description of what this automation does"
            rows={2}
          />
        </div>
      </div>

      {/* Trigger Event */}
      <div className="space-y-2">
        <Label>When this happens *</Label>
        <Select value={triggerEvent} onValueChange={setTriggerEvent}>
          <SelectTrigger>
            <SelectValue placeholder="Select trigger event" />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_EVENTS.map((event) => (
              <SelectItem key={event.value} value={event.value}>
                <div>
                  <div className="font-medium">{event.label}</div>
                  <div className="text-xs text-muted-foreground">{event.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Trigger Conditions */}
      {triggerEvent === "rock/status.changed" && (
        <div className="space-y-2">
          <Label>Only when status is</Label>
          <Select
            value={(triggerConditions.new_status as string) || ""}
            onValueChange={(value) => updateTriggerCondition("new_status", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any status change" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="on_track">On Track</SelectItem>
              <SelectItem value="off_track">Off Track</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Action Type */}
      <div className="space-y-2">
        <Label>Do this *</Label>
        <Select value={actionType} onValueChange={setActionType}>
          <SelectTrigger>
            <SelectValue placeholder="Select action" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_TYPES.map((action) => (
              <SelectItem key={action.value} value={action.value}>
                <div>
                  <div className="font-medium">{action.label}</div>
                  <div className="text-xs text-muted-foreground">{action.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Action Config - Slack Channel */}
      {actionType === "slack_channel_message" && (
        <div className="space-y-4 p-4 bg-muted rounded-lg">
          <div className="space-y-2">
            <Label>Slack Channel *</Label>
            {loadingChannels ? (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading channels...</span>
              </div>
            ) : (
              <Select
                value={(actionConfig.channel_id as string) || ""}
                onValueChange={(value) => updateActionConfig("channel_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  {slackChannels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      #{channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Message Template</Label>
            <Textarea
              value={(actionConfig.message_template as string) || ""}
              onChange={(e) => updateActionConfig("message_template", e.target.value)}
              placeholder="Use {{title}}, {{owner_name}}, etc. for dynamic values"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Available variables: {"{{title}}"}, {"{{owner_name}}"}, {"{{status}}"}, {"{{priority}}"}
            </p>
          </div>
        </div>
      )}

      {/* Action Config - Slack DM */}
      {actionType === "slack_dm" && (
        <div className="space-y-4 p-4 bg-muted rounded-lg">
          <div className="space-y-2">
            <Label>Send DM to</Label>
            <Select
              value={(actionConfig.user_field as string) || "owner_id"}
              onValueChange={(value) => updateActionConfig("user_field", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner_id">Owner</SelectItem>
                <SelectItem value="created_by">Creator</SelectItem>
                <SelectItem value="assigned_to">Assigned User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Message Template</Label>
            <Textarea
              value={(actionConfig.message_template as string) || ""}
              onChange={(e) => updateActionConfig("message_template", e.target.value)}
              placeholder="Your to-do {{title}} is now overdue!"
              rows={3}
            />
          </div>
        </div>
      )}

      {/* Action Config - reMarkable */}
      {actionType === "push_remarkable" && (
        <div className="space-y-4 p-4 bg-muted rounded-lg">
          <div className="space-y-2">
            <Label>Document Type *</Label>
            <Select
              value={(actionConfig.document_type as string) || ""}
              onValueChange={(value) => updateActionConfig("document_type", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="meeting_agenda">Meeting Agenda</SelectItem>
                <SelectItem value="briefing">Morning Briefing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Push to user</Label>
            <Select
              value={(actionConfig.target_user_field as string) || "owner_id"}
              onValueChange={(value) => updateActionConfig("target_user_field", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner_id">Owner</SelectItem>
                <SelectItem value="created_by">Creator</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Action Config - Webhook */}
      {actionType === "webhook" && (
        <div className="space-y-4 p-4 bg-muted rounded-lg">
          <div className="space-y-2">
            <Label>Webhook URL *</Label>
            <Input
              value={(actionConfig.url as string) || ""}
              onChange={(e) => updateActionConfig("url", e.target.value)}
              placeholder="https://your-endpoint.com/webhook"
            />
          </div>

          <div className="space-y-2">
            <Label>HTTP Method</Label>
            <Select
              value={(actionConfig.method as string) || "POST"}
              onValueChange={(value) => updateActionConfig("method", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : automation ? (
            "Save Changes"
          ) : (
            "Create Automation"
          )}
        </Button>
      </div>
    </div>
  );
}
