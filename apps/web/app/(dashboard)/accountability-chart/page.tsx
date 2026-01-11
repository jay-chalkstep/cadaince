"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateSeatDialog } from "@/components/accountability-chart/create-seat-dialog";
import { SeatDetailSheet } from "@/components/accountability-chart/seat-detail-sheet";
import { ChartCanvas } from "@/components/accountability-chart/chart-canvas";
import type { Seat } from "@/components/accountability-chart/types";

export default function AccountabilityChartPage() {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [flatSeats, setFlatSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [parentSeatId, setParentSeatId] = useState<string | null>(null);

  const fetchChart = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchChart();
  }, [fetchChart]);

  const handleSeatClick = useCallback((seat: Seat) => {
    setSelectedSeat(seat);
    setSheetOpen(true);
  }, []);

  const handleAddChild = useCallback((seat: Seat) => {
    setParentSeatId(seat.id);
    setDialogOpen(true);
  }, []);

  const handleAddRoot = useCallback(() => {
    setParentSeatId(null);
    setDialogOpen(true);
  }, []);

  const handleReparent = useCallback(
    async (seatId: string, newParentId: string | null) => {
      try {
        const response = await fetch(`/api/accountability-chart/seats/${seatId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parent_seat_id: newParentId }),
        });

        if (response.ok) {
          // Refresh the chart to reflect the new hierarchy
          await fetchChart();
        } else {
          const data = await response.json();
          console.error("Failed to reparent seat:", data.error);
        }
      } catch (error) {
        console.error("Failed to reparent seat:", error);
      }
    },
    [fetchChart]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
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

      {/* Chart Area */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="flex flex-col items-center gap-8 pt-16">
            <Skeleton className="h-32 w-64" />
            <div className="flex gap-8">
              <Skeleton className="h-32 w-64" />
              <Skeleton className="h-32 w-64" />
            </div>
          </div>
        ) : seats.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Card className="max-w-md">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No seats defined</p>
                <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                  Build your accountability chart by defining seats (roles) and assigning team
                  members. Start with leadership positions like Visionary and Integrator.
                </p>
                <Button onClick={handleAddRoot}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Seat
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <ChartCanvas
            seats={seats}
            onSeatClick={handleSeatClick}
            onAddChild={handleAddChild}
            onReparent={handleReparent}
          />
        )}
      </div>

      {/* Dialogs */}
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
