"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Calendar,
  CheckSquare,
  CircleDot,
  Compass,
  Database,
  GitBranch,
  Home,
  Link2,
  Megaphone,
  MessageSquare,
  MessageSquareLock,
  Radio,
  Settings,
  Settings2,
  Target,
  Users,
  Video,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

// My Day - Individual's daily starting point
const myDayItems = [
  { title: "Briefing", href: "/briefing", icon: BookOpen },
  { title: "Updates and Alerts", href: "/stream", icon: Radio },
  { title: "To-Dos", href: "/todos", icon: CheckSquare },
  { title: "Private Notes", href: "/notes", icon: MessageSquareLock },
  { title: "Goals", href: "/goals", icon: Target },
];

// L10 - Meeting and execution focused
const l10Items = [
  { title: "L10", href: "/l10", icon: Video },
  { title: "Scorecard", href: "/scorecard", icon: BarChart3 },
  { title: "Issues", href: "/issues", icon: MessageSquare },
  { title: "Rocks", href: "/rocks", icon: CircleDot },
  { title: "Headlines", href: "/headlines", icon: Megaphone },
  { title: "Vision", href: "/vision", icon: Compass },
];

// Admin - Settings and configuration
const adminItems = [
  { title: "Accountability Chart", href: "/accountability-chart", icon: GitBranch },
  { title: "Team", href: "/team", icon: Users },
  { title: "Meetings", href: "/meetings", icon: Calendar },
  { title: "V/TO", href: "/settings/vto", icon: Settings2 },
  { title: "Integrations", href: "/settings/integrations", icon: Link2 },
  { title: "Data Sources", href: "/settings/data-sources", icon: Database },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [streamCount, setStreamCount] = useState(0);

  // Fetch combined updates + alerts count
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/stream/count");
        if (res.ok) {
          const { total } = await res.json();
          setStreamCount(total);
        }
      } catch (error) {
        console.error("Failed to fetch stream count:", error);
      }
    };

    fetchCount();
    // Poll every 10 seconds for responsive badge updates
    const interval = setInterval(fetchCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (href: string) => {
    if (href === pathname) return true;
    // Handle nested routes - /l10/xxx should highlight L10
    if (href !== "/" && pathname.startsWith(href + "/")) return true;
    return false;
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <Link href="/briefing" className="flex items-center gap-2">
          <span className="text-xl font-semibold">Aicomplice</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {/* My Day - Individual's daily starting point */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {myDayItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                  >
                    <Link href={item.href} className="flex items-center justify-between w-full">
                      <span className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </span>
                      {item.href === "/stream" && streamCount > 0 && (
                        <Badge
                          variant="default"
                          className="h-5 min-w-5 px-1.5 text-[10px] bg-blue-600 hover:bg-blue-600"
                        >
                          {streamCount > 9 ? "9+" : streamCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* L10 - Meeting and execution focused */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {l10Items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Admin - Settings and configuration */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
