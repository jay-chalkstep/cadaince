"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { DealSummary } from "@/types/growth-pulse";
import { formatCurrency, formatDays, getStageColor } from "@/types/growth-pulse";

interface TopDealsTableProps {
  deals: DealSummary[];
}

export function TopDealsTable({ deals }: TopDealsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Top Deals by ARR</CardTitle>
      </CardHeader>
      <CardContent>
        {deals.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            No open deals
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal</TableHead>
                  <TableHead className="text-right">ARR</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead className="text-right">Age</TableHead>
                  <TableHead className="text-right">Close Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((deal) => (
                  <TableRow key={deal.hubspotDealId}>
                    <TableCell>
                      <div className="font-medium max-w-[200px] truncate">
                        {deal.dealName}
                      </div>
                      {deal.offering && (
                        <div className="text-xs text-muted-foreground">
                          {deal.offering}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(deal.arr, true)}
                    </TableCell>
                    <TableCell>
                      {deal.stage && (
                        <Badge
                          variant="secondary"
                          style={{
                            backgroundColor: `${getStageColor(deal.stage)}20`,
                            color: getStageColor(deal.stage),
                          }}
                        >
                          {formatStageName(deal.stage)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {deal.companyName || "—"}
                    </TableCell>
                    <TableCell className="text-right">
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
                    <TableCell className="text-right text-muted-foreground">
                      {deal.closeDate
                        ? new Date(deal.closeDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatStageName(stage: string): string {
  const stageNames: Record<string, string> = {
    appointmentscheduled: "Scheduled",
    qualifiedtobuy: "Qualified",
    presentationscheduled: "Demo",
    decisionmakerboughtin: "Decision",
    contractsent: "Contract",
    closedwon: "Won",
    closedlost: "Lost",
  };

  const normalized = stage.toLowerCase().replace(/[^a-z]/g, "");
  return stageNames[normalized] || stage;
}
