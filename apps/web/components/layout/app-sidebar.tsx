"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CheckSquare,
  CircleDot,
  Compass,
  Database,
  FileText,
  GitBranch,
  Home,
  Link2,
  Megaphone,
  MessageSquare,
  MessageSquareLock,
  Settings,
  Settings2,
  Target,
  Users,
  Users2,
  Video,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { TeamSwitcher } from "@/components/team/team-switcher";

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

const mainNavItems = [
  { title: "Briefing", href: "/briefing", icon: BookOpen },
  { title: "L10", href: "/l10", icon: Video },
  { title: "Vision", href: "/vision", icon: Compass },
  { title: "Scorecard", href: "/scorecard", icon: BarChart3 },
  { title: "Rocks", href: "/rocks", icon: CircleDot },
  { title: "Issues", href: "/issues", icon: MessageSquare },
  { title: "To-Dos", href: "/todos", icon: CheckSquare },
  { title: "Headlines", href: "/headlines", icon: Megaphone },
  { title: "Updates", href: "/updates", icon: FileText },
];

const secondaryNavItems = [
  { title: "Teams", href: "/teams", icon: Users2 },
  { title: "Goals", href: "/goals", icon: Target },
  { title: "Accountability Chart", href: "/accountability-chart", icon: GitBranch },
  { title: "Alerts", href: "/alerts", icon: Bell },
  { title: "Private Notes", href: "/notes", icon: MessageSquareLock },
  { title: "Meetings", href: "/meetings", icon: Calendar },
];

const settingsNavItems = [
  { title: "Team", href: "/team", icon: Users },
  { title: "V/TO", href: "/settings/vto", icon: Settings2 },
  { title: "Integrations", href: "/settings/integrations", icon: Link2 },
  { title: "Data Sources", href: "/settings/data-sources", icon: Database },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [unreadUpdatesCount, setUnreadUpdatesCount] = useState(0);

  // Fetch unread updates count
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/updates/count");
        if (res.ok) {
          const { count } = await res.json();
          setUnreadUpdatesCount(count);
        }
      } catch (error) {
        console.error("Failed to fetch updates count:", error);
      }
    };

    fetchCount();
    // Poll every 10 seconds for responsive unread badge updates
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
      <SidebarHeader className="border-b px-6 py-4 space-y-3">
        <Link href="/briefing" className="flex items-center gap-2">
          <span className="text-xl font-semibold">Aicomplice</span>
        </Link>
        <TeamSwitcher className="w-full" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
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
                      {item.href === "/updates" && unreadUpdatesCount > 0 && (
                        <Badge
                          variant="default"
                          className="h-5 min-w-5 px-1.5 text-[10px] bg-blue-600 hover:bg-blue-600"
                        >
                          {unreadUpdatesCount > 9 ? "9+" : unreadUpdatesCount}
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

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryNavItems.map((item) => (
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

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map((item) => (
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
