"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { formatDuration } from "@/types/support-pulse";
import { format, parseISO } from "date-fns";
import type {
  TicketListItem,
  TicketsListResponse,
  SupportPulseFilters,
  TimeFrameDays,
} from "@/types/support-pulse";

interface TicketListProps {
  filters: SupportPulseFilters;
  days: TimeFrameDays;
  customRange: { start: Date; end: Date } | null;
  onClose: () => void;
}

export function TicketList({ filters, days, customRange, onClose }: TicketListProps) {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 25;

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (days !== "custom") {
        params.set("days", String(days));
      } else if (customRange) {
        params.set("start_date", customRange.start.toISOString());
        params.set("end_date", customRange.end.toISOString());
      }

      params.set("page", String(page));
      params.set("limit", String(limit));

      if (search) {
        params.set("search", search);
      }

      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          const paramKey = key === "ownerId" ? "owner_id" : key === "clientName" ? "client_name" : key;
          params.set(paramKey, value);
        }
      });

      const res = await fetch(`/api/support/tickets?${params}`);
      if (res.ok) {
        const data: TicketsListResponse = await res.json();
        setTickets(data.tickets);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Failed to fetch tickets:", error);
    } finally {
      setLoading(false);
    }
  }, [days, customRange, page, search, filters]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const totalPages = Math.ceil(total / limit);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            Tickets ({total})
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Input
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No tickets found
          </div>
        ) : (
          <>
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Resolution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <>
                      <TableRow
                        key={ticket.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleExpand(ticket.id)}
                      >
                        <TableCell>
                          {expandedId === ticket.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-medium">
                          {ticket.subject || "No subject"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {ticket.category || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {ticket.source || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={ticket.status === "open" ? "default" : "secondary"}
                            className={
                              ticket.status === "open"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                            }
                          >
                            {ticket.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(parseISO(ticket.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {ticket.status === "closed"
                            ? formatDuration(ticket.timeToClose)
                            : "—"}
                        </TableCell>
                      </TableRow>
                      {expandedId === ticket.id && (
                        <TableRow key={`${ticket.id}-expanded`}>
                          <TableCell colSpan={7} className="bg-muted/30">
                            <div className="p-4 space-y-3">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Client:</span>{" "}
                                  <span className="font-medium">{ticket.clientName || "—"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Program:</span>{" "}
                                  <span className="font-medium">{ticket.programName || "—"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Owner:</span>{" "}
                                  {ticket.ownerName ? (
                                    <span className="font-medium">
                                      {ticket.ownerName}
                                      <span className="text-muted-foreground font-mono text-xs ml-1">
                                        ({ticket.ownerId})
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="font-mono text-xs">{ticket.ownerId || "—"}</span>
                                  )}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">External ID:</span>{" "}
                                  <span className="font-mono text-xs">{ticket.externalId}</span>
                                </div>
                              </div>
                              {ticket.content && (
                                <div className="mt-3">
                                  <div className="text-muted-foreground text-sm mb-1">Content:</div>
                                  <div className="bg-muted p-3 rounded text-sm whitespace-pre-wrap max-h-[200px] overflow-auto">
                                    {ticket.content}
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
