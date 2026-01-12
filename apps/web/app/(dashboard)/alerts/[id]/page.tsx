"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  AlertTriangle,
  TrendingDown,
  Clock,
  User,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

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

const typeConfig = {
  human: { label: "Manual Alert", icon: User, color: "bg-blue-500" },
  threshold: { label: "Threshold Breach", icon: TrendingDown, color: "bg-red-500" },
  anomaly: { label: "Anomaly Detected", icon: AlertTriangle, color: "bg-yellow-500" },
  missing_update: { label: "Missing Update", icon: Clock, color: "bg-orange-500" },
};

export default function AlertDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [alertRes, meRes] = await Promise.all([
          fetch(`/api/alerts/${params.id}`),
          fetch("/api/users/me"),
        ]);

        if (alertRes.ok) {
          const data = await alertRes.json();
          setAlert(data);
        } else if (alertRes.status === 404) {
          setError("Alert not found");
        } else {
          setError("Failed to load alert");
        }

        if (meRes.ok) {
          const meData = await meRes.json();
          setCurrentUserId(meData.id);
        }
      } catch (err) {
        setError("Failed to load alert");
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchData();
    }
  }, [params.id]);

  const handleAcknowledge = async () => {
    if (!alert) return;
    setAcknowledging(true);
    try {
      const response = await fetch(`/api/alerts/${alert.id}/acknowledge`, {
        method: "POST",
      });
      if (response.ok) {
        // Refresh alert data
        const alertRes = await fetch(`/api/alerts/${params.id}`);
        if (alertRes.ok) {
          setAlert(await alertRes.json());
        }
      }
    } catch (err) {
      console.error("Failed to acknowledge:", err);
    } finally {
      setAcknowledging(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const isAcknowledgedByMe = () => {
    return alert?.acknowledgments?.some((ack) => ack.profile_id === currentUserId);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-4" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">{error || "Alert not found"}</p>
            <p className="text-sm text-muted-foreground mb-4">
              This alert may have been deleted or you don't have access.
            </p>
            <Button onClick={() => router.push("/alerts")}>
              View All Alerts
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const TypeIcon = typeConfig[alert.type]?.icon || Bell;
  const acknowledged = isAcknowledgedByMe();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-lg ${typeConfig[alert.type]?.color || "bg-gray-500"}`}
            >
              <TypeIcon className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-semibold">{alert.title}</h1>
            {alert.severity === "urgent" && (
              <Badge variant="destructive">Urgent</Badge>
            )}
            {acknowledged && (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDate(alert.created_at)}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Description */}
          {alert.description && (
            <div>
              <h3 className="font-medium mb-2">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {alert.description}
              </p>
            </div>
          )}

          {/* Type */}
          <div>
            <h3 className="font-medium mb-2">Alert Type</h3>
            <Badge variant="secondary">
              {typeConfig[alert.type]?.label || alert.type}
            </Badge>
          </div>

          {/* Triggered by */}
          {alert.triggered_by_profile && (
            <div>
              <h3 className="font-medium mb-2">Raised by</h3>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={alert.triggered_by_profile.avatar_url || undefined} />
                  <AvatarFallback>
                    {getInitials(alert.triggered_by_profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span>{alert.triggered_by_profile.full_name}</span>
              </div>
            </div>
          )}

          {/* Related metric */}
          {alert.metric && (
            <div>
              <h3 className="font-medium mb-2">Related Metric</h3>
              <Badge variant="outline">{alert.metric.name}</Badge>
            </div>
          )}

          {/* Acknowledgments */}
          <div>
            <h3 className="font-medium mb-2">
              Acknowledgments ({alert.acknowledgments?.length || 0})
            </h3>
            {alert.acknowledgments && alert.acknowledgments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {alert.acknowledgments.map((ack) => (
                  <div
                    key={ack.id}
                    className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={ack.profile.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(ack.profile.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{ack.profile.full_name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No acknowledgments yet</p>
            )}
          </div>

          {/* Acknowledge button */}
          {!acknowledged && (
            <div className="pt-4 border-t">
              <Button onClick={handleAcknowledge} disabled={acknowledging}>
                {acknowledging ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Acknowledge Alert
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
