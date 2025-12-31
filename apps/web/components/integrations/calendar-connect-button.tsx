"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Calendar, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarConnectButtonProps {
  provider: "google" | "outlook";
  isConnected?: boolean;
  connectedEmail?: string;
  onDisconnect?: () => Promise<void>;
  className?: string;
}

export function CalendarConnectButton({
  provider,
  isConnected = false,
  connectedEmail,
  onDisconnect,
  className,
}: CalendarConnectButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const providerLabel = provider === "google" ? "Google Calendar" : "Outlook Calendar";
  const providerIcon = provider === "google" ? (
    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M19.5 3.5h-15A2 2 0 0 0 2.5 5.5v13a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2v-13a2 2 0 0 0-2-2zm-15 2h15v13h-15v-13z"
      />
      <path fill="currentColor" d="M7.5 8.5h3v3h-3zm0 4h3v3h-3zm4 0h3v3h-3zm4-4h3v3h-3zm0 4h3v3h-3zm-4-4h3v3h-3z" />
    </svg>
  ) : (
    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"
      />
    </svg>
  );

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/integrations/calendar/${provider}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate connection");
      }

      // Redirect to OAuth authorization URL
      window.location.href = data.authorization_url;
    } catch (err) {
      console.error("Connection error:", err);
      setError(err instanceof Error ? err.message : "Failed to connect");
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!onDisconnect) return;

    setIsLoading(true);
    setError(null);

    try {
      await onDisconnect();
    } catch (err) {
      console.error("Disconnect error:", err);
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setIsLoading(false);
    }
  };

  if (isConnected) {
    return (
      <div className={cn("flex items-center justify-between p-4 border rounded-lg", className)}>
        <div className="flex items-center">
          {providerIcon}
          <div>
            <div className="font-medium flex items-center">
              {providerLabel}
              <Check className="h-4 w-4 ml-2 text-green-500" />
            </div>
            {connectedEmail && (
              <div className="text-sm text-muted-foreground">{connectedEmail}</div>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Disconnect"
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("p-4 border rounded-lg", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {providerIcon}
          <div className="font-medium">{providerLabel}</div>
        </div>
        <Button onClick={handleConnect} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Calendar className="h-4 w-4 mr-2" />
          )}
          Connect
        </Button>
      </div>

      {error && (
        <div className="mt-2 flex items-center text-sm text-red-500">
          <AlertCircle className="h-4 w-4 mr-1" />
          {error}
        </div>
      )}
    </div>
  );
}
