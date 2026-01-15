"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { DealSummary } from "@/types/growth-pulse";
import { formatCurrency } from "@/types/growth-pulse";

interface StageDealsSheetProps {
  stageId: string | null;
  stageLabel: string;
  dealCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SortField = "dealName" | "gpv" | "ownerName";
type SortOrder = "asc" | "desc";

export function StageDealsSheet({
  stageId,
  stageLabel,
  dealCount,
  open,
  onOpenChange,
}: StageDealsSheetProps) {
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState<SortField>("gpv");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    if (open && stageId) {
      setLoading(true);
      fetch(`/api/growth-pulse/deals?stage=${stageId}&limit=100`)
        .then((res) => res.json())
        .then((data) => {
          setDeals(data.deals || []);
        })
        .catch((err) => {
          console.error("Failed to fetch deals:", err);
          setDeals([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, stageId]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "dealName" || field === "ownerName" ? "asc" : "desc");
    }
  }, [sortField, sortOrder]);

  const sortedDeals = [...deals].sort((a, b) => {
    let aVal: string | number | null;
    let bVal: string | number | null;

    switch (sortField) {
      case "dealName":
        aVal = a.dealName?.toLowerCase() || "";
        bVal = b.dealName?.toLowerCase() || "";
        break;
      case "gpv":
        aVal = a.gpv || 0;
        bVal = b.gpv || 0;
        break;
      case "ownerName":
        aVal = a.ownerName?.toLowerCase() || "";
        bVal = b.ownerName?.toLowerCase() || "";
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
    if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    }
    return sortOrder === "asc"
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto px-6">
        <SheetHeader className="px-2">
          <SheetTitle>{stageLabel}</SheetTitle>
          <SheetDescription>
            {dealCount} {dealCount === 1 ? "deal" : "deals"} in this stage
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 px-2">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : deals.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              No deals in this stage
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSort("dealName")}
                  >
                    <div className="flex items-center">
                      Deal
                      <SortIcon field="dealName" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSort("gpv")}
                  >
                    <div className="flex items-center justify-end">
                      GPV
                      <SortIcon field="gpv" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSort("ownerName")}
                  >
                    <div className="flex items-center">
                      Owner
                      <SortIcon field="ownerName" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDeals.map((deal) => (
                  <TableRow key={deal.hubspotDealId}>
                    <TableCell>
                      <div className="font-medium max-w-[220px] truncate">
                        {deal.dealName || "Unnamed Deal"}
                      </div>
                      {deal.companyName && (
                        <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {deal.companyName}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {deal.gpv ? formatCurrency(deal.gpv, true) : "—"}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-muted-foreground">
                      {deal.ownerName || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
