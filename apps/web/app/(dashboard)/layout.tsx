import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { HeaderActions } from "@/components/layout/header-actions";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";

// Force dynamic rendering for all dashboard pages (requires auth)
export const dynamic = "force-dynamic";

async function checkOnboardingStatus(clerkUserId: string): Promise<string | null> {
  const supabase = createAdminClient();

  try {
    // Check if user has a profile with an organization
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("clerk_id", clerkUserId)
      .single();

    // If there's an error or no profile, redirect to onboarding
    // This handles the race condition where webhook hasn't created the profile yet
    if (error || !profile) {
      console.log("Profile not found for clerk_id, redirecting to onboarding:", clerkUserId);
      return "/onboarding";
    }

    // User has profile but no organization - needs onboarding
    if (!profile.organization_id) {
      return "/onboarding";
    }

    // Check if organization has completed onboarding
    const { data: org } = await supabase
      .from("organizations")
      .select("id, onboarding_completed_at")
      .eq("id", profile.organization_id)
      .single();

    if (!org?.onboarding_completed_at) {
      return "/onboarding";
    }

    return null;
  } catch (err) {
    // On any error, redirect to onboarding as a safe fallback
    console.error("Error checking onboarding status:", err);
    return "/onboarding";
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || headersList.get("x-invoke-path") || "";

  // Skip onboarding check if already on onboarding page
  const isOnboardingPage = pathname.includes("/onboarding");

  if (userId && !isOnboardingPage) {
    const redirectTo = await checkOnboardingStatus(userId);
    if (redirectTo) {
      redirect(redirectTo);
    }
  }

  // If on onboarding page, just render children (onboarding has its own layout)
  if (isOnboardingPage) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1">
        <header className="flex h-14 items-center gap-4 border-b px-6">
          <SidebarTrigger />
          <div className="flex-1" />
          <HeaderActions />
          <UserButton afterSignOutUrl="/sign-in" />
        </header>
        <div className="p-6">{children}</div>
      </main>
    </SidebarProvider>
  );
}
