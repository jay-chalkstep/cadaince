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
import { formatDuration } from "@/types/support-pulse";
import type { OwnerWorkload } from "@/types/support-pulse";

interface OwnerTableProps {
  data: OwnerWorkload[];
  onOwnerClick?: (ownerId: string) => void;
}

export function OwnerTable({ data, onOwnerClick }: OwnerTableProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Owner Workload</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No owner data available
          </div>
        ) : (
          <div className="max-h-[300px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner ID</TableHead>
                  <TableHead className="text-right">Tickets</TableHead>
                  <TableHead className="text-right">Avg Resolution</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.slice(0, 10).map((owner) => (
                  <TableRow
                    key={owner.ownerId}
                    className={onOwnerClick ? "cursor-pointer hover:bg-muted/50" : ""}
                    onClick={() => onOwnerClick?.(owner.ownerId)}
                  >
                    <TableCell className="font-mono text-sm">
                      {owner.ownerId}
                    </TableCell>
                    <TableCell className="text-right">
                      {owner.ticketCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatDuration(owner.avgResolutionMs)}
                    </TableCell>
                    <TableCell className="text-right">
                      {owner.openCount > 0 ? (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          {owner.openCount}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
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
