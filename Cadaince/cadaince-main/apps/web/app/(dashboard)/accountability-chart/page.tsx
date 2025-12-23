"use client";

import { useEffect, useState } from "react";
import { Plus, GitBranch, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { SeatCard } from "@/components/accountability-chart/seat-card";
import { CreateSeatDialog } from "@/components/accountability-chart/create-seat-dialog";
import { SeatDetailSheet } from "@/components/accountability-chart/seat-detail-sheet";

interface Assignment {
  id: string;
  is_primary: boolean;
  team_member: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    email: string;
    title: string | null;
  };
}

interface Seat {
  id: string;
  name: string;
  parent_seat_id: string | null;
  pillar_id: string | null;
  pillar: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  roles: string[];
  gets_it: boolean;
  wants_it: boolean;
  capacity_to_do: boolean;
  core_values_match: boolean;
  color: string | null;
  assignments: Assignment[];
  children: Seat[];
}

export default function AccountabilityChartPage() {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [flatSeats, setFlatSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [parentSeatId, setParentSeatId] = useState<string | null>(null);

  const fetchChart = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/accountability-chart");
      if (response.ok) {
        const data = await response.json();
        setSeats(data.seats || []);
        setFlatSeats(data.flatSeats || []);
      }
    } catch (error) {
      console.error("Failed to fetch accountability chart:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChart();
  }, []);

  const handleSeatClick = (seat: Seat) => {
    setSelectedSeat(seat);
    setSheetOpen(true);
  };

  const handleAddChild = (parentId: string) => {
    setParentSeatId(parentId);
    setDialogOpen(true);
  };

  const handleAddRoot = () => {
    setParentSeatId(null);
    setDialogOpen(true);
  };

  const renderSeatTree = (seat: Seat, depth: number = 0) => {
    return (
      <div key={seat.id} className="relative">
        {/* Connector line */}
        {depth > 0 && (
          <div
            className="absolute left-1/2 -top-6 w-0.5 h-6 bg-border"
            style={{ transform: "translateX(-50%)" }}
          />
        )}

        <SeatCard
          seat={seat}
          onClick={() => handleSeatClick(seat)}
          onAddChild={() => handleAddChild(seat.id)}
        />

        {/* Children */}
        {seat.children && seat.children.length > 0 && (
          <div className="mt-6 relative">
            {/* Horizontal connector line */}
            {seat.children.length > 1 && (
              <div
                className="absolute top-0 h-0.5 bg-border"
                style={{
                  left: `${100 / (seat.children.length * 2)}%`,
                  right: `${100 / (seat.children.length * 2)}%`,
                }}
              />
            )}
            <div className="flex justify-center gap-8">
              {seat.children.map((child) => (
                <div key={child.id} className="relative pt-6">
                  {renderSeatTree(child, depth + 1)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Accountability Chart</h1>
          <p className="text-sm text-muted-foreground">
            Define seats and assign team members to roles
          </p>
        </div>
        <Button onClick={handleAddRoot}>
          <Plus className="mr-2 h-4 w-4" />
          Add Seat
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-8 pt-8">
          <Skeleton className="h-32 w-64" />
          <div className="flex gap-8">
            <Skeleton className="h-32 w-64" />
            <Skeleton className="h-32 w-64" />
          </div>
        </div>
      ) : seats.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No seats defined</p>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
              Build your accountability chart by defining seats (roles) and assigning team members.
              Start with leadership positions like Visionary and Integrator.
            </p>
            <Button onClick={handleAddRoot}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Seat
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto pb-8">
          <div className="min-w-max flex flex-col items-center gap-6 pt-4">
            {seats.map((seat) => renderSeatTree(seat))}
          </div>
        </div>
      )}

      <CreateSeatDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setParentSeatId(null);
        }}
        onCreated={fetchChart}
        parentSeatId={parentSeatId}
        existingSeats={flatSeats}
      />

      <SeatDetailSheet
        seat={selectedSeat}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdate={fetchChart}
        existingSeats={flatSeats}
      />
    </div>
  );
}
