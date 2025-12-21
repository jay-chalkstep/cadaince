"use client";

import { useState, useEffect } from "react";
import {
  Target,
  Building2,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CompanyRockCard, CompanyRockCardSkeleton } from "./company-rock-card";

interface Analytics {
  pillar_rock_count: number;
  pillar_rocks_on_track: number;
  pillar_rocks_off_track: number;
  pillar_rocks_at_risk: number;
  pillar_rocks_complete: number;
  individual_rock_count: number;
  individual_rocks_on_track: number;
  individual_rocks_off_track: number;
  individual_rocks_at_risk: number;
  individual_rocks_complete: number;
  team_members_with_rocks: number;
  team_coverage_percentage: number;
  pillars_involved: number;
  overall_on_track_percentage: number;
}

interface PillarRock {
  id: string;
  title: string;
  status: string;
  pillar: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  individual_rocks: Array<{
    id: string;
    title: string;
    status: string;
    owner: {
      id: string;
      full_name: string;
      avatar_url: string | null;
    } | null;
  }>;
}

interface CompanyRock {
  id: string;
  title: string;
  description: string | null;
  status: "on_track" | "off_track" | "at_risk" | "complete";
  due_date: string;
  owner: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    title?: string | null;
  } | null;
  quarter: {
    id: string;
    year: number;
    quarter: number;
  } | null;
  analytics: Analytics;
  pillar_rocks?: PillarRock[];
}

interface Summary {
  total_company_rocks: number;
  total_pillar_rocks: number;
  total_individual_rocks: number;
  total_rocks: number;
  on_track: number;
  off_track: number;
  at_risk: number;
  complete: number;
  overall_on_track_percentage: number;
  team_size: number;
  team_members_with_rocks: number;
}

interface Quarter {
  id: string;
  year: number;
  quarter: number;
  is_current?: boolean;
}

interface CascadeAnalyticsProps {
  onRockClick?: (rock: CompanyRock) => void;
}

export function CascadeAnalytics({ onRockClick }: CascadeAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [companyRocks, setCompanyRocks] = useState<CompanyRock[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [selectedQuarterId, setSelectedQuarterId] = useState<string>("");

  useEffect(() => {
    fetchQuarters();
  }, []);

  useEffect(() => {
    if (selectedQuarterId || quarters.length === 0) {
      fetchAnalytics();
    }
  }, [selectedQuarterId]);

  const fetchQuarters = async () => {
    try {
      const res = await fetch("/api/quarters");
      if (res.ok) {
        const data = await res.json();
        setQuarters(data);
        // Set default to current quarter
        const currentQuarter = data.find((q: Quarter) => q.is_current);
        if (currentQuarter) {
          setSelectedQuarterId(currentQuarter.id);
        } else if (data.length > 0) {
          setSelectedQuarterId(data[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch quarters:", error);
    }
  };

  const fetchAnalytics = async () => {
    if (!refreshing) setLoading(true);
    try {
      let url = "/api/rocks/analytics";
      if (selectedQuarterId) {
        url += `?quarter_id=${selectedQuarterId}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCompanyRocks(data.company_rocks || []);
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const formatQuarterLabel = (q: Quarter) => {
    return `Q${q.quarter} ${q.year}${q.is_current ? " (Current)" : ""}`;
  };

  if (loading) {
    return <CascadeAnalyticsSkeleton />;
  }

  const selectedQuarter = quarters.find((q) => q.id === selectedQuarterId);

  return (
    <div className="space-y-6">
      {/* Header with Quarter Filter */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-6 w-6 text-indigo-600" />
            <h2 className="text-xl font-semibold">Rock Cascade</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Strategic alignment from company to individual rocks
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedQuarterId} onValueChange={setSelectedQuarterId}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Select quarter" />
            </SelectTrigger>
            <SelectContent>
              {quarters.map((quarter) => (
                <SelectItem key={quarter.id} value={quarter.id}>
                  {formatQuarterLabel(quarter)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn("h-4 w-4", refreshing && "animate-spin")}
            />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Rocks */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Rocks</CardDescription>
              <CardTitle className="text-3xl">{summary.total_rocks}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Target className="h-4 w-4 text-indigo-600" />
                  <span>{summary.total_company_rocks} Company</span>
                </div>
                <div className="flex items-center gap-1">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span>{summary.total_pillar_rocks} Pillar</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-green-600" />
                  <span>{summary.total_individual_rocks} Individual</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Overall Health */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Overall Health</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                {summary.overall_on_track_percentage}%
                {summary.overall_on_track_percentage >= 70 ? (
                  <TrendingUp className="h-6 w-6 text-green-600" />
                ) : summary.overall_on_track_percentage >= 50 ? (
                  <AlertTriangle className="h-6 w-6 text-yellow-600" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-red-600" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress
                value={summary.overall_on_track_percentage}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                On Track or Complete
              </p>
            </CardContent>
          </Card>

          {/* Status Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Status Breakdown</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">On Track</span>
                </div>
                <Badge className="bg-green-100 text-green-800">
                  {summary.on_track}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm">At Risk</span>
                </div>
                <Badge className="bg-yellow-100 text-yellow-800">
                  {summary.at_risk}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-sm">Off Track</span>
                </div>
                <Badge className="bg-red-100 text-red-800">
                  {summary.off_track}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">Complete</span>
                </div>
                <Badge variant="secondary">{summary.complete}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Team Coverage */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Team Coverage</CardDescription>
              <CardTitle className="text-3xl">
                {summary.team_members_with_rocks}/{summary.team_size}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress
                value={
                  summary.team_size > 0
                    ? (summary.team_members_with_rocks / summary.team_size) * 100
                    : 0
                }
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Team members with individual rocks
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Company Rocks List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Company Rocks</h3>
          {selectedQuarter && (
            <Badge variant="outline">
              {formatQuarterLabel(selectedQuarter)}
            </Badge>
          )}
        </div>

        {companyRocks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Company Rocks</h3>
              <p className="text-muted-foreground text-center max-w-md mt-1">
                {selectedQuarter
                  ? `No company rocks found for ${formatQuarterLabel(selectedQuarter)}. Create company rocks to start building your cascade.`
                  : "Select a quarter to view company rocks and their cascade analytics."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {companyRocks.map((rock) => (
              <CompanyRockCard
                key={rock.id}
                rock={rock}
                onClick={() => onRockClick?.(rock)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CascadeAnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-3 w-32 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Company Rocks */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid gap-4 md:grid-cols-2">
          <CompanyRockCardSkeleton />
          <CompanyRockCardSkeleton />
        </div>
      </div>
    </div>
  );
}

export { CascadeAnalyticsSkeleton };
