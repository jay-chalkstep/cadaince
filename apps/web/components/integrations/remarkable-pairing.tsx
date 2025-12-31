"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Check,
  AlertCircle,
  ExternalLink,
  Tablet,
  RefreshCw,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RemarkableSettings {
  push_meeting_agendas: boolean;
  push_briefings: boolean;
  minutes_before_meeting: number;
  folder_path: string;
}

interface RemarkablePairingProps {
  isConnected?: boolean;
  settings?: RemarkableSettings;
  recentDocuments?: Array<{
    id: string;
    title: string;
    document_type: string;
    status: string;
    pushed_at: string;
  }>;
  onDisconnect?: () => Promise<void>;
  onSettingsChange?: (settings: Partial<RemarkableSettings>) => Promise<void>;
  className?: string;
}

export function RemarkablePairing({
  isConnected = false,
  settings,
  recentDocuments = [],
  onDisconnect,
  onSettingsChange,
  className,
}: RemarkablePairingProps) {
  const [isPairing, setIsPairing] = useState(false);
  const [pairingStep, setPairingStep] = useState<"start" | "enter_code" | null>(null);
  const [pairingUrl, setPairingUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleStartPairing = async () => {
    setIsPairing(true);
    setError(null);

    try {
      const response = await fetch("/api/integrations/remarkable/pair", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start pairing");
      }

      setPairingUrl(data.pairing_url);
      setPairingStep("enter_code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start pairing");
      setIsPairing(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      setError("Please enter the code");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch("/api/integrations/remarkable/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to verify code");
      }

      setSuccessMessage("reMarkable connected successfully!");
      setPairingStep(null);
      setIsPairing(false);
      setCode("");

      // Refresh the page to show connected state
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify code");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisconnect = async () => {
    if (!onDisconnect) return;

    setIsDisconnecting(true);
    setError(null);

    try {
      await onDisconnect();
      setSuccessMessage("reMarkable disconnected.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSettingToggle = async (
    key: keyof RemarkableSettings,
    value: boolean | number | string
  ) => {
    if (!onSettingsChange) return;
    try {
      await onSettingsChange({ [key]: value });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update setting");
    }
  };

  const cancelPairing = () => {
    setPairingStep(null);
    setIsPairing(false);
    setCode("");
    setError(null);
  };

  // Connected state
  if (isConnected) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <RemarkableIcon className="h-8 w-8 mr-3" />
              <div>
                <div className="font-medium flex items-center">
                  reMarkable
                  <Check className="h-4 w-4 ml-2 text-green-500" />
                </div>
                <div className="text-sm text-muted-foreground">Connected</div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Disconnect"
              )}
            </Button>
          </div>
        </div>

        {/* Settings */}
        {settings && (
          <div className="p-4 border rounded-lg space-y-4">
            <h4 className="font-medium text-sm">Auto-Push Settings</h4>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="push-agendas">Push meeting agendas</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically send L10 agendas before meetings
                </p>
              </div>
              <Switch
                id="push-agendas"
                checked={settings.push_meeting_agendas}
                onCheckedChange={(checked) =>
                  handleSettingToggle("push_meeting_agendas", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="push-briefings">Push daily briefings</Label>
                <p className="text-xs text-muted-foreground">
                  Send AI briefings when generated
                </p>
              </div>
              <Switch
                id="push-briefings"
                checked={settings.push_briefings}
                onCheckedChange={(checked) =>
                  handleSettingToggle("push_briefings", checked)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minutes-before">Minutes before meeting</Label>
              <Input
                id="minutes-before"
                type="number"
                min={15}
                max={120}
                value={settings.minutes_before_meeting}
                onChange={(e) =>
                  handleSettingToggle(
                    "minutes_before_meeting",
                    parseInt(e.target.value) || 60
                  )
                }
                className="w-24"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="folder-path">Folder path</Label>
              <Input
                id="folder-path"
                value={settings.folder_path}
                onChange={(e) =>
                  handleSettingToggle("folder_path", e.target.value)
                }
                placeholder="/Aicomplice"
              />
              <p className="text-xs text-muted-foreground">
                Documents will be saved to this folder
              </p>
            </div>
          </div>
        )}

        {/* Recent Documents */}
        {recentDocuments.length > 0 && (
          <div className="p-4 border rounded-lg space-y-2">
            <h4 className="font-medium text-sm">Recent Documents</h4>
            <div className="space-y-1">
              {recentDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>{doc.title}</span>
                  </div>
                  <span
                    className={cn(
                      "text-xs",
                      doc.status === "pushed"
                        ? "text-green-600"
                        : doc.status === "error"
                        ? "text-red-600"
                        : "text-yellow-600"
                    )}
                  >
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center text-sm text-red-500">
            <AlertCircle className="h-4 w-4 mr-1" />
            {error}
          </div>
        )}

        {successMessage && (
          <div className="flex items-center text-sm text-green-500">
            <Check className="h-4 w-4 mr-1" />
            {successMessage}
          </div>
        )}
      </div>
    );
  }

  // Pairing flow
  if (pairingStep === "enter_code") {
    return (
      <div className={cn("p-4 border rounded-lg space-y-4", className)}>
        <div className="flex items-center">
          <RemarkableIcon className="h-8 w-8 mr-3" />
          <div>
            <div className="font-medium">Connect reMarkable</div>
            <div className="text-sm text-muted-foreground">Enter pairing code</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg text-sm">
            <p className="font-medium mb-2">Steps:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Visit{" "}
                <a
                  href={pairingUrl || "https://my.remarkable.com/device/browser/connect"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline inline-flex items-center"
                >
                  my.remarkable.com
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </li>
              <li>Sign in with your reMarkable account</li>
              <li>Enter the 8-character code shown below</li>
            </ol>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pairing-code">Enter the 8-character code</Label>
            <Input
              id="pairing-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD1234"
              maxLength={8}
              className="font-mono text-lg tracking-wider"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleVerifyCode}
              disabled={isVerifying || code.length < 8}
            >
              {isVerifying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Connect
            </Button>
            <Button variant="outline" onClick={cancelPairing}>
              Cancel
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center text-sm text-red-500">
            <AlertCircle className="h-4 w-4 mr-1" />
            {error}
          </div>
        )}
      </div>
    );
  }

  // Disconnected state
  return (
    <div className={cn("p-4 border rounded-lg", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <RemarkableIcon className="h-8 w-8 mr-3" />
          <div>
            <div className="font-medium">reMarkable</div>
            <div className="text-sm text-muted-foreground">
              Push meeting agendas to your tablet
            </div>
          </div>
        </div>
        <Button onClick={handleStartPairing} disabled={isPairing}>
          {isPairing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Tablet className="h-4 w-4 mr-2" />
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

function RemarkableIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="2"
        width="18"
        height="20"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="7"
        y1="22"
        x2="17"
        y2="22"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="6" y="5" width="12" height="14" rx="1" fill="currentColor" opacity="0.1" />
    </svg>
  );
}
