"use client";

import { useEffect, useState } from "react";
import {
  Sun,
  Sparkles,
  AlertCircle,
  TrendingUp,
  Lightbulb,
  Calendar,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface BriefingContent {
  greeting: string;
  summary: string;
  highlights: string[];
  attention_needed: string[];
  opportunities: string[];
  meeting_prep: string | null;
}

interface Briefing {
  id?: string;
  profile_id: string;
  briefing_date: string;
  content: BriefingContent;
  generated_at: string;
  viewed_at?: string;
  is_cached?: boolean;
  is_fallback?: boolean;
}

export default function BriefingPage() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const fetchBriefing = async (regenerate = false) => {
    if (regenerate) {
      setRegenerating(true);
    } else {
      setLoading(true);
    }

    try {
      const url = regenerate ? "/api/briefings?regenerate=true" : "/api/briefings";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setBriefing(data);
      }
    } catch (error) {
      console.error("Failed to fetch briefing:", error);
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, []);

  const getTimeOfDayGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="md:col-span-2">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const content = briefing?.content;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sun className="h-6 w-6 text-yellow-500" />
            <h1 className="text-2xl font-semibold">
              {content?.greeting || `${getTimeOfDayGreeting()}!`}
            </h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Here&apos;s what needs your attention today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{today}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchBriefing(true)}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {briefing?.is_fallback && (
        <Card className="border-yellow-500 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">
                AI briefings require an ANTHROPIC_API_KEY. Add it to your environment to enable personalized briefings.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Today&apos;s Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground leading-relaxed">
            {content?.summary || "Your personalized briefing will appear here once generated."}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Highlights */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Highlights
            </CardTitle>
          </CardHeader>
          <CardContent>
            {content?.highlights && content.highlights.length > 0 ? (
              <ul className="space-y-2">
                {content.highlights.map((highlight, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">•</span>
                    <span className="text-sm">{highlight}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No highlights to report.</p>
            )}
          </CardContent>
        </Card>

        {/* Attention Needed */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            {content?.attention_needed && content.attention_needed.length > 0 ? (
              <ul className="space-y-2">
                {content.attention_needed.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-red-600 mt-1">•</span>
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing urgent at the moment.</p>
            )}
          </CardContent>
        </Card>

        {/* Opportunities */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="h-5 w-5 text-yellow-600" />
              Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            {content?.opportunities && content.opportunities.length > 0 ? (
              <ul className="space-y-2">
                {content.opportunities.map((opp, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-yellow-600 mt-1">•</span>
                    <span className="text-sm">{opp}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No specific opportunities identified.</p>
            )}
          </CardContent>
        </Card>

        {/* Meeting Prep */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-purple-600" />
              Meeting Prep
            </CardTitle>
          </CardHeader>
          <CardContent>
            {content?.meeting_prep ? (
              <p className="text-sm">{content.meeting_prep}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No meetings scheduled for today.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      {briefing && !briefing.is_fallback && (
        <p className="text-xs text-muted-foreground text-center">
          {briefing.is_cached ? "Cached briefing from earlier today" : "Freshly generated"} •{" "}
          {new Date(briefing.generated_at).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
