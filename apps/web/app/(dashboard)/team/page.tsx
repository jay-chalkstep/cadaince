"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Mail,
  Building2,
  Shield,
  MoreVertical,
  Search,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InviteTeamMemberDialog } from "@/components/team/invite-team-member-dialog";
import { TeamMemberDetailSheet } from "@/components/team/team-member-detail-sheet";

interface Pillar {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface TeamMember {
  id: string;
  clerk_id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  title: string | null;
  role: string;
  access_level: string;
  pillar_id: string | null;
  pillar: Pillar | null;
  is_pillar_lead: boolean;
  status: string;
  receives_briefing: boolean;
}

export default function TeamPage() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPillar, setFilterPillar] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [isAdmin, setIsAdmin] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  useEffect(() => {
    fetchData();
    checkAdminStatus();
  }, []);

  const fetchData = async () => {
    try {
      const [teamRes, pillarsRes] = await Promise.all([
        fetch("/api/team"),
        fetch("/api/pillars"),
      ]);

      if (teamRes.ok) {
        const data = await teamRes.json();
        setTeamMembers(data);
      }

      if (pillarsRes.ok) {
        const data = await pillarsRes.json();
        setPillars(data);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
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

  const handleInviteSuccess = () => {
    fetchData();
  };

  const handleMemberUpdate = () => {
    fetchData();
    setSelectedMember(null);
  };

  const filteredMembers = teamMembers.filter((member) => {
    const matchesSearch =
      member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.title?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesPillar =
      filterPillar === "all" || member.pillar_id === filterPillar;

    const matchesStatus =
      filterStatus === "all" || member.status === filterStatus;

    return matchesSearch && matchesPillar && matchesStatus;
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAccessLevelBadge = (level: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      admin: "destructive",
      elt: "default",
      slt: "secondary",
      consumer: "outline",
    };
    return (
      <Badge variant={variants[level] || "outline"} className="text-xs">
        {level.toUpperCase()}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    if (status === "active") {
      return <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge>;
    }
    if (status === "invited") {
      return <Badge className="bg-yellow-100 text-yellow-800 text-xs">Invited</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Inactive</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Group members by pillar for summary
  const membersByPillar = pillars.map((pillar) => ({
    ...pillar,
    members: teamMembers.filter(
      (m) => m.pillar_id === pillar.id && m.status === "active"
    ),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-600" />
            <h1 className="text-2xl font-semibold">Team</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            {teamMembers.filter((m) => m.status === "active").length} active members across{" "}
            {pillars.length} pillars
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Pillar Summary */}
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
        {membersByPillar.map((pillar) => (
          <Card
            key={pillar.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setFilterPillar(pillar.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: pillar.color || "#6366F1" }}
                />
                <span className="text-sm font-medium truncate">{pillar.name}</span>
              </div>
              <p className="text-2xl font-semibold">{pillar.members.length}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterPillar} onValueChange={setFilterPillar}>
          <SelectTrigger className="w-40">
            <Building2 className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Pillars" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pillars</SelectItem>
            {pillars.map((pillar) => (
              <SelectItem key={pillar.id} value={pillar.id}>
                {pillar.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Team Members Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredMembers.map((member) => (
          <Card
            key={member.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedMember(member)}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={member.avatar_url || undefined} />
                  <AvatarFallback
                    style={{
                      backgroundColor: member.pillar?.color || "#6366F1",
                      color: "white",
                    }}
                  >
                    {getInitials(member.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{member.full_name}</h3>
                    {member.is_pillar_lead && (
                      <Shield className="h-4 w-4 text-indigo-600" title="Pillar Lead" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {member.title || member.role}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {getAccessLevelBadge(member.access_level)}
                    {getStatusBadge(member.status)}
                  </div>
                  {member.pillar && (
                    <div className="flex items-center gap-1 mt-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: member.pillar.color }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {member.pillar.name}
                      </span>
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMember(member);
                        }}
                      >
                        View Details
                      </DropdownMenuItem>
                      {member.status === "invited" && (
                        <DropdownMenuItem>
                          <Mail className="h-4 w-4 mr-2" />
                          Resend Invite
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {member.status !== "inactive" && (
                        <DropdownMenuItem className="text-red-600">
                          Deactivate
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredMembers.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No team members found</h3>
          <p className="text-muted-foreground">
            {searchQuery || filterPillar !== "all" || filterStatus !== "all"
              ? "Try adjusting your filters"
              : "Get started by inviting your first team member"}
          </p>
        </div>
      )}

      {/* Dialogs and Sheets */}
      <InviteTeamMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        pillars={pillars}
        onSuccess={handleInviteSuccess}
      />

      <TeamMemberDetailSheet
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
        onUpdate={handleMemberUpdate}
        isAdmin={isAdmin}
        pillars={pillars}
      />
    </div>
  );
}
