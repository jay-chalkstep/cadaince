"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Calendar, Rocket, MessageSquare } from "lucide-react";
import type { GrowthPulseMetrics } from "@/types/growth-pulse";
import { formatCurrency } from "@/types/growth-pulse";

interface SummaryCardsProps {
  metrics: GrowthPulseMetrics;
}

export function SummaryCards({ metrics }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Open Pipeline */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Open Pipeline
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(metrics.totalPipelineArr, true)}</div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(metrics.totalPipelineGp, true)} GP · {metrics.openDeals} deals
          </p>
        </CardContent>
      </Card>

      {/* Closing in 30 Days */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Closing in 30 Days
          </CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(metrics.closingNext30DaysGpv, true)}</div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(metrics.closingNext30DaysGp, true)} GP · {metrics.closingNext30DaysCount} deals
          </p>
        </CardContent>
      </Card>

      {/* Launching in 30 Days */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Launching in 30 Days
          </CardTitle>
          <Rocket className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(metrics.launchingNext30DaysGpv, true)}</div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(metrics.launchingNext30DaysGp, true)} GP · {metrics.launchingNext30DaysCount} deals
          </p>
        </CardContent>
      </Card>

      {/* Total Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Activity
          </CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalNumNotes.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">notes across pipeline</p>
        </CardContent>
      </Card>
    </div>
  );
}
