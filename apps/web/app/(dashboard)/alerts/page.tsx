"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  AlertTriangle,
  TrendingDown,
  Clock,
  User,
  CheckCircle2,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDetailSheet } from "@/components/alerts/alert-detail-sheet";
import { CreateAlertDialog } from "@/components/alerts/create-alert-dialog";

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
  human: { label: "Manual", icon: User, color: "bg-blue-500" },
  threshold: { label: "Threshold", icon: TrendingDown, color: "bg-red-500" },
  anomaly: { label: "Anomaly", icon: AlertTriangle, color: "bg-yellow-500" },
  missing_update: { label: "Missing Update", icon: Clock, color: "bg-orange-500" },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      let url = "/api/alerts";
      if (activeTab === "unacknowledged") {
        url += "?acknowledged=false";
      } else if (activeTab === "acknowledged") {
        url += "?acknowledged=true";
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      }

      // Get current user ID
      const meResponse = await fetch("/api/users/me");
      if (meResponse.ok) {
        const meData = await meResponse.json();
        setCurrentUserId(meData.id);
      }
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [activeTab]);

  const handleAlertClick = (alert: Alert) => {
    setSelectedAlert(alert);
    setSheetOpen(true);
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
  };

  const isAcknowledgedByMe = (alert: Alert) => {
    return alert.acknowledgments?.some((ack) => ack.profile_id === currentUserId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Important notifications and threshold breaches
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Raise Alert
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Alerts</TabsTrigger>
          <TabsTrigger value="unacknowledged">Unacknowledged</TabsTrigger>
          <TabsTrigger value="acknowledged">Acknowledged</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No alerts</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {activeTab === "unacknowledged"
                    ? "You've acknowledged all alerts."
                    : "No alerts have been triggered."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => {
                const TypeIcon = typeConfig[alert.type]?.icon || Bell;
                const acknowledged = isAcknowledgedByMe(alert);

                return (
                  <Card
                    key={alert.id}
                    className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                      alert.severity === "urgent" ? "border-red-500 border-2" : ""
                    }`}
                    onClick={() => handleAlertClick(alert)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div
                          className={`p-2 rounded-lg ${
                            typeConfig[alert.type]?.color || "bg-gray-500"
                          }`}
                        >
                          <TypeIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
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
                            <span>{formatDate(alert.created_at)}</span>
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
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDetailSheet
        alert={selectedAlert}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onAcknowledge={fetchAlerts}
        currentUserId={currentUserId}
      />

      <CreateAlertDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={fetchAlerts}
      />
    </div>
  );
}
