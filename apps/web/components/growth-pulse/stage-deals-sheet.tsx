"use client";

import { useEffect, useState } from "react";
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
import type { DealSummary } from "@/types/growth-pulse";
import { formatCurrency, formatDays } from "@/types/growth-pulse";

interface StageDealsSheetProps {
  stageId: string | null;
  stageLabel: string;
  dealCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StageDealsSheet({
  stageId,
  stageLabel,
  dealCount,
  open,
  onOpenChange,
}: StageDealsSheetProps) {
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && stageId) {
      setLoading(true);
      fetch(`/api/growth-pulse/deals?stage=${stageId}&sort_by=hs_arr&sort_order=desc&limit=100`)
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{stageLabel}</SheetTitle>
          <SheetDescription>
            {dealCount} {dealCount === 1 ? "deal" : "deals"} in this stage
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
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
            <div className="overflow-x-auto -mx-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Deal</TableHead>
                    <TableHead className="text-right">GPV</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right pr-4">Age</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deals.map((deal) => (
                    <TableRow key={deal.hubspotDealId}>
                      <TableCell className="pl-4">
                        <div className="font-medium max-w-[180px] truncate">
                          {deal.dealName || "Unnamed Deal"}
                        </div>
                        {deal.companyName && (
                          <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {deal.companyName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(deal.arr, true)}
                      </TableCell>
                      <TableCell className="max-w-[100px] truncate text-muted-foreground">
                        {deal.ownerName || "—"}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        {deal.daysInPipeline != null ? (
                          <span
                            className={
                              deal.daysInPipeline > 30
                                ? "text-amber-600 font-medium"
                                : ""
                            }
                          >
                            {formatDays(deal.daysInPipeline)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
