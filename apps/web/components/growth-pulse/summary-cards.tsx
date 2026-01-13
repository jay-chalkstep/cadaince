"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Target, TrendingUp, Users } from "lucide-react";
import type { GrowthPulseMetrics } from "@/types/growth-pulse";
import { formatCurrency, formatDays } from "@/types/growth-pulse";

interface SummaryCardsProps {
  metrics: GrowthPulseMetrics;
}

export function SummaryCards({ metrics }: SummaryCardsProps) {
  const cards = [
    {
      title: "Open Pipeline",
      value: formatCurrency(metrics.totalPipelineArr, true),
      subtitle: `${metrics.openDeals} open deals`,
      icon: DollarSign,
    },
    {
      title: "Closed Won QTD",
      value: formatCurrency(metrics.closedWonQtdArr, true),
      subtitle: `${metrics.closedWonQtdCount} deals`,
      icon: TrendingUp,
    },
    {
      title: "Avg Deal Size",
      value: formatCurrency(metrics.avgDealSize, true),
      subtitle: formatDays(metrics.avgDealAgeDays) + " avg age",
      icon: Target,
    },
    {
      title: "Active Sellers",
      value: metrics.sellerCount.toString(),
      subtitle: "with open pipeline",
      icon: Users,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
