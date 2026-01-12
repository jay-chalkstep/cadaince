"use client";

import {
  Ticket,
  Clock,
  MessageSquare,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDuration, formatPercentChange } from "@/types/support-pulse";
import type { SupportMetrics } from "@/types/support-pulse";

interface SummaryCardsProps {
  summary: SupportMetrics;
}

function TrendIndicator({ value, inverted = false }: { value: number; inverted?: boolean }) {
  // For time metrics, lower is better (inverted=true)
  const isPositive = inverted ? value < 0 : value > 0;
  const isNeutral = Math.abs(value) < 1;

  if (isNeutral) {
    return (
      <span className="flex items-center text-sm text-muted-foreground">
        <Minus className="h-4 w-4 mr-1" />
        {formatPercentChange(value)}
      </span>
    );
  }

  if (isPositive) {
    return (
      <span className="flex items-center text-sm text-green-600">
        <TrendingUp className="h-4 w-4 mr-1" />
        {formatPercentChange(value)}
      </span>
    );
  }

  return (
    <span className="flex items-center text-sm text-red-600">
      <TrendingDown className="h-4 w-4 mr-1" />
      {formatPercentChange(value)}
    </span>
  );
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Tickets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardDescription>Total Tickets</CardDescription>
          <Ticket className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <CardTitle className="text-3xl">{summary.totalTickets}</CardTitle>
          <div className="flex items-center gap-2 mt-1">
            <TrendIndicator value={summary.percentChange} />
            <span className="text-xs text-muted-foreground">vs previous period</span>
          </div>
        </CardContent>
      </Card>

      {/* Avg Time to Close */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardDescription>Avg Time to Close</CardDescription>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <CardTitle className="text-3xl">{formatDuration(summary.avgTimeToClose)}</CardTitle>
          <div className="flex items-center gap-2 mt-1">
            <TrendIndicator value={summary.avgTimeToCloseChange} inverted />
            <span className="text-xs text-muted-foreground">vs previous period</span>
          </div>
        </CardContent>
      </Card>

      {/* Avg First Response */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardDescription>Avg First Response</CardDescription>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <CardTitle className="text-3xl">{formatDuration(summary.avgFirstResponse)}</CardTitle>
          <div className="flex items-center gap-2 mt-1">
            <TrendIndicator value={summary.avgFirstResponseChange} inverted />
            <span className="text-xs text-muted-foreground">vs previous period</span>
          </div>
        </CardContent>
      </Card>

      {/* Open Tickets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardDescription>Open Tickets</CardDescription>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <CardTitle className="text-3xl">{summary.openTickets}</CardTitle>
          <div className="mt-1">
            {summary.openTickets > 0 ? (
              <Badge variant="secondary" className="text-xs">
                {Math.round((summary.openTickets / summary.totalTickets) * 100)}% of total
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">All tickets resolved</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
