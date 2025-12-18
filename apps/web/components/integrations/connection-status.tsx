"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ConnectionStatusProps {
  isActive: boolean;
  credentialsSet: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
}

export function ConnectionStatus({
  isActive,
  credentialsSet,
  lastSyncAt,
  lastError,
}: ConnectionStatusProps) {
  if (!credentialsSet) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Not Configured
      </Badge>
    );
  }

  if (!isActive) {
    return (
      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
        Disabled
      </Badge>
    );
  }

  if (lastError) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive">Error</Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-xs">{lastError}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Badge variant="default" className="bg-green-600">
      Connected
    </Badge>
  );
}
