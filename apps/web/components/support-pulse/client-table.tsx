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
import type { ClientVolume } from "@/types/support-pulse";

interface ClientTableProps {
  data: ClientVolume[];
  onClientClick?: (clientName: string) => void;
}

export function ClientTable({ data, onClientClick }: ClientTableProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Client/Program Volume</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No client data available
          </div>
        ) : (
          <div className="max-h-[300px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead className="text-right">Tickets</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.slice(0, 10).map((client, index) => (
                  <TableRow
                    key={`${client.clientName}-${index}`}
                    className={onClientClick ? "cursor-pointer hover:bg-muted/50" : ""}
                    onClick={() => onClientClick?.(client.clientName)}
                  >
                    <TableCell className="font-medium">
                      {client.clientName}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {client.programName || "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {client.ticketCount}
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
