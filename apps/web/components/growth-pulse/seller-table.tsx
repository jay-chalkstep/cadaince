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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { SellerSummary, OrgBenchmarks } from "@/types/growth-pulse";
import { formatCurrency } from "@/types/growth-pulse";

interface SellerTableProps {
  sellers: SellerSummary[];
  benchmarks: OrgBenchmarks;
}

export function SellerTable({ sellers, benchmarks }: SellerTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Seller Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {sellers.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            No sellers with pipeline data
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seller</TableHead>
                  <TableHead className="text-right">Open Pipeline</TableHead>
                  <TableHead className="text-right">Deals</TableHead>
                  <TableHead className="text-right">Closed Won QTD</TableHead>
                  <TableHead className="w-[140px]">vs Team Avg</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellers.map((seller) => {
                  const vsAvg = benchmarks.avgOpenPipeline > 0
                    ? ((seller.openPipelineArr - benchmarks.avgOpenPipeline) / benchmarks.avgOpenPipeline) * 100
                    : 0;
                  const initials = getInitials(seller.ownerName);

                  return (
                    <TableRow key={seller.ownerId} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{seller.ownerName}</div>
                            {seller.ownerEmail && (
                              <div className="text-xs text-muted-foreground">
                                {seller.ownerEmail}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(seller.openPipelineArr, true)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="font-normal">
                          {seller.openDealCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">
                          {formatCurrency(seller.closedWonQtdArr, true)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {seller.closedWonQtdCount} deals
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.min(Math.max(50 + vsAvg / 2, 0), 100)}
                            className="h-2 w-16"
                          />
                          <span
                            className={`text-xs font-medium ${
                              vsAvg >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {vsAvg >= 0 ? "+" : ""}
                            {vsAvg.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/growth-pulse/${seller.ownerId}`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Get initials from name
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
