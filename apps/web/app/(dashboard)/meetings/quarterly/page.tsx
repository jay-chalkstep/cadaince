"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuarterlyPlanning } from "@/components/meetings/quarterly-planning";
import { RockForm } from "@/components/rocks/rock-form";

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

export default function QuarterlyPlanningPage() {
  const router = useRouter();
  const [showRockDialog, setShowRockDialog] = useState(false);
  const [selectedRock, setSelectedRock] = useState<Rock | null>(null);
  const [defaultRockLevel, setDefaultRockLevel] = useState<string>("company");
  const [defaultQuarterId, setDefaultQuarterId] = useState<string>("");

  const handleCreateRock = (level: string, quarterId: string) => {
    setDefaultRockLevel(level);
    setDefaultQuarterId(quarterId);
    setSelectedRock(null);
    setShowRockDialog(true);
  };

  const handleEditRock = (rock: Rock) => {
    setSelectedRock(rock);
    setShowRockDialog(true);
  };

  const handleSaveRock = async (data: {
    title: string;
    description: string;
    rock_level: string;
    status: string;
    owner_id: string;
    pillar_id: string;
    parent_rock_id: string;
    quarter_id: string;
    due_date: string;
  }) => {
    const url = selectedRock ? `/api/rocks/${selectedRock.id}` : "/api/rocks";
    const method = selectedRock ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.title,
        description: data.description || null,
        rock_level: data.rock_level,
        status: data.status,
        owner_id: data.owner_id,
        pillar_id: data.pillar_id || null,
        parent_rock_id: data.parent_rock_id || null,
        quarter_id: data.quarter_id,
        due_date: data.due_date || null,
      }),
    });

    if (response.ok) {
      setShowRockDialog(false);
      setSelectedRock(null);
      // Refresh the page to show updated data
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/meetings">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Quarterly Planning</h1>
          <p className="text-sm text-muted-foreground">
            Set and track quarterly rocks across the organization
          </p>
        </div>
      </div>

      {/* Quarterly Planning Component */}
      <QuarterlyPlanning
        onCreateRock={handleCreateRock}
        onEditRock={handleEditRock}
      />

      {/* Rock Create/Edit Dialog */}
      <Dialog open={showRockDialog} onOpenChange={setShowRockDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedRock ? "Edit Rock" : "Create Rock"}
            </DialogTitle>
            <DialogDescription>
              {selectedRock
                ? "Update the rock details below"
                : "Add a new rock to the quarterly plan"}
            </DialogDescription>
          </DialogHeader>
          <RockForm
            initialData={
              selectedRock
                ? {
                    id: selectedRock.id,
                    title: selectedRock.title,
                    description: selectedRock.description || "",
                    rock_level: selectedRock.rock_level,
                    status: selectedRock.status,
                    owner_id: selectedRock.owner?.id || "",
                    pillar_id: selectedRock.pillar?.id || "",
                    parent_rock_id: "",
                    quarter_id: defaultQuarterId,
                    due_date: "",
                  }
                : {
                    rock_level: defaultRockLevel as "company" | "pillar" | "individual",
                    quarter_id: defaultQuarterId,
                  }
            }
            onSubmit={handleSaveRock}
            onCancel={() => setShowRockDialog(false)}
            isEditing={!!selectedRock}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
