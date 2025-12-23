"use client";

import { useState } from "react";
import {
  Bell,
  AlertTriangle,
  TrendingDown,
  Clock,
  User,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

interface Alert {
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
}

interface AlertDetailSheetProps {
  alert: Alert | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAcknowledge: () => void;
  currentUserId: string | null;
}

const typeConfig = {
  human: { label: "Manual Alert", icon: User, color: "bg-blue-500" },
  threshold: { label: "Threshold Breach", icon: TrendingDown, color: "bg-red-500" },
  anomaly: { label: "Anomaly Detected", icon: AlertTriangle, color: "bg-yellow-500" },
  missing_update: { label: "Missing Update", icon: Clock, color: "bg-orange-500" },
};

export function AlertDetailSheet({
  alert,
  open,
  onOpenChange,
  onAcknowledge,
  currentUserId,
}: AlertDetailSheetProps) {
  const [acknowledging, setAcknowledging] = useState(false);

  if (!alert) return null;

  const TypeIcon = typeConfig[alert.type]?.icon || Bell;
  const isAcknowledged = alert.acknowledgments?.some(
    (ack) => ack.profile_id === currentUserId
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    try {
      const response = await fetch(`/api/alerts/${alert.id}`, {
        method: "POST",
      });

      if (response.ok) {
        onAcknowledge();
      }
    } catch (error) {
      console.error("Failed to acknowledge:", error);
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${typeConfig[alert.type]?.color || "bg-gray-500"}`}>
              <TypeIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <SheetTitle className="text-left">{alert.title}</SheetTitle>
              <SheetDescription className="text-left">
                {typeConfig[alert.type]?.label}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Severity & Status */}
          <div className="flex items-center gap-2">
            {alert.severity === "urgent" ? (
              <Badge variant="destructive">Urgent</Badge>
            ) : (
              <Badge variant="secondary">Normal</Badge>
            )}
            {isAcknowledged && (
              <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Acknowledged
              </Badge>
            )}
          </div>

          {/* Description */}
          {alert.description && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Details</h4>
              <p className="text-sm text-muted-foreground">{alert.description}</p>
            </div>
          )}

          {/* Triggered By */}
          {alert.triggered_by_profile && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Raised By</h4>
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={alert.triggered_by_profile.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(alert.triggered_by_profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{alert.triggered_by_profile.full_name}</span>
              </div>
            </div>
          )}

          {/* Related Metric */}
          {alert.metric && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Related Metric</h4>
              <Badge variant="outline">{alert.metric.name}</Badge>
            </div>
          )}

          <Separator />

          {/* Acknowledgments */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">
              Acknowledgments ({alert.acknowledgments?.length || 0})
            </h4>
            {alert.acknowledgments && alert.acknowledgments.length > 0 ? (
              <div className="space-y-2">
                {alert.acknowledgments.map((ack) => (
                  <div key={ack.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={ack.profile.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(ack.profile.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{ack.profile.full_name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(ack.acknowledged_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No one has acknowledged yet.</p>
            )}
          </div>

          {/* Acknowledge Button */}
          {!isAcknowledged && (
            <Button onClick={handleAcknowledge} disabled={acknowledging} className="w-full">
              {acknowledging ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Acknowledge Alert
            </Button>
          )}

          <Separator />

          {/* Timestamp */}
          <div className="text-sm text-muted-foreground">
            Created {formatDate(alert.created_at)}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
