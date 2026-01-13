"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { SellerDetail } from "@/types/growth-pulse";
import { formatCurrency } from "@/types/growth-pulse";

interface SellerHeaderProps {
  seller: SellerDetail;
}

export function SellerHeader({ seller }: SellerHeaderProps) {
  const initials = seller.ownerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-4">
      <Link href="/growth-pulse">
        <Button variant="ghost" size="icon">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </Link>
      <Avatar className="h-12 w-12">
        <AvatarFallback className="text-lg">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{seller.ownerName}</h1>
          <Badge variant="secondary">
            {formatCurrency(seller.openPipelineArr, true)} Pipeline
          </Badge>
        </div>
        {seller.ownerEmail && (
          <p className="text-sm text-muted-foreground">{seller.ownerEmail}</p>
        )}
      </div>
      <div className="text-right">
        <div className="text-sm text-muted-foreground">Closed Won QTD</div>
        <div className="text-2xl font-bold text-green-600">
          {formatCurrency(seller.closedWonQtdArr, true)}
        </div>
        <div className="text-xs text-muted-foreground">
          {seller.closedWonQtdCount} deals
        </div>
      </div>
    </div>
  );
}
