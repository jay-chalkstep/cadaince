"use client";

import { useEffect, useState } from "react";
import { SellerHeader } from "./seller-header";
import { SellerBenchmarkBars } from "./seller-benchmark-bars";
import { SellerStageChart } from "./seller-stage-chart";
import { TopDealsTable } from "./top-deals-table";
import { RecentActivities } from "./recent-activities";
import { SellerDetailSkeleton } from "./seller-detail-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, DollarSign, Target, TrendingUp, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SellerDetail as SellerDetailType } from "@/types/growth-pulse";
import { formatCurrency, formatDays } from "@/types/growth-pulse";

interface SellerDetailProps {
  ownerId: string;
}

export function SellerDetail({ ownerId }: SellerDetailProps) {
  const [seller, setSeller] = useState<SellerDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSeller = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/growth-pulse/seller/${ownerId}`);

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to fetch seller details");
        }

        const data = await res.json();
        setSeller(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchSeller();
  }, [ownerId]);

  if (loading) {
    return <SellerDetailSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!seller) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Seller not found</AlertDescription>
      </Alert>
    );
  }

  const summaryCards = [
    {
      title: "Open Pipeline",
      value: formatCurrency(seller.openPipelineArr, true),
      subtitle: `${seller.openDealCount} deals`,
      icon: DollarSign,
    },
    {
      title: "Avg Deal Size",
      value: formatCurrency(seller.avgDealSize, true),
      subtitle: "across open deals",
      icon: Target,
    },
    {
      title: "Avg Days in Stage",
      value: formatDays(seller.avgDaysInCurrentStage),
      subtitle: "current stage",
      icon: BarChart3,
    },
    {
      title: "Activities (30d)",
      value: seller.activityCount.toString(),
      subtitle: "calls, emails, meetings",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <SellerHeader seller={seller} />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
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

      {/* Benchmark Comparison */}
      <SellerBenchmarkBars seller={seller} benchmarks={seller.benchmarks} />

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <SellerStageChart data={seller.stageBreakdown} />
        <RecentActivities activities={seller.recentActivities} />
      </div>

      {/* Top Deals Table */}
      <TopDealsTable deals={seller.topDeals} />
    </div>
  );
}
