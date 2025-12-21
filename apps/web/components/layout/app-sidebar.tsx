"use client";

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
  Users,
  Video,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
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
