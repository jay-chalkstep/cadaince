"use client";

import { useState, useEffect } from "react";
import {
  CalendarDays,
  Target,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  Users,
  Building2,
  ChevronRight,
  RefreshCw,
  Plus,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Quarter {
  id: string;
  year: number;
  quarter: number;
  start_date: string;
  end_date: string;
  planning_status: "upcoming" | "planning" | "active" | "completed" | "reviewed";
  is_current?: boolean;
}

interface Rock {
  id: string;
  title: string;
  description: string | null;
  status: "on_track" | "off_track" | "at_risk" | "complete";
  rock_level: "company" | "pillar" | "individual";
  pillar?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  owner?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

interface Pillar {
  id: string;
  name: string;
  color: string | null;
}

interface QuarterlyPlanningProps {
  onCreateRock?: (level: string, quarterId: string) => void;
  onEditRock?: (rock: Rock) => void;
}

export function QuarterlyPlanning({ onCreateRock, onEditRock }: QuarterlyPlanningProps) {
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [selectedQuarterId, setSelectedQuarterId] = useState<string>("");
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedQuarterId) {
      fetchRocks();
    }
  }, [selectedQuarterId]);

  const fetchInitialData = async () => {
    try {
      const [quartersRes, pillarsRes] = await Promise.all([
        fetch("/api/quarters"),
        fetch("/api/pillars"),
      ]);

      if (quartersRes.ok) {
        const data = await quartersRes.json();
        setQuarters(data);
        // Default to current or most recent quarter
        const currentQuarter = data.find((q: Quarter) => q.is_current);
        if (currentQuarter) {
          setSelectedQuarterId(currentQuarter.id);
        } else if (data.length > 0) {
          setSelectedQuarterId(data[0].id);
        }
      }

      if (pillarsRes.ok) {
        const data = await pillarsRes.json();
        setPillars(data);
      }
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRocks = async () => {
    if (!refreshing) setLoading(true);
    try {
      const res = await fetch(`/api/rocks?quarter_id=${selectedQuarterId}`);
      if (res.ok) {
        const data = await res.json();
        setRocks(data);
      }
    } catch (error) {
      console.error("Failed to fetch rocks:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRocks();
  };

  const formatQuarterLabel = (q: Quarter) => {
    return `Q${q.quarter} ${q.year}`;
  };

  const getStatusIcon = (status: Rock["status"]) => {
    switch (status) {
      case "on_track":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "off_track":
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case "at_risk":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "complete":
        return <CheckCircle2 className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: Rock["status"]) => {
    const variants = {
      on_track: "bg-green-100 text-green-800",
      off_track: "bg-red-100 text-red-800",
      at_risk: "bg-yellow-100 text-yellow-800",
      complete: "bg-gray-100 text-gray-800",
    };
    const labels = {
      on_track: "On Track",
      off_track: "Off Track",
      at_risk: "At Risk",
      complete: "Complete",
    };
    return (
      <Badge className={cn("text-xs", variants[status])}>{labels[status]}</Badge>
    );
  };

  const selectedQuarter = quarters.find((q) => q.id === selectedQuarterId);
  const companyRocks = rocks.filter((r) => r.rock_level === "company");
  const pillarRocks = rocks.filter((r) => r.rock_level === "pillar");
  const individualRocks = rocks.filter((r) => r.rock_level === "individual");

  const totalRocks = rocks.length;
  const onTrackRocks = rocks.filter(
    (r) => r.status === "on_track" || r.status === "complete"
  ).length;
  const healthPercentage = totalRocks > 0 ? Math.round((onTrackRocks / totalRocks) * 100) : 0;

  if (loading && quarters.length === 0) {
    return <QuarterlyPlanningSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-purple-600" />
            <h2 className="text-xl font-semibold">Quarterly Planning</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Set and track quarterly rocks across the organization
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
                  <div className="flex items-center gap-2">
                    {formatQuarterLabel(quarter)}
                    {quarter.is_current && (
                      <Badge variant="secondary" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
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
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Quarter Status */}
      {selectedQuarter && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">
                  {formatQuarterLabel(selectedQuarter)}
                </h3>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span>
                    {new Date(selectedQuarter.start_date).toLocaleDateString()} -{" "}
                    {new Date(selectedQuarter.end_date).toLocaleDateString()}
                  </span>
                  <Badge
                    variant={
                      selectedQuarter.planning_status === "active"
                        ? "default"
                        : "outline"
                    }
                  >
                    {selectedQuarter.planning_status}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{healthPercentage}%</div>
                <p className="text-sm text-muted-foreground">On Track</p>
              </div>
            </div>
            <Progress value={healthPercentage} className="mt-4" />
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-indigo-100">
                <Target className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Company Rocks</p>
                <p className="text-2xl font-semibold">{companyRocks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pillar Rocks</p>
                <p className="text-2xl font-semibold">{pillarRocks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Individual Rocks</p>
                <p className="text-2xl font-semibold">{individualRocks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rocks by Level */}
      <Tabs defaultValue="company" className="space-y-4">
        <TabsList>
          <TabsTrigger value="company" className="gap-2">
            <Target className="h-4 w-4" />
            Company ({companyRocks.length})
          </TabsTrigger>
          <TabsTrigger value="pillar" className="gap-2">
            <Building2 className="h-4 w-4" />
            Pillar ({pillarRocks.length})
          </TabsTrigger>
          <TabsTrigger value="individual" className="gap-2">
            <Users className="h-4 w-4" />
            Individual ({individualRocks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Company Rocks</h3>
            <Button
              size="sm"
              onClick={() => onCreateRock?.("company", selectedQuarterId)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Rock
            </Button>
          </div>
          {companyRocks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium">No Company Rocks</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add company rocks to define strategic priorities for the quarter
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {companyRocks.map((rock) => (
                <RockCard
                  key={rock.id}
                  rock={rock}
                  onClick={() => onEditRock?.(rock)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pillar" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Pillar Rocks</h3>
            <Button
              size="sm"
              onClick={() => onCreateRock?.("pillar", selectedQuarterId)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Rock
            </Button>
          </div>
          {pillarRocks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium">No Pillar Rocks</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add pillar rocks to support company rocks within functional areas
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pillars.map((pillar) => {
                const pillarSpecificRocks = pillarRocks.filter(
                  (r) => r.pillar?.id === pillar.id
                );
                if (pillarSpecificRocks.length === 0) return null;
                return (
                  <div key={pillar.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: pillar.color || "#6366F1" }}
                      />
                      <h4 className="font-medium text-sm">{pillar.name}</h4>
                      <span className="text-xs text-muted-foreground">
                        ({pillarSpecificRocks.length} rocks)
                      </span>
                    </div>
                    <div className="space-y-2 pl-5">
                      {pillarSpecificRocks.map((rock) => (
                        <RockCard
                          key={rock.id}
                          rock={rock}
                          compact
                          onClick={() => onEditRock?.(rock)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="individual" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Individual Rocks</h3>
            <Button
              size="sm"
              onClick={() => onCreateRock?.("individual", selectedQuarterId)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Rock
            </Button>
          </div>
          {individualRocks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium">No Individual Rocks</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add individual rocks for team member personal contributions
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {individualRocks.map((rock) => (
                <RockCard
                  key={rock.id}
                  rock={rock}
                  compact
                  showOwner
                  onClick={() => onEditRock?.(rock)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface RockCardProps {
  rock: Rock;
  compact?: boolean;
  showOwner?: boolean;
  onClick?: () => void;
}

function RockCard({ rock, compact = false, showOwner = false, onClick }: RockCardProps) {
  const getStatusIcon = (status: Rock["status"]) => {
    switch (status) {
      case "on_track":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "off_track":
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case "at_risk":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "complete":
        return <CheckCircle2 className="h-4 w-4 text-gray-500" />;
    }
  };

  if (compact) {
    return (
      <div
        className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={onClick}
      >
        {getStatusIcon(rock.status)}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{rock.title}</p>
          {showOwner && rock.owner && (
            <p className="text-xs text-muted-foreground">{rock.owner.full_name}</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </div>
    );
  }

  return (
    <Card
      className="hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {getStatusIcon(rock.status)}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium">{rock.title}</h4>
            {rock.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {rock.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {rock.owner && (
                <span className="text-xs text-muted-foreground">
                  {rock.owner.full_name}
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

function QuarterlyPlanningSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-12 w-16" />
          </div>
          <Skeleton className="h-2 w-full mt-4" />
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-8" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export { QuarterlyPlanningSkeleton };
