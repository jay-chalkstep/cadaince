"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, Target, Activity, Users } from "lucide-react";
import type { GrowthPulseMetrics } from "@/types/growth-pulse";
import { formatCurrency, formatDays } from "@/types/growth-pulse";

export type VelocityDays = 7 | 10 | 30 | 90;

interface SummaryCardsProps {
  metrics: GrowthPulseMetrics;
  velocityDays: VelocityDays;
  onVelocityDaysChange: (days: VelocityDays) => void;
}

export function SummaryCards({ metrics, velocityDays, onVelocityDaysChange }: SummaryCardsProps) {
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
          <p className="text-xs text-muted-foreground">{metrics.openDeals} open deals</p>
        </CardContent>
      </Card>

      {/* Pipeline Velocity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Pipeline Velocity
          </CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.stageChanges}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>stage changes in</span>
            <Select
              value={velocityDays.toString()}
              onValueChange={(value) => onVelocityDaysChange(parseInt(value) as VelocityDays)}
            >
              <SelectTrigger className="h-5 w-[70px] text-xs border-0 p-0 pl-1 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="10">10 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Avg Deal Size */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Avg Deal Size
          </CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(metrics.avgDealSize, true)}</div>
          <p className="text-xs text-muted-foreground">{formatDays(metrics.avgDealAgeDays)} avg age</p>
        </CardContent>
      </Card>

      {/* Active Sellers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Active Sellers
          </CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.sellerCount}</div>
          <p className="text-xs text-muted-foreground">with open pipeline</p>
        </CardContent>
      </Card>
    </div>
  );
}
