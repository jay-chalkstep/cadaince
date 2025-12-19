"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";

interface StepCompleteProps {
  organizationId: string;
}

export function StepComplete({ organizationId }: StepCompleteProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);

    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: 6,
          data: { organizationId },
        }),
      });

      router.push("/briefing");
    } catch (error) {
      console.error("Error completing onboarding:", error);
      // Redirect anyway
      router.push("/briefing");
    }
  };

  return (
    <div className="space-y-8 text-center py-8">
      <div className="relative">
        <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <Sparkles className="absolute top-0 right-1/3 h-6 w-6 text-yellow-500 animate-pulse" />
        <Sparkles className="absolute bottom-0 left-1/3 h-4 w-4 text-blue-500 animate-pulse delay-75" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          You&apos;re all set!
        </h2>
        <p className="text-slate-500 mt-2 max-w-md mx-auto">
          Your organization is ready to go. You can always update your settings,
          invite more team members, and refine your V/TO from the dashboard.
        </p>
      </div>

      <div className="bg-slate-50 rounded-lg p-6 max-w-md mx-auto">
        <h3 className="font-medium text-slate-900 mb-3">What&apos;s next?</h3>
        <ul className="text-left text-sm text-slate-600 space-y-2">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Check your morning briefing for AI-generated insights</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Add metrics to your scorecard and track weekly progress</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Create rocks for your quarterly priorities</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Schedule your first L10 meeting</span>
          </li>
        </ul>
      </div>

      <Button
        size="lg"
        onClick={handleComplete}
        disabled={loading}
        className="min-w-48"
      >
        {loading ? (
          "Loading..."
        ) : (
          <>
            Go to Dashboard
            <ArrowRight className="ml-2 h-5 w-5" />
          </>
        )}
      </Button>
    </div>
  );
}
