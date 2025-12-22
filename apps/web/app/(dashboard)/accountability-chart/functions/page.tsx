"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Pencil, Trash2, Search, EyeOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SeatFunction {
  id: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  is_eos_default: boolean;
  is_custom: boolean;
  is_hidden: boolean;
  sort_order: number;
  assignments: {
    id: string;
    seat_id: string;
    assignment_type: string;
    seat: { id: string; name: string };
  }[];
}

const CATEGORY_OPTIONS = [
  { value: "visionary", label: "Visionary" },
  { value: "integrator", label: "Integrator" },
  { value: "growth", label: "Growth" },
  { value: "customer", label: "Customer" },
  { value: "product", label: "Product" },
  { value: "operations", label: "Operations" },
  { value: "finance", label: "Finance" },
  { value: "other", label: "Other" },
];

const CATEGORY_COLORS: Record<string, string> = {
  visionary: "bg-purple-100 text-purple-700 border-purple-200",
  integrator: "bg-blue-100 text-blue-700 border-blue-200",
  growth: "bg-green-100 text-green-700 border-green-200",
  customer: "bg-yellow-100 text-yellow-700 border-yellow-200",
  product: "bg-pink-100 text-pink-700 border-pink-200",
  operations: "bg-orange-100 text-orange-700 border-orange-200",
  finance: "bg-gray-100 text-gray-700 border-gray-200",
  other: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function FunctionsLibraryPage() {
  const [functions, setFunctions] = useState<SeatFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showHidden, setShowHidden] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFunction, setEditingFunction] = useState<SeatFunction | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [submitting, setSubmitting] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingFunction, setDeletingFunction] = useState<SeatFunction | null>(null);

  useEffect(() => {
    fetchFunctions();
  }, []);

  const fetchFunctions = async () => {
    try {
      const response = await fetch("/api/accountability-chart/functions");
      if (response.ok) {
        const data = await response.json();
        setFunctions(data.functions || []);
      }
    } catch (error) {
      console.error("Failed to fetch functions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingFunction(null);
    setName("");
    setDescription("");
    setCategory("other");
    setDialogOpen(true);
  };

  const handleEdit = (fn: SeatFunction) => {
    setEditingFunction(fn);
    setName(fn.name);
    setDescription(fn.description || "");
    setCategory(fn.category);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      if (editingFunction) {
        // Update existing
        const response = await fetch(
          `/api/accountability-chart/functions/${editingFunction.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name.trim(),
              description: description.trim() || null,
              category,
            }),
          }
        );

        if (response.ok) {
          setDialogOpen(false);
          fetchFunctions();
        }
      } else {
        // Create new
        const response = await fetch("/api/accountability-chart/functions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            category,
          }),
        });

        if (response.ok) {
          setDialogOpen(false);
          fetchFunctions();
        }
      }
    } catch (error) {
      console.error("Failed to save function:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleHidden = async (fn: SeatFunction) => {
    try {
      const response = await fetch(
        `/api/accountability-chart/functions/${fn.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_hidden: !fn.is_hidden }),
        }
      );

      if (response.ok) {
        fetchFunctions();
      }
    } catch (error) {
      console.error("Failed to toggle function visibility:", error);
    }
  };

  const handleDelete = async () => {
    if (!deletingFunction) return;

    try {
      const response = await fetch(
        `/api/accountability-chart/functions/${deletingFunction.id}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setDeleteDialogOpen(false);
        setDeletingFunction(null);
        fetchFunctions();
      }
    } catch (error) {
      console.error("Failed to delete function:", error);
    }
  };

  const confirmDelete = (fn: SeatFunction) => {
    setDeletingFunction(fn);
    setDeleteDialogOpen(true);
  };

  // Filter functions
  const filteredFunctions = functions.filter((fn) => {
    // Hidden filter
    if (!showHidden && fn.is_hidden) return false;

    // Category filter
    if (categoryFilter !== "all" && fn.category !== categoryFilter) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        fn.name.toLowerCase().includes(query) ||
        fn.description?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Group by category
  const groupedFunctions = filteredFunctions.reduce((acc, fn) => {
    const cat = fn.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(fn);
    return acc;
  }, {} as Record<string, SeatFunction[]>);

  const eosFunctions = filteredFunctions.filter((fn) => fn.is_eos_default);
  const customFunctions = filteredFunctions.filter((fn) => fn.is_custom);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Functions Library</h1>
          <p className="text-muted-foreground">
            Manage seat responsibilities and functions
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Custom Function
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search functions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showHidden ? "secondary" : "outline"}
          onClick={() => setShowHidden(!showHidden)}
        >
          {showHidden ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
          {showHidden ? "Showing Hidden" : "Show Hidden"}
        </Button>
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">All ({filteredFunctions.length})</TabsTrigger>
          <TabsTrigger value="eos">EOS Defaults ({eosFunctions.length})</TabsTrigger>
          <TabsTrigger value="custom">Custom ({customFunctions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          {Object.entries(groupedFunctions)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([cat, fns]) => (
              <div key={cat}>
                <h2 className="text-lg font-semibold capitalize mb-3">{cat}</h2>
                <div className="grid gap-3">
                  {fns.map((fn) => (
                    <FunctionCard
                      key={fn.id}
                      fn={fn}
                      onEdit={handleEdit}
                      onDelete={confirmDelete}
                      onToggleHidden={handleToggleHidden}
                    />
                  ))}
                </div>
              </div>
            ))}
          {filteredFunctions.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No functions found
            </p>
          )}
        </TabsContent>

        <TabsContent value="eos" className="space-y-3">
          {eosFunctions.map((fn) => (
            <FunctionCard
              key={fn.id}
              fn={fn}
              onEdit={handleEdit}
              onDelete={confirmDelete}
              onToggleHidden={handleToggleHidden}
            />
          ))}
          {eosFunctions.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No EOS functions found
            </p>
          )}
        </TabsContent>

        <TabsContent value="custom" className="space-y-3">
          {customFunctions.map((fn) => (
            <FunctionCard
              key={fn.id}
              fn={fn}
              onEdit={handleEdit}
              onDelete={confirmDelete}
              onToggleHidden={handleToggleHidden}
            />
          ))}
          {customFunctions.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No custom functions yet. Create one to get started.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFunction ? "Edit Function" : "Create Custom Function"}
            </DialogTitle>
            <DialogDescription>
              {editingFunction
                ? "Update the function details"
                : "Add a new function to your library"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fn-name">Name</Label>
              <Input
                id="fn-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Partner Channel"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fn-description">Description</Label>
              <Textarea
                id="fn-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this function involves..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingFunction ? "Save Changes" : "Create Function"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Function?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingFunction?.name}" and remove it
              from all seats. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FunctionCard({
  fn,
  onEdit,
  onDelete,
  onToggleHidden,
}: {
  fn: SeatFunction;
  onEdit: (fn: SeatFunction) => void;
  onDelete: (fn: SeatFunction) => void;
  onToggleHidden: (fn: SeatFunction) => void;
}) {
  return (
    <Card className={fn.is_hidden ? "opacity-50" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium">{fn.name}</h3>
              <Badge
                variant="outline"
                className={`text-xs ${CATEGORY_COLORS[fn.category] || CATEGORY_COLORS.other}`}
              >
                {fn.category}
              </Badge>
              {fn.is_eos_default && (
                <Badge variant="secondary" className="text-xs">
                  EOS
                </Badge>
              )}
              {fn.is_custom && (
                <Badge variant="outline" className="text-xs">
                  Custom
                </Badge>
              )}
              {fn.is_hidden && (
                <Badge variant="secondary" className="text-xs">
                  Hidden
                </Badge>
              )}
            </div>
            {fn.description && (
              <p className="text-sm text-muted-foreground">{fn.description}</p>
            )}
            {fn.assignments && fn.assignments.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Used by: {fn.assignments.map((a) => a.seat.name).join(", ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleHidden(fn)}
              title={fn.is_hidden ? "Show" : "Hide"}
            >
              {fn.is_hidden ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
            {fn.is_custom && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(fn)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(fn)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
