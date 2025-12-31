"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Check, AlertCircle, Hash, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlackConnectButtonProps {
  isConnected?: boolean;
  workspaceName?: string;
  workspaceIcon?: string;
  onDisconnect?: () => Promise<void>;
  onResync?: () => Promise<void>;
  className?: string;
}

export function SlackConnectButton({
  isConnected = false,
  workspaceName,
  workspaceIcon,
  onDisconnect,
  onResync,
  className,
}: SlackConnectButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/integrations/slack/oauth");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate connection");
      }

      // Redirect to Slack OAuth
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

  const handleResync = async () => {
    if (!onResync) return;

    setIsResyncing(true);
    setError(null);

    try {
      await onResync();
    } catch (err) {
      console.error("Resync error:", err);
      setError(err instanceof Error ? err.message : "Failed to sync users");
    } finally {
      setIsResyncing(false);
    }
  };

  if (isConnected) {
    return (
      <div className={cn("p-4 border rounded-lg", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {workspaceIcon ? (
              <img
                src={workspaceIcon}
                alt={workspaceName || "Slack"}
                className="h-8 w-8 rounded mr-3"
              />
            ) : (
              <SlackIcon className="h-8 w-8 mr-3" />
            )}
            <div>
              <div className="font-medium flex items-center">
                {workspaceName || "Slack Workspace"}
                <Check className="h-4 w-4 ml-2 text-green-500" />
              </div>
              <div className="text-sm text-muted-foreground">Connected</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResync}
              disabled={isResyncing}
            >
              {isResyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Sync Users
                </>
              )}
            </Button>
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

  return (
    <div className={cn("p-4 border rounded-lg", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <SlackIcon className="h-8 w-8 mr-3" />
          <div>
            <div className="font-medium">Slack</div>
            <div className="text-sm text-muted-foreground">
              Notifications and slash commands
            </div>
          </div>
        </div>
        <Button onClick={handleConnect} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Hash className="h-4 w-4 mr-2" />
          )}
          Add to Slack
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

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
        fill="#E01E5A"
      />
    </svg>
  );
}
