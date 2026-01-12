"use client";

import {
  Bell,
  AlertTriangle,
  TrendingDown,
  Clock,
  User,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  UpdateExpandableCard,
  Update,
  UpdateActions,
} from "@/components/updates/update-expandable-card";

// Alert type matching the alerts page interface
export interface Alert {
  id: string;
  type: "human" | "threshold" | "anomaly" | "missing_update";
  severity: "normal" | "urgent";
  title: string;
  description: string | null;
  created_at: string;
  triggered_by_profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  metric: {
    id: string;
    name: string;
  } | null;
  acknowledgments: Array<{
    id: string;
    profile_id: string;
    acknowledged_at: string;
    profile: {
      id: string;
      full_name: string;
      avatar_url: string | null;
    };
  }>;
  user_acknowledged?: boolean;
}

export interface StreamItemData {
  item_type: "update" | "alert";
  id: string;
  created_at: string;
  data: Update | Alert;
}

const alertTypeConfig = {
  human: { label: "Manual", icon: User, color: "bg-blue-500" },
  threshold: { label: "Threshold", icon: TrendingDown, color: "bg-red-500" },
  anomaly: { label: "Anomaly", icon: AlertTriangle, color: "bg-yellow-500" },
  missing_update: { label: "Missing Update", icon: Clock, color: "bg-orange-500" },
};

interface StreamItemProps {
  item: StreamItemData;
  // For updates
  expandedUpdateId: string | null;
  onToggleExpand: (id: string | null) => void;
  updateActions?: UpdateActions;
  canDeleteUpdate?: boolean;
  currentUserId: string | null;
  // For alerts
  onAlertClick: (alert: Alert) => void;
}

function formatRelativeDate(date: string) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function StreamItem({
  item,
  expandedUpdateId,
  onToggleExpand,
  updateActions,
  canDeleteUpdate,
  currentUserId,
  onAlertClick,
}: StreamItemProps) {
  if (item.item_type === "update") {
    const update = item.data as Update;
    return (
      <UpdateExpandableCard
        update={update}
        isExpanded={expandedUpdateId === update.id}
        onToggleExpand={onToggleExpand}
        actions={updateActions}
        canDelete={canDeleteUpdate}
      />
    );
  }

  // Render alert card
  const alert = item.data as Alert;
  const TypeIcon = alertTypeConfig[alert.type]?.icon || Bell;
  const acknowledged =
    alert.user_acknowledged ||
    alert.acknowledgments?.some((ack) => ack.profile_id === currentUserId);

  return (
    <Card
      className={`cursor-pointer hover:bg-muted/50 transition-colors ${
        alert.severity === "urgent" ? "border-red-500 border-2" : ""
      } ${!acknowledged ? "border-l-2 border-l-orange-500" : ""}`}
      onClick={() => onAlertClick(alert)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div
            className={`p-2 rounded-lg ${
              alertTypeConfig[alert.type]?.color || "bg-gray-500"
            }`}
          >
            <TypeIcon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                Alert
              </Badge>
              <h3 className="font-medium">{alert.title}</h3>
              {alert.severity === "urgent" && (
                <Badge variant="destructive" className="text-xs">
                  Urgent
                </Badge>
              )}
              {acknowledged && (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
            </div>
            {alert.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {alert.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>{formatRelativeDate(alert.created_at)}</span>
              {alert.triggered_by_profile && (
                <>
                  <span>·</span>
                  <span>By {alert.triggered_by_profile.full_name}</span>
                </>
              )}
              {alert.metric && (
                <>
                  <span>·</span>
                  <Badge variant="outline" className="text-xs">
                    {alert.metric.name}
                  </Badge>
                </>
              )}
            </div>
          </div>
          {alert.acknowledgments && alert.acknowledgments.length > 0 && (
            <div className="flex -space-x-2">
              {alert.acknowledgments.slice(0, 3).map((ack) => (
                <Avatar key={ack.id} className="h-7 w-7 border-2 border-background">
                  <AvatarImage src={ack.profile.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(ack.profile.full_name)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {alert.acknowledgments.length > 3 && (
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                  +{alert.acknowledgments.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
