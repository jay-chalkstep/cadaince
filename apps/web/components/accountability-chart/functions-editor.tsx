"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SeatFunction {
  id: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  is_eos_default: boolean;
  is_custom: boolean;
}

interface FunctionAssignment {
  id: string;
  assignment_type: "primary" | "shared" | "supporting";
  sort_order: number;
  function: SeatFunction;
}

interface FunctionsEditorProps {
  seatId: string;
  assignments: FunctionAssignment[];
  onUpdate: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  visionary: "Visionary",
  integrator: "Integrator",
  growth: "Growth",
  customer: "Customer",
  product: "Product",
  operations: "Operations",
  finance: "Finance",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  visionary: "bg-purple-100 text-purple-700",
  integrator: "bg-blue-100 text-blue-700",
  growth: "bg-green-100 text-green-700",
  customer: "bg-yellow-100 text-yellow-700",
  product: "bg-pink-100 text-pink-700",
  operations: "bg-orange-100 text-orange-700",
  finance: "bg-gray-100 text-gray-700",
  other: "bg-slate-100 text-slate-700",
};

const ASSIGNMENT_TYPE_LABELS: Record<string, string> = {
  primary: "Primary",
  shared: "Shared",
  supporting: "Supporting",
};

export function FunctionsEditor({
  seatId,
  assignments,
  onUpdate,
}: FunctionsEditorProps) {
  const [allFunctions, setAllFunctions] = useState<SeatFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFunction, setSelectedFunction] = useState("");
  const [selectedType, setSelectedType] = useState<"primary" | "shared" | "supporting">("primary");
  const [adding, setAdding] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    fetchFunctions();
  }, []);

  const fetchFunctions = async () => {
    try {
      const response = await fetch("/api/accountability-chart/functions");
      if (response.ok) {
        const data = await response.json();
        setAllFunctions(data.functions || []);
      }
    } catch (error) {
      console.error("Failed to fetch functions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedFunction) return;

    setAdding(true);
    try {
      const response = await fetch(
        `/api/accountability-chart/seats/${seatId}/functions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            function_id: selectedFunction,
            assignment_type: selectedType,
          }),
        }
      );

      if (response.ok) {
        setSelectedFunction("");
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to add function:", error);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (functionId: string) => {
    try {
      const response = await fetch(
        `/api/accountability-chart/seats/${seatId}/functions/${functionId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to remove function:", error);
    }
  };

  const handleUpdateType = async (
    functionId: string,
    newType: "primary" | "shared" | "supporting"
  ) => {
    try {
      const response = await fetch(
        `/api/accountability-chart/seats/${seatId}/functions/${functionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignment_type: newType }),
        }
      );

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to update function type:", error);
    }
  };

  const assignedFunctionIds = assignments.map((a) => a.function.id);
  const availableFunctions = allFunctions.filter(
    (f) => !assignedFunctionIds.includes(f.id)
  );

  const filteredAvailable =
    categoryFilter === "all"
      ? availableFunctions
      : availableFunctions.filter((f) => f.category === categoryFilter);

  const categories = [
    ...new Set(availableFunctions.map((f) => f.category)),
  ].sort();

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Functions / Responsibilities</Label>

      {/* Assigned Functions */}
      <div className="space-y-2">
        {assignments.length > 0 ? (
          assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="flex items-center gap-2 p-2 rounded-lg border bg-muted/50"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {assignment.function.name}
                  </span>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${CATEGORY_COLORS[assignment.function.category] || CATEGORY_COLORS.other}`}
                  >
                    {CATEGORY_LABELS[assignment.function.category] || assignment.function.category}
                  </Badge>
                </div>
                {assignment.function.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {assignment.function.description}
                  </p>
                )}
              </div>
              <Select
                value={assignment.assignment_type}
                onValueChange={(value) =>
                  handleUpdateType(
                    assignment.function.id,
                    value as "primary" | "shared" | "supporting"
                  )
                }
              >
                <SelectTrigger className="w-24 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="shared">Shared</SelectItem>
                  <SelectItem value="supporting">Supporting</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => handleRemove(assignment.function.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No functions assigned</p>
        )}
      </div>

      {/* Add Function */}
      {availableFunctions.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_LABELS[cat] || cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedFunction} onValueChange={setSelectedFunction}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Add function..." />
              </SelectTrigger>
              <SelectContent>
                <ScrollArea className="h-48">
                  {filteredAvailable.map((fn) => (
                    <SelectItem key={fn.id} value={fn.id}>
                      <div className="flex items-center gap-2">
                        <span>{fn.name}</span>
                        {fn.is_custom && (
                          <Badge variant="outline" className="text-[10px] px-1">
                            Custom
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </ScrollArea>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Select
              value={selectedType}
              onValueChange={(v) => setSelectedType(v as "primary" | "shared" | "supporting")}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="shared">Shared</SelectItem>
                <SelectItem value="supporting">Supporting</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!selectedFunction || adding}
              className="flex-1"
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Function
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
