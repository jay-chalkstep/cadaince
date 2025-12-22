"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, Loader2, Settings2, Database } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { MetricSourceDialog } from "@/components/integrations/metric-source-dialog";
import { CommentThread } from "@/components/comments/comment-thread";

interface MetricValue {
  id: string;
  value: number;
  notes: string | null;
  recorded_at: string;
  source: string;
}

interface Metric {
  id: string;
  name: string;
  description: string | null;
  goal: number | null;
  unit: string | null;
  frequency: string;
  current_value: number | null;
  recorded_at: string | null;
  trend: "up" | "down" | "flat";
  status: "on_track" | "at_risk" | "off_track";
  source_type?: string;
  source_config?: Record<string, unknown> | null;
  owner: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

interface MetricDetailSheetProps {
  metric: Metric | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function MetricDetailSheet({
  metric,
  open,
  onOpenChange,
  onUpdate,
}: MetricDetailSheetProps) {
  const [values, setValues] = useState<MetricValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch("/api/users/me");
        if (response.ok) {
          const data = await response.json();
          setCurrentUserId(data.id);
        }
      } catch (error) {
        console.error("Failed to fetch current user:", error);
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (metric && open) {
      fetchValues();
    }
  }, [metric, open]);

  const fetchValues = async () => {
    if (!metric) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/metrics/${metric.id}/values?limit=12`);
      if (response.ok) {
        const data = await response.json();
        setValues(data);
      }
    } catch (error) {
      console.error("Failed to fetch values:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metric || !newValue) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/metrics/${metric.id}/values`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: parseFloat(newValue),
          notes: notes || null,
        }),
      });

      if (response.ok) {
        setNewValue("");
        setNotes("");
        fetchValues();
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to record value:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: Metric["status"]) => {
    switch (status) {
      case "on_track":
        return <Badge variant="default" className="bg-green-600">On Track</Badge>;
      case "at_risk":
        return <Badge variant="default" className="bg-yellow-500">At Risk</Badge>;
      case "off_track":
        return <Badge variant="destructive">Off Track</Badge>;
    }
  };

  const getTrendIcon = (trend: Metric["trend"]) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case "flat":
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatValue = (value: number | null, unit: string | null) => {
    if (value === null) return "—";
    if (unit === "%") return `${value}%`;
    if (unit === "$") return `$${value.toLocaleString()}`;
    return unit ? `${value} ${unit}` : value.toString();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!metric) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{metric.name}</SheetTitle>
          <SheetDescription>
            {metric.description || "No description"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Current Status */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Value</p>
              <p className="text-3xl font-bold">
                {formatValue(metric.current_value, metric.unit)}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                {getTrendIcon(metric.trend)}
                {getStatusBadge(metric.status)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Goal: {formatValue(metric.goal, metric.unit)}
              </p>
            </div>
          </div>

          {/* Owner */}
          {metric.owner && (
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={metric.owner.avatar_url || undefined} />
                <AvatarFallback>{getInitials(metric.owner.full_name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{metric.owner.full_name}</p>
                <p className="text-sm text-muted-foreground">Owner</p>
              </div>
            </div>
          )}

          {/* Data Source */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Data Source</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {metric.source_type || "manual"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSourceDialogOpen(true)}
            >
              <Settings2 className="mr-1.5 h-4 w-4" />
              Configure
            </Button>
          </div>

          <Separator />

          {/* Record New Value */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="font-medium">Record New Value</h3>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="value">Value {metric.unit && `(${metric.unit})`}</Label>
                <Input
                  id="value"
                  type="number"
                  step="any"
                  placeholder="Enter value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any context..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <Button type="submit" disabled={submitting || !newValue}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Value
            </Button>
          </form>

          <Separator />

          {/* History */}
          <div className="space-y-3">
            <h3 className="font-medium">History</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : values.length === 0 ? (
              <p className="text-sm text-muted-foreground">No values recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {values.map((value) => (
                  <div
                    key={value.id}
                    className="flex items-start justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="font-mono font-medium">
                        {formatValue(value.value, metric.unit)}
                      </p>
                      {value.notes && (
                        <p className="text-sm text-muted-foreground">{value.notes}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {formatDate(value.recorded_at)}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {value.source}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Comments */}
          <CommentThread
            entityType="metric"
            entityId={metric.id}
            currentUserId={currentUserId}
          />
        </div>

        <MetricSourceDialog
          open={sourceDialogOpen}
          onOpenChange={setSourceDialogOpen}
          metric={metric}
          onSave={() => {
            onUpdate();
            setSourceDialogOpen(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
