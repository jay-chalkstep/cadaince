"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MentionsInbox } from "@/components/mentions/mentions-inbox";

export function HeaderActions() {
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread mention count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch("/api/mentions/count");
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count);
      }
    } catch (error) {
      console.error("Failed to fetch mention count:", error);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    // Poll for new mentions every 60 seconds
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  return (
    <>
      <MentionsInbox
        unreadCount={unreadCount}
        onUnreadCountChange={setUnreadCount}
      />
      <Button variant="ghost" size="icon" asChild>
        <Link href="/alerts">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Alerts</span>
        </Link>
      </Button>
    </>
  );
}
