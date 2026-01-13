"use client";

import { useState, useEffect } from "react";
import { User, Ticket, Clock, ThumbsUp, MessageSquare } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/types/support-pulse";
import type { OwnerDetail, TimeFrameDays } from "@/types/support-pulse";

interface OwnerDetailModalProps {
  ownerId: string | null;
  onClose: () => void;
  days: TimeFrameDays;
  customRange: { start: Date; end: Date } | null;
}

function getScoreColor(score: number): string {
  if (score >= 8) return "text-green-600";
  if (score >= 7) return "text-yellow-600";
  return "text-red-600";
}

function getSentimentBadge(sentiment: string | null) {
  if (!sentiment) return null;

  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    positive: "default",
    neutral: "secondary",
    negative: "destructive",
  };

  return (
    <Badge variant={variants[sentiment.toLowerCase()] || "outline"} className="text-xs">
      {sentiment}
    </Badge>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function MetricCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          <Icon className="h-3 w-3" />
          {label}
        </div>
        {loading ? (
          <Skeleton className="h-6 w-12" />
        ) : (
          <div className="text-lg font-semibold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

export function OwnerDetailModal({
  ownerId,
  onClose,
  days,
  customRange,
}: OwnerDetailModalProps) {
  const [data, setData] = useState<OwnerDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ownerId) {
      setData(null);
      return;
    }

    const fetchOwnerDetail = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();

        if (days !== "custom") {
          params.set("days", String(days));
        } else if (customRange) {
          params.set("start_date", customRange.start.toISOString());
          params.set("end_date", customRange.end.toISOString());
        }

        const res = await fetch(`/api/support/owner/${ownerId}?${params}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error("Failed to fetch owner detail:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOwnerDetail();
  }, [ownerId, days, customRange]);

  const isOpen = ownerId !== null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {loading ? (
              <Skeleton className="h-6 w-32" />
            ) : data?.owner.name ? (
              data.owner.name
            ) : (
              `Owner ${ownerId}`
            )}
          </SheetTitle>
          <SheetDescription>
            Owner performance metrics and feedback
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Metrics Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MetricCard
              icon={Ticket}
              label="Total Tickets"
              value={loading ? "—" : data?.metrics.totalTickets ?? 0}
              loading={loading}
            />
            <MetricCard
              icon={Ticket}
              label="Open"
              value={loading ? "—" : data?.metrics.openTickets ?? 0}
              loading={loading}
            />
            <MetricCard
              icon={Clock}
              label="Avg Resolution"
              value={loading ? "—" : formatDuration(data?.metrics.avgResolutionMs ?? null)}
              loading={loading}
            />
            <MetricCard
              icon={ThumbsUp}
              label="Avg Score"
              value={
                loading
                  ? "—"
                  : data?.metrics.avgFeedbackScore != null
                  ? data.metrics.avgFeedbackScore.toFixed(1)
                  : "—"
              }
              loading={loading}
            />
            <MetricCard
              icon={MessageSquare}
              label="Surveys"
              value={loading ? "—" : data?.metrics.surveyCount ?? 0}
              loading={loading}
            />
          </div>

          {/* Feedback Table */}
          <div>
            <h3 className="text-sm font-medium mb-3">Feedback Responses</h3>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !data?.feedback || data.feedback.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ThumbsUp className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p>No feedback responses</p>
                <p className="text-sm">for this owner in the selected period</p>
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Date</TableHead>
                      <TableHead className="w-[60px]">Score</TableHead>
                      <TableHead>Ticket</TableHead>
                      <TableHead className="w-[80px]">Sentiment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.feedback.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(item.submittedAt)}
                        </TableCell>
                        <TableCell>
                          <span className={`font-medium ${getScoreColor(item.score)}`}>
                            {item.score}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm truncate max-w-[150px]" title={item.ticketSubject}>
                          {item.ticketSubject}
                        </TableCell>
                        <TableCell>
                          {getSentimentBadge(item.sentiment)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
