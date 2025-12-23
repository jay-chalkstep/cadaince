"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Save,
  Plus,
  Trash2,
  GripVertical,
  Target,
  Heart,
  Rocket,
  Calendar,
  TrendingUp,
  Megaphone,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

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
}

interface VTOHistory {
  id: string;
  changed_by: string;
  changed_at: string;
  change_type: string;
  section: string;
  changed_by_profile?: { full_name: string };
}

export default function VTOSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [vto, setVto] = useState<VTO | null>(null);
  const [history, setHistory] = useState<VTOHistory[]>([]);
  const [activeTab, setActiveTab] = useState("foundation");

  // Form state
  const [coreValues, setCoreValues] = useState<CoreValue[]>([]);
  const [purpose, setPurpose] = useState("");
  const [niche, setNiche] = useState("");
  const [tenYearTarget, setTenYearTarget] = useState("");
  const [tenYearTargetDate, setTenYearTargetDate] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [threeUniques, setThreeUniques] = useState<string[]>(["", "", ""]);
  const [provenProcess, setProvenProcess] = useState("");
  const [guarantee, setGuarantee] = useState("");
  const [threeYearRevenue, setThreeYearRevenue] = useState("");
  const [threeYearProfit, setThreeYearProfit] = useState("");
  const [threeYearMeasurables, setThreeYearMeasurables] = useState<ThreeYearMeasurable[]>([]);
  const [threeYearDescription, setThreeYearDescription] = useState("");
  const [threeYearTargetDate, setThreeYearTargetDate] = useState("");
  const [oneYearRevenue, setOneYearRevenue] = useState("");
  const [oneYearProfit, setOneYearProfit] = useState("");
  const [oneYearGoals, setOneYearGoals] = useState<OneYearGoal[]>([]);
  const [oneYearTargetDate, setOneYearTargetDate] = useState("");

  useEffect(() => {
    checkAdminAndFetchData();
  }, []);

  const checkAdminAndFetchData = async () => {
    try {
      // Check admin status
      const meRes = await fetch("/api/users/me");
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.access_level !== "admin") {
          router.push("/vision");
          return;
        }
        setIsAdmin(true);
      } else {
        router.push("/vision");
        return;
      }

      // Fetch VTO
      const vtoRes = await fetch("/api/vto");
      if (vtoRes.ok) {
        const vtoData = await vtoRes.json();
        setVto(vtoData);
        populateForm(vtoData);
      }

      // Fetch history
      const historyRes = await fetch("/api/vto/history");
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData);
      }
    } catch (error) {
      console.error("Failed to load VTO data:", error);
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (data: VTO) => {
    setCoreValues(data.core_values?.length > 0 ? data.core_values : [{ value: "", description: "" }]);
    setPurpose(data.purpose || "");
    setNiche(data.niche || "");
    setTenYearTarget(data.ten_year_target || "");
    setTenYearTargetDate(data.ten_year_target_date || "");
    setTargetMarket(data.target_market || "");
    setThreeUniques(data.three_uniques?.length === 3 ? data.three_uniques : ["", "", ""]);
    setProvenProcess(data.proven_process || "");
    setGuarantee(data.guarantee || "");
    setThreeYearRevenue(data.three_year_revenue?.toString() || "");
    setThreeYearProfit(data.three_year_profit?.toString() || "");
    setThreeYearMeasurables(data.three_year_measurables?.length > 0 ? data.three_year_measurables : []);
    setThreeYearDescription(data.three_year_description || "");
    setThreeYearTargetDate(data.three_year_target_date || "");
    setOneYearRevenue(data.one_year_revenue?.toString() || "");
    setOneYearProfit(data.one_year_profit?.toString() || "");
    setOneYearGoals(data.one_year_goals?.length > 0 ? data.one_year_goals : []);
    setOneYearTargetDate(data.one_year_target_date || "");
  };

  const handleSave = async (section: string) => {
    setSaving(true);
    try {
      let updates: Partial<VTO> = {};

      switch (section) {
        case "core_values":
          updates = { core_values: coreValues.filter(cv => cv.value.trim()) };
          break;
        case "core_focus":
          updates = { purpose, niche };
          break;
        case "ten_year":
          updates = {
            ten_year_target: tenYearTarget,
            ten_year_target_date: tenYearTargetDate || null,
          };
          break;
        case "marketing":
          updates = {
            target_market: targetMarket,
            three_uniques: threeUniques.filter(u => u.trim()),
            proven_process: provenProcess,
            guarantee,
          };
          break;
        case "three_year":
          updates = {
            three_year_revenue: threeYearRevenue ? parseFloat(threeYearRevenue) : null,
            three_year_profit: threeYearProfit ? parseFloat(threeYearProfit) : null,
            three_year_measurables: threeYearMeasurables.filter(m => m.measurable.trim()),
            three_year_description: threeYearDescription,
            three_year_target_date: threeYearTargetDate || null,
          };
          break;
        case "one_year":
          updates = {
            one_year_revenue: oneYearRevenue ? parseFloat(oneYearRevenue) : null,
            one_year_profit: oneYearProfit ? parseFloat(oneYearProfit) : null,
            one_year_goals: oneYearGoals.filter(g => g.goal.trim()),
            one_year_target_date: oneYearTargetDate || null,
          };
          break;
      }

      const response = await fetch("/api/vto", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, ...updates }),
      });

      if (response.ok) {
        const updatedVto = await response.json();
        setVto(updatedVto);
        // Refresh history
        const historyRes = await fetch("/api/vto/history");
        if (historyRes.ok) {
          setHistory(await historyRes.json());
        }
      }
    } catch (error) {
      console.error("Failed to save VTO:", error);
    } finally {
      setSaving(false);
    }
  };

  // Array helpers
  const addCoreValue = () => setCoreValues([...coreValues, { value: "", description: "" }]);
  const removeCoreValue = (index: number) => setCoreValues(coreValues.filter((_, i) => i !== index));
  const updateCoreValue = (index: number, field: keyof CoreValue, value: string) => {
    const updated = [...coreValues];
    updated[index] = { ...updated[index], [field]: value };
    setCoreValues(updated);
  };

  const addThreeYearMeasurable = () => setThreeYearMeasurables([...threeYearMeasurables, { measurable: "", target: "" }]);
  const removeThreeYearMeasurable = (index: number) => setThreeYearMeasurables(threeYearMeasurables.filter((_, i) => i !== index));
  const updateThreeYearMeasurable = (index: number, field: keyof ThreeYearMeasurable, value: string) => {
    const updated = [...threeYearMeasurables];
    updated[index] = { ...updated[index], [field]: value };
    setThreeYearMeasurables(updated);
  };

  const addOneYearGoal = () => setOneYearGoals([...oneYearGoals, { goal: "", measurable: "" }]);
  const removeOneYearGoal = (index: number) => setOneYearGoals(oneYearGoals.filter((_, i) => i !== index));
  const updateOneYearGoal = (index: number, field: keyof OneYearGoal, value: string) => {
    const updated = [...oneYearGoals];
    updated[index] = { ...updated[index], [field]: value };
    setOneYearGoals(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/vision")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">V/TO Settings</h1>
          <p className="text-muted-foreground">
            Manage your Vision/Traction Organizer
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="foundation">Foundation</TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Foundation Tab */}
        <TabsContent value="foundation" className="space-y-6">
          {/* Core Values */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-red-500" />
                    Core Values
                  </CardTitle>
                  <CardDescription>The 3-5 beliefs that define your culture</CardDescription>
                </div>
                <Button onClick={() => handleSave("core_values")} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {coreValues.map((cv, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="pt-2 text-muted-foreground cursor-move">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div className="flex-1 grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Value</Label>
                      <Input
                        value={cv.value}
                        onChange={(e) => updateCoreValue(index, "value", e.target.value)}
                        placeholder="e.g., Integrity"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={cv.description}
                        onChange={(e) => updateCoreValue(index, "description", e.target.value)}
                        placeholder="What it means to your team"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeCoreValue(index)}
                    disabled={coreValues.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addCoreValue} disabled={coreValues.length >= 7}>
                <Plus className="h-4 w-4 mr-2" />
                Add Core Value
              </Button>
            </CardContent>
          </Card>

          {/* Core Focus */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    Core Focus
                  </CardTitle>
                  <CardDescription>Your purpose (why you exist) and niche (what you do best)</CardDescription>
                </div>
                <Button onClick={() => handleSave("core_focus")} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Purpose/Cause/Passion</Label>
                <Textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Why does your organization exist beyond making money?"
                  rows={3}
                />
              </div>
              <div>
                <Label>Niche</Label>
                <Textarea
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="What do you do better than anyone else?"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* 10-Year Target */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Rocket className="h-5 w-5 text-purple-600" />
                    10-Year Target
                  </CardTitle>
                  <CardDescription>Your BHAG (Big Hairy Audacious Goal)</CardDescription>
                </div>
                <Button onClick={() => handleSave("ten_year")} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>10-Year Target</Label>
                <Textarea
                  value={tenYearTarget}
                  onChange={(e) => setTenYearTarget(e.target.value)}
                  placeholder="What massive goal will you achieve in 10 years?"
                  rows={3}
                />
              </div>
              <div>
                <Label>Target Date</Label>
                <Input
                  type="date"
                  value={tenYearTargetDate}
                  onChange={(e) => setTenYearTargetDate(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Strategy Tab */}
        <TabsContent value="strategy" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-orange-600" />
                    Marketing Strategy
                  </CardTitle>
                  <CardDescription>How you differentiate and win in the market</CardDescription>
                </div>
                <Button onClick={() => handleSave("marketing")} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Target Market</Label>
                <Textarea
                  value={targetMarket}
                  onChange={(e) => setTargetMarket(e.target.value)}
                  placeholder="Who is your ideal customer?"
                  rows={3}
                />
              </div>

              <Separator />

              <div>
                <Label>Three Uniques</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  What three things make you uniquely better than competitors?
                </p>
                <div className="space-y-3">
                  {threeUniques.map((unique, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Badge variant="secondary" className="w-6 h-6 rounded-full flex items-center justify-center text-xs">
                        {index + 1}
                      </Badge>
                      <Input
                        value={unique}
                        onChange={(e) => {
                          const updated = [...threeUniques];
                          updated[index] = e.target.value;
                          setThreeUniques(updated);
                        }}
                        placeholder={`Unique #${index + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <Label>Proven Process</Label>
                <Textarea
                  value={provenProcess}
                  onChange={(e) => setProvenProcess(e.target.value)}
                  placeholder="What's your documented process that delivers results?"
                  rows={3}
                />
              </div>

              <div>
                <Label>Guarantee</Label>
                <Textarea
                  value={guarantee}
                  onChange={(e) => setGuarantee(e.target.value)}
                  placeholder="What do you guarantee to your customers?"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans" className="space-y-6">
          {/* 3-Year Picture */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-green-600" />
                    3-Year Picture
                  </CardTitle>
                  <CardDescription>What does success look like in 3 years?</CardDescription>
                </div>
                <Button onClick={() => handleSave("three_year")} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>Revenue Target</Label>
                  <Input
                    type="number"
                    value={threeYearRevenue}
                    onChange={(e) => setThreeYearRevenue(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Profit Target</Label>
                  <Input
                    type="number"
                    value={threeYearProfit}
                    onChange={(e) => setThreeYearProfit(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Target Date</Label>
                  <Input
                    type="date"
                    value={threeYearTargetDate}
                    onChange={(e) => setThreeYearTargetDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={threeYearDescription}
                  onChange={(e) => setThreeYearDescription(e.target.value)}
                  placeholder="Paint the picture - what does your organization look like?"
                  rows={4}
                />
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Key Measurables</Label>
                  <Button variant="outline" size="sm" onClick={addThreeYearMeasurable}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Measurable
                  </Button>
                </div>
                <div className="space-y-3">
                  {threeYearMeasurables.map((m, index) => (
                    <div key={index} className="flex gap-3 items-start">
                      <div className="flex-1 grid gap-3 sm:grid-cols-2">
                        <Input
                          value={m.measurable}
                          onChange={(e) => updateThreeYearMeasurable(index, "measurable", e.target.value)}
                          placeholder="Measurable (e.g., # of employees)"
                        />
                        <Input
                          value={m.target}
                          onChange={(e) => updateThreeYearMeasurable(index, "target", e.target.value)}
                          placeholder="Target (e.g., 50)"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeThreeYearMeasurable(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {threeYearMeasurables.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No measurables added yet
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 1-Year Plan */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    1-Year Plan
                  </CardTitle>
                  <CardDescription>Your annual goals and targets</CardDescription>
                </div>
                <Button onClick={() => handleSave("one_year")} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>Revenue Target</Label>
                  <Input
                    type="number"
                    value={oneYearRevenue}
                    onChange={(e) => setOneYearRevenue(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Profit Target</Label>
                  <Input
                    type="number"
                    value={oneYearProfit}
                    onChange={(e) => setOneYearProfit(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Target Date</Label>
                  <Input
                    type="date"
                    value={oneYearTargetDate}
                    onChange={(e) => setOneYearTargetDate(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>1-Year Goals</Label>
                  <Button variant="outline" size="sm" onClick={addOneYearGoal}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Goal
                  </Button>
                </div>
                <div className="space-y-3">
                  {oneYearGoals.map((g, index) => (
                    <div key={index} className="flex gap-3 items-start">
                      <div className="flex-1 grid gap-3 sm:grid-cols-2">
                        <Input
                          value={g.goal}
                          onChange={(e) => updateOneYearGoal(index, "goal", e.target.value)}
                          placeholder="Goal"
                        />
                        <Input
                          value={g.measurable}
                          onChange={(e) => updateOneYearGoal(index, "measurable", e.target.value)}
                          placeholder="How you'll measure success"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeOneYearGoal(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {oneYearGoals.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No goals added yet
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Change History
              </CardTitle>
              <CardDescription>Audit trail of V/TO changes</CardDescription>
            </CardHeader>
            <CardContent>
              {history.length > 0 ? (
                <div className="space-y-4">
                  {history.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-4 pb-4 border-b last:border-0">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{entry.section || entry.change_type}</Badge>
                          <span className="text-sm text-muted-foreground">
                            by {entry.changed_by_profile?.full_name || "Unknown"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(entry.changed_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No change history available
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
