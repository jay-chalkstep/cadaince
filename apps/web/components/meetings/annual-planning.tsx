"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CalendarRange,
  Target,
  Eye,
  Compass,
  TrendingUp,
  Mountain,
  Flag,
  ChevronRight,
  RefreshCw,
  Edit,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface VTO {
  id: string;
  organization_id: string;
  year: number;
  core_values: string[];
  core_focus_purpose: string | null;
  core_focus_niche: string | null;
  ten_year_target: string | null;
  marketing_strategy: {
    target_market?: string;
    uniques?: string[];
    proven_process?: string;
    guarantee?: string;
  } | null;
  three_year_picture: {
    revenue?: string;
    profit?: string;
    measurables?: string[];
    what_does_it_look_like?: string;
  } | null;
  one_year_plan: {
    revenue?: string;
    profit?: string;
    goals?: string[];
  } | null;
}

interface Quarter {
  id: string;
  year: number;
  quarter: number;
  planning_status: string;
}

interface Rock {
  id: string;
  title: string;
  status: "on_track" | "off_track" | "at_risk" | "complete";
  rock_level: "company" | "pillar" | "individual";
}

interface AnnualPlanningProps {
  onEditVTO?: () => void;
  onScheduleAnnual?: () => void;
}

export function AnnualPlanning({ onEditVTO, onScheduleAnnual }: AnnualPlanningProps) {
  const [vto, setVto] = useState<VTO | null>(null);
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [companyRocks, setCompanyRocks] = useState<Rock[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!refreshing) setLoading(true);
    try {
      const [vtoRes, quartersRes, rocksRes] = await Promise.all([
        fetch("/api/vto"),
        fetch("/api/quarters"),
        fetch("/api/rocks?level=company"),
      ]);

      if (vtoRes.ok) {
        const data = await vtoRes.json();
        setVto(data);
      }
      if (quartersRes.ok) {
        const data = await quartersRes.json();
        setQuarters(data);
      }
      if (rocksRes.ok) {
        const data = await rocksRes.json();
        setCompanyRocks(data);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const currentYear = new Date().getFullYear();
  const currentYearQuarters = quarters.filter((q) => q.year === currentYear);
  const quarterlyProgress = currentYearQuarters.length > 0
    ? Math.round((currentYearQuarters.filter(q => q.planning_status === "completed" || q.planning_status === "reviewed").length / 4) * 100)
    : 0;

  if (loading) {
    return <AnnualPlanningSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarRange className="h-6 w-6 text-orange-600" />
            <h2 className="text-xl font-semibold">Annual Planning</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Vision, strategy, and long-term planning
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
          <Button onClick={onScheduleAnnual}>
            Schedule Annual Planning
          </Button>
        </div>
      </div>

      {/* V/TO Quick View */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Core Values & Focus */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Compass className="h-5 w-5 text-orange-600" />
                Core Values & Focus
              </CardTitle>
              <Link href="/settings/vto">
                <Button variant="ghost" size="sm">
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {vto?.core_values && vto.core_values.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Core Values</p>
                <div className="flex flex-wrap gap-2">
                  {vto.core_values.map((value, i) => (
                    <Badge key={i} variant="secondary">
                      {value}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No core values defined</p>
            )}

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Core Focus</p>
              {vto?.core_focus_purpose ? (
                <div>
                  <p className="text-xs text-muted-foreground">Purpose</p>
                  <p className="text-sm">{vto.core_focus_purpose}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No purpose defined</p>
              )}
              {vto?.core_focus_niche && (
                <div>
                  <p className="text-xs text-muted-foreground">Niche</p>
                  <p className="text-sm">{vto.core_focus_niche}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 10-Year Target */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Mountain className="h-5 w-5 text-purple-600" />
              10-Year Target
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vto?.ten_year_target ? (
              <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg">
                <p className="text-lg font-medium">{vto.ten_year_target}</p>
              </div>
            ) : (
              <div className="p-4 border-2 border-dashed rounded-lg text-center text-muted-foreground">
                <Mountain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No 10-year target defined</p>
                <Link href="/settings/vto">
                  <Button variant="link" size="sm" className="mt-2">
                    Set Target
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3-Year Picture & 1-Year Plan */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 3-Year Picture */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              3-Year Picture
            </CardTitle>
            <CardDescription>
              Where we&apos;ll be in 3 years
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {vto?.three_year_picture ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {vto.three_year_picture.revenue && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Revenue</p>
                      <p className="text-lg font-semibold text-green-700">
                        {vto.three_year_picture.revenue}
                      </p>
                    </div>
                  )}
                  {vto.three_year_picture.profit && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Profit</p>
                      <p className="text-lg font-semibold text-blue-700">
                        {vto.three_year_picture.profit}
                      </p>
                    </div>
                  )}
                </div>
                {vto.three_year_picture.measurables &&
                  vto.three_year_picture.measurables.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Key Measurables</p>
                      <ul className="space-y-1">
                        {vto.three_year_picture.measurables.map((m, i) => (
                          <li key={i} className="text-sm flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </>
            ) : (
              <div className="p-4 border-2 border-dashed rounded-lg text-center text-muted-foreground">
                <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No 3-year picture defined</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 1-Year Plan */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Flag className="h-5 w-5 text-green-600" />
              1-Year Plan
            </CardTitle>
            <CardDescription>
              This year&apos;s focus and goals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {vto?.one_year_plan ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {vto.one_year_plan.revenue && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Revenue Goal</p>
                      <p className="text-lg font-semibold text-green-700">
                        {vto.one_year_plan.revenue}
                      </p>
                    </div>
                  )}
                  {vto.one_year_plan.profit && (
                    <div className="p-3 bg-emerald-50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Profit Goal</p>
                      <p className="text-lg font-semibold text-emerald-700">
                        {vto.one_year_plan.profit}
                      </p>
                    </div>
                  )}
                </div>
                {vto.one_year_plan.goals && vto.one_year_plan.goals.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Annual Goals</p>
                    <ul className="space-y-1">
                      {vto.one_year_plan.goals.map((g, i) => (
                        <li key={i} className="text-sm flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 border-2 border-dashed rounded-lg text-center text-muted-foreground">
                <Flag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No 1-year plan defined</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Year Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {currentYear} Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Quarters Completed</span>
            <span className="font-medium">{quarterlyProgress}%</span>
          </div>
          <Progress value={quarterlyProgress} />

          <div className="grid grid-cols-4 gap-4 pt-4">
            {[1, 2, 3, 4].map((q) => {
              const quarter = currentYearQuarters.find((cq) => cq.quarter === q);
              const isActive = quarter?.planning_status === "active";
              const isCompleted =
                quarter?.planning_status === "completed" ||
                quarter?.planning_status === "reviewed";

              return (
                <Link key={q} href="/meetings/quarterly">
                  <Card
                    className={cn(
                      "hover:shadow-md transition-all cursor-pointer",
                      isActive && "border-primary",
                      isCompleted && "bg-muted"
                    )}
                  >
                    <CardContent className="p-4 text-center">
                      <p className="text-lg font-semibold">Q{q}</p>
                      <Badge
                        variant={isActive ? "default" : isCompleted ? "secondary" : "outline"}
                        className="mt-1"
                      >
                        {quarter?.planning_status || "upcoming"}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Company Rocks This Year */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              Company Rocks ({currentYear})
            </CardTitle>
            <Link href="/meetings/quarterly">
              <Button variant="ghost" size="sm">
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {companyRocks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No company rocks for this year</p>
            </div>
          ) : (
            <div className="space-y-2">
              {companyRocks.slice(0, 5).map((rock) => (
                <div
                  key={rock.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <span className="font-medium truncate">{rock.title}</span>
                  <Badge
                    className={cn(
                      "text-xs",
                      rock.status === "on_track" && "bg-green-100 text-green-800",
                      rock.status === "off_track" && "bg-red-100 text-red-800",
                      rock.status === "at_risk" && "bg-yellow-100 text-yellow-800",
                      rock.status === "complete" && "bg-gray-100 text-gray-800"
                    )}
                  >
                    {rock.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AnnualPlanningSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-48" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-6 w-20" />
              ))}
            </div>
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-6 w-36" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export { AnnualPlanningSkeleton };
