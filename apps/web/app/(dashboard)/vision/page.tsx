"use client";

import { useEffect, useState } from "react";
import {
  Target,
  Compass,
  Rocket,
  Megaphone,
  Calendar,
  TrendingUp,
  CheckCircle,
  Edit2,
  Save,
  X,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useUser } from "@clerk/nextjs";

interface CoreValue {
  value: string;
  description: string;
}

interface OneYearGoal {
  goal: string;
  measurable: string;
  owner_id?: string;
}

interface ThreeYearMeasurable {
  measurable: string;
  target: string;
}

interface VTO {
  id: string | null;
  core_values: CoreValue[];
  purpose: string | null;
  niche: string | null;
  ten_year_target: string | null;
  ten_year_target_date: string | null;
  target_market: string | null;
  three_uniques: string[];
  proven_process: string | null;
  guarantee: string | null;
  three_year_revenue: number | null;
  three_year_profit: number | null;
  three_year_measurables: ThreeYearMeasurable[];
  three_year_description: string | null;
  three_year_target_date: string | null;
  one_year_revenue: number | null;
  one_year_profit: number | null;
  one_year_goals: OneYearGoal[];
  one_year_target_date: string | null;
  updated_at?: string;
  updated_by_profile?: { full_name: string } | null;
}

export default function VisionPage() {
  const [vto, setVto] = useState<VTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<VTO>>({});
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useUser();

  useEffect(() => {
    fetchVTO();
    checkAdminStatus();
  }, []);

  const fetchVTO = async () => {
    try {
      const response = await fetch("/api/vto");
      if (response.ok) {
        const data = await response.json();
        setVto(data);
      }
    } catch (error) {
      console.error("Failed to fetch VTO:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkAdminStatus = async () => {
    try {
      const response = await fetch("/api/users/me");
      if (response.ok) {
        const data = await response.json();
        setIsAdmin(data.access_level === "admin");
      }
    } catch (error) {
      console.error("Failed to check admin status:", error);
    }
  };

  const startEdit = (section: string) => {
    setEditingSection(section);
    setEditData({});
  };

  const cancelEdit = () => {
    setEditingSection(null);
    setEditData({});
  };

  const saveSection = async (section: string, updates: Partial<VTO>) => {
    setSaving(true);
    try {
      const response = await fetch("/api/vto", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, ...updates }),
      });
      if (response.ok) {
        const data = await response.json();
        setVto(data);
        setEditingSection(null);
        setEditData({});
      }
    } catch (error) {
      console.error("Failed to save VTO:", error);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="h-6 w-6 text-indigo-600" />
            <h1 className="text-2xl font-semibold">Vision/Traction Organizer</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            The strategic foundation that guides everything we do.
          </p>
        </div>
        {vto?.updated_at && (
          <p className="text-xs text-muted-foreground">
            Last updated {new Date(vto.updated_at).toLocaleDateString()}{" "}
            {vto.updated_by_profile && `by ${vto.updated_by_profile.full_name}`}
          </p>
        )}
      </div>

      {/* Core Values */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              Core Values
            </CardTitle>
            <CardDescription>The beliefs that define our culture</CardDescription>
          </div>
          {isAdmin && editingSection !== "core_values" && (
            <Button variant="ghost" size="sm" onClick={() => startEdit("core_values")}>
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editingSection === "core_values" ? (
            <div className="space-y-4">
              <Textarea
                placeholder="Enter core values as JSON array"
                defaultValue={JSON.stringify(vto?.core_values || [], null, 2)}
                onChange={(e) => {
                  try {
                    setEditData({ core_values: JSON.parse(e.target.value) });
                  } catch {}
                }}
                rows={8}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => saveSection("core_values", editData)}
                  disabled={saving}
                >
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {vto?.core_values && vto.core_values.length > 0 ? (
                vto.core_values.map((cv, i) => (
                  <div key={i} className="group relative">
                    <Badge
                      variant="secondary"
                      className="px-4 py-2 text-sm font-medium cursor-help"
                    >
                      {cv.value}
                    </Badge>
                    {cv.description && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {cv.description}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No core values defined yet.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Core Focus */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              Core Focus
            </CardTitle>
            <CardDescription>Our purpose and niche</CardDescription>
          </div>
          {isAdmin && editingSection !== "core_focus" && (
            <Button variant="ghost" size="sm" onClick={() => startEdit("core_focus")}>
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editingSection === "core_focus" ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Purpose</label>
                <Textarea
                  placeholder="Why we exist"
                  defaultValue={vto?.purpose || ""}
                  onChange={(e) => setEditData({ ...editData, purpose: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Niche</label>
                <Textarea
                  placeholder="What we do best"
                  defaultValue={vto?.niche || ""}
                  onChange={(e) => setEditData({ ...editData, niche: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => saveSection("core_focus", editData)}
                  disabled={saving}
                >
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Purpose</h4>
                <p className="text-lg">{vto?.purpose || "Not defined"}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Niche</h4>
                <p className="text-lg">{vto?.niche || "Not defined"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 10-Year Target */}
      <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-purple-600" />
              10-Year Target
            </CardTitle>
            <CardDescription>Our big, hairy, audacious goal</CardDescription>
          </div>
          {isAdmin && editingSection !== "ten_year" && (
            <Button variant="ghost" size="sm" onClick={() => startEdit("ten_year")}>
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editingSection === "ten_year" ? (
            <div className="space-y-4">
              <Textarea
                placeholder="The audacious goal we're working toward"
                defaultValue={vto?.ten_year_target || ""}
                onChange={(e) => setEditData({ ...editData, ten_year_target: e.target.value })}
              />
              <Input
                type="date"
                defaultValue={vto?.ten_year_target_date || ""}
                onChange={(e) =>
                  setEditData({ ...editData, ten_year_target_date: e.target.value })
                }
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => saveSection("ten_year", editData)}
                  disabled={saving}
                >
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xl font-medium">{vto?.ten_year_target || "Not defined"}</p>
              {vto?.ten_year_target_date && (
                <p className="text-sm text-muted-foreground mt-2">
                  Target: {formatDate(vto.ten_year_target_date)}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 3-Year Picture */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-green-600" />
                3-Year Picture
              </CardTitle>
              <CardDescription>
                {vto?.three_year_target_date
                  ? `By ${formatDate(vto.three_year_target_date)}`
                  : "Where we'll be in 3 years"}
              </CardDescription>
            </div>
            {isAdmin && editingSection !== "three_year" && (
              <Button variant="ghost" size="sm" onClick={() => startEdit("three_year")}>
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {editingSection === "three_year" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Revenue</label>
                    <Input
                      type="number"
                      placeholder="Revenue target"
                      defaultValue={vto?.three_year_revenue || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          three_year_revenue: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Profit</label>
                    <Input
                      type="number"
                      placeholder="Profit target"
                      defaultValue={vto?.three_year_profit || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          three_year_profit: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="What does it look like?"
                    defaultValue={vto?.three_year_description || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, three_year_description: e.target.value })
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => saveSection("three_year", editData)}
                    disabled={saving}
                  >
                    <Save className="h-4 w-4 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Revenue</h4>
                    <p className="text-2xl font-semibold text-green-600">
                      {formatCurrency(vto?.three_year_revenue || null)}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Profit</h4>
                    <p className="text-2xl font-semibold text-green-600">
                      {formatCurrency(vto?.three_year_profit || null)}
                    </p>
                  </div>
                </div>
                {vto?.three_year_description && (
                  <p className="text-sm text-muted-foreground">{vto.three_year_description}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* 1-Year Plan */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                1-Year Plan
              </CardTitle>
              <CardDescription>
                {vto?.one_year_target_date
                  ? `By ${formatDate(vto.one_year_target_date)}`
                  : "This year's goals"}
              </CardDescription>
            </div>
            {isAdmin && editingSection !== "one_year" && (
              <Button variant="ghost" size="sm" onClick={() => startEdit("one_year")}>
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {editingSection === "one_year" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Revenue</label>
                    <Input
                      type="number"
                      placeholder="Revenue target"
                      defaultValue={vto?.one_year_revenue || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          one_year_revenue: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Profit</label>
                    <Input
                      type="number"
                      placeholder="Profit target"
                      defaultValue={vto?.one_year_profit || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          one_year_profit: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => saveSection("one_year", editData)}
                    disabled={saving}
                  >
                    <Save className="h-4 w-4 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Revenue</h4>
                    <p className="text-2xl font-semibold text-blue-600">
                      {formatCurrency(vto?.one_year_revenue || null)}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Profit</h4>
                    <p className="text-2xl font-semibold text-blue-600">
                      {formatCurrency(vto?.one_year_profit || null)}
                    </p>
                  </div>
                </div>
                {vto?.one_year_goals && vto.one_year_goals.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Goals</h4>
                    <ul className="space-y-1">
                      {vto.one_year_goals.map((goal, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                          <span>{goal.goal}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Marketing Strategy */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-orange-600" />
              Marketing Strategy
            </CardTitle>
            <CardDescription>How we win in the market</CardDescription>
          </div>
          {isAdmin && editingSection !== "marketing" && (
            <Button variant="ghost" size="sm" onClick={() => startEdit("marketing")}>
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editingSection === "marketing" ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Target Market</label>
                <Textarea
                  placeholder="Who we serve"
                  defaultValue={vto?.target_market || ""}
                  onChange={(e) => setEditData({ ...editData, target_market: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Three Uniques (comma separated)</label>
                <Input
                  placeholder="What makes us different"
                  defaultValue={(vto?.three_uniques || []).join(", ")}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      three_uniques: e.target.value.split(",").map((s) => s.trim()),
                    })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Proven Process</label>
                <Textarea
                  placeholder="How we deliver"
                  defaultValue={vto?.proven_process || ""}
                  onChange={(e) => setEditData({ ...editData, proven_process: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Guarantee</label>
                <Textarea
                  placeholder="Our promise"
                  defaultValue={vto?.guarantee || ""}
                  onChange={(e) => setEditData({ ...editData, guarantee: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => saveSection("marketing", editData)}
                  disabled={saving}
                >
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Target Market</h4>
                <p>{vto?.target_market || "Not defined"}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Three Uniques</h4>
                {vto?.three_uniques && vto.three_uniques.length > 0 ? (
                  <ul className="space-y-1">
                    {vto.three_uniques.map((unique, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="text-orange-600">•</span>
                        {unique}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Not defined</p>
                )}
              </div>
              {vto?.proven_process && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Proven Process</h4>
                  <p>{vto.proven_process}</p>
                </div>
              )}
              {vto?.guarantee && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Guarantee</h4>
                  <p>{vto.guarantee}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
