"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Calendar,
  Clock,
  Users,
  Target,
  AlertCircle,
  ChevronLeft,
  Plus,
  Play,
  Settings,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MeetingScheduleEditor } from "@/components/meetings/meeting-schedule-editor";

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  title: string | null;
  email: string;
}

interface Pillar {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  description: string | null;
}

interface Rock {
  id: string;
  title: string;
  description: string | null;
  status: "on_track" | "off_track" | "at_risk" | "complete";
  rock_level: string;
  owner: Profile | null;
}

interface Issue {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  created_at: string;
  raised_by: Profile | null;
}

interface Meeting {
  id: string;
  title: string;
  scheduled_at: string;
  status: string;
}

interface PillarMember {
  id: string;
  team_member_id: string;
  is_primary: boolean;
  is_lead: boolean;
  profile: Profile;
}

export default function PillarL10Page() {
  const params = useParams();
  const router = useRouter();
  const pillarId = params.pillarId as string;

  const [pillar, setPillar] = useState<Pillar | null>(null);
  const [members, setMembers] = useState<PillarMember[]>([]);
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [schedulingMeeting, setSchedulingMeeting] = useState(false);
  const [newMeetingDate, setNewMeetingDate] = useState("");
  const [newMeetingTime, setNewMeetingTime] = useState("09:00");

  useEffect(() => {
    if (pillarId) {
      fetchData();
    }
  }, [pillarId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pillarRes, rocksRes, issuesRes] = await Promise.all([
        fetch(`/api/pillars/${pillarId}`),
        fetch(`/api/rocks?pillar_id=${pillarId}`),
        fetch(`/api/issues?pillar_id=${pillarId}`),
      ]);

      if (pillarRes.ok) {
        const data = await pillarRes.json();
        setPillar(data);
        setMembers(data.members || []);
      }
      if (rocksRes.ok) {
        const data = await rocksRes.json();
        setRocks(data);
      }
      if (issuesRes.ok) {
        const data = await issuesRes.json();
        setIssues(data);
      }
    } catch (error) {
      console.error("Failed to fetch pillar data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleMeeting = async () => {
    if (!newMeetingDate || !newMeetingTime) return;

    setSchedulingMeeting(true);
    try {
      const scheduledAt = new Date(`${newMeetingDate}T${newMeetingTime}`);

      const response = await fetch("/api/l10", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${pillar?.name} L10`,
          meeting_type: "pillar",
          scheduled_at: scheduledAt.toISOString(),
          pillar_id: pillarId,
        }),
      });

      if (response.ok) {
        const meeting = await response.json();
        setShowScheduleDialog(false);
        setNewMeetingDate("");
        setNewMeetingTime("09:00");
        // Optionally navigate to the meeting
        router.push(`/l10/${meeting.id}`);
      }
    } catch (error) {
      console.error("Failed to schedule meeting:", error);
    } finally {
      setSchedulingMeeting(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusColor = (status: Rock["status"]) => {
    switch (status) {
      case "on_track":
        return "bg-green-100 text-green-800";
      case "off_track":
        return "bg-red-100 text-red-800";
      case "at_risk":
        return "bg-yellow-100 text-yellow-800";
      case "complete":
        return "bg-gray-100 text-gray-800";
    }
  };

  const pillarRocks = rocks.filter((r) => r.rock_level === "pillar");
  const individualRocks = rocks.filter((r) => r.rock_level === "individual");
  const lead = members.find((m) => m.is_lead);

  const rocksOnTrack = rocks.filter(
    (r) => r.status === "on_track" || r.status === "complete"
  ).length;
  const rocksTotal = rocks.length;
  const healthPercentage = rocksTotal > 0 ? Math.round((rocksOnTrack / rocksTotal) * 100) : 100;

  if (loading) {
    return <PillarL10PageSkeleton />;
  }

  if (!pillar) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium">Pillar not found</h2>
          <p className="text-muted-foreground">
            The requested pillar does not exist or you don&apos;t have access.
          </p>
          <Link href="/meetings">
            <Button className="mt-4">Back to Meetings</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/meetings">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: pillar.color || "#6366F1" }}
          />
          <div>
            <h1 className="text-2xl font-semibold">{pillar.name} L10</h1>
            <p className="text-sm text-muted-foreground">
              {lead ? `Led by ${lead.profile.full_name}` : "No lead assigned"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowScheduleDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Schedule Meeting
          </Button>
          {meetings.length > 0 && meetings[0].status === "scheduled" && (
            <Link href={`/l10/${meetings[0].id}`}>
              <Button>
                <Play className="h-4 w-4 mr-1" />
                Start L10
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Team Size</p>
                <p className="text-xl font-semibold">{members.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Active Rocks</p>
                <p className="text-xl font-semibold">{rocks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm text-muted-foreground">Open Issues</p>
                <p className="text-xl font-semibold">{issues.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Health</p>
                <p className="text-xl font-semibold">{healthPercentage}%</p>
              </div>
              <Progress value={healthPercentage} className="w-16" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="rocks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rocks" className="gap-2">
            <Target className="h-4 w-4" />
            Rocks ({rocks.length})
          </TabsTrigger>
          <TabsTrigger value="issues" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            Issues ({issues.length})
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team ({members.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rocks" className="space-y-6">
          {/* Pillar Rocks */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Pillar Rocks</h3>
              <Link href="/rocks">
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Rock
                </Button>
              </Link>
            </div>
            {pillarRocks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No pillar rocks for this quarter
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {pillarRocks.map((rock) => (
                  <Card key={rock.id} className="hover:shadow-md transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{rock.title}</h4>
                          {rock.owner && (
                            <p className="text-sm text-muted-foreground">
                              {rock.owner.full_name}
                            </p>
                          )}
                        </div>
                        <Badge className={getStatusColor(rock.status)}>
                          {rock.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Individual Rocks */}
          <div className="space-y-4">
            <h3 className="font-medium">Individual Rocks</h3>
            {individualRocks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No individual rocks in this pillar
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {individualRocks.map((rock) => (
                  <Card key={rock.id} className="hover:shadow-md transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {rock.owner && (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={rock.owner.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(rock.owner.full_name)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{rock.title}</h4>
                          {rock.owner && (
                            <p className="text-xs text-muted-foreground">
                              {rock.owner.full_name}
                            </p>
                          )}
                        </div>
                        <Badge className={getStatusColor(rock.status)} variant="secondary">
                          {rock.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          {issues.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium">No Open Issues</h3>
                <p className="text-muted-foreground">
                  Issues from this pillar will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {issues.map((issue) => (
                <Card key={issue.id} className="hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{issue.title}</h4>
                        {issue.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {issue.description}
                          </p>
                        )}
                        {issue.raised_by && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Raised by {issue.raised_by.full_name}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline">{issue.priority}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          {members.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium">No Team Members</h3>
                <p className="text-muted-foreground">
                  Assign team members to this pillar
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {members.map((member) => (
                <Card key={member.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.profile.avatar_url || undefined} />
                        <AvatarFallback>
                          {getInitials(member.profile.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">
                          {member.profile.full_name}
                        </h4>
                        <p className="text-sm text-muted-foreground truncate">
                          {member.profile.title || member.profile.email}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        {member.is_lead && (
                          <Badge className="text-xs">Lead</Badge>
                        )}
                        {member.is_primary && (
                          <Badge variant="secondary" className="text-xs">
                            Primary
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Schedule Meeting Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule {pillar.name} L10</DialogTitle>
            <DialogDescription>
              Schedule a pillar L10 meeting for your team
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={newMeetingDate}
                onChange={(e) => setNewMeetingDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={newMeetingTime}
                onChange={(e) => setNewMeetingTime(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleScheduleMeeting}
              disabled={!newMeetingDate || schedulingMeeting}
            >
              {schedulingMeeting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Schedule Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PillarL10PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="w-4 h-4 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-5" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-8" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <Skeleton className="h-10 w-80" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
