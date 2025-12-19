"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { StepOrg } from "@/components/onboarding/step-org";
import { StepPillars } from "@/components/onboarding/step-pillars";
import { StepTeam } from "@/components/onboarding/step-team";
import { StepVTO } from "@/components/onboarding/step-vto";
import { StepMetrics } from "@/components/onboarding/step-metrics";
import { StepComplete } from "@/components/onboarding/step-complete";

export interface WizardState {
  organizationId: string | null;
  pillars: Array<{ id: string; name: string; slug: string; color: string }>;
  teamMembers: Array<{ id: string; fullName: string; email: string }>;
}

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [wizardState, setWizardState] = useState<WizardState>({
    organizationId: null,
    pillars: [],
    teamMembers: [],
  });

  // Get step from URL or check API
  useEffect(() => {
    const stepFromUrl = searchParams.get("step");
    const orgFromUrl = searchParams.get("org");

    if (stepFromUrl) {
      setCurrentStep(parseInt(stepFromUrl, 10));
      if (orgFromUrl) {
        setWizardState((prev) => ({ ...prev, organizationId: orgFromUrl }));
      }
      setLoading(false);
    } else {
      // Check onboarding status from API
      fetch("/api/onboarding")
        .then((res) => res.json())
        .then((data) => {
          if (!data.needsOnboarding) {
            router.push("/briefing");
          } else {
            setCurrentStep(data.step || 1);
            if (data.organizationId) {
              setWizardState((prev) => ({
                ...prev,
                organizationId: data.organizationId,
              }));
            }
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [searchParams, router]);

  const updateUrl = (step: number, orgId?: string) => {
    const params = new URLSearchParams();
    params.set("step", step.toString());
    if (orgId || wizardState.organizationId) {
      params.set("org", orgId || wizardState.organizationId!);
    }
    router.push(`/onboarding?${params.toString()}`);
  };

  const handleStepComplete = (step: number, data?: Partial<WizardState>) => {
    if (data) {
      setWizardState((prev) => ({ ...prev, ...data }));
    }
    const nextStep = step + 1;
    setCurrentStep(nextStep);
    updateUrl(nextStep, data?.organizationId || undefined);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      updateUrl(prevStep);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600 mx-auto mb-4" />
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <StepOrg
            onComplete={(orgId) =>
              handleStepComplete(1, { organizationId: orgId })
            }
          />
        );
      case 2:
        return (
          <StepPillars
            organizationId={wizardState.organizationId!}
            onComplete={(pillars) => handleStepComplete(2, { pillars })}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <StepTeam
            organizationId={wizardState.organizationId!}
            pillars={wizardState.pillars}
            onComplete={(members) => handleStepComplete(3, { teamMembers: members })}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <StepVTO
            organizationId={wizardState.organizationId!}
            onComplete={() => handleStepComplete(4)}
            onBack={handleBack}
          />
        );
      case 5:
        return (
          <StepMetrics
            organizationId={wizardState.organizationId!}
            teamMembers={wizardState.teamMembers}
            pillars={wizardState.pillars}
            onComplete={() => handleStepComplete(5)}
            onBack={handleBack}
          />
        );
      case 6:
        return (
          <StepComplete
            organizationId={wizardState.organizationId!}
          />
        );
      default:
        return <StepOrg onComplete={(orgId) => handleStepComplete(1, { organizationId: orgId })} />;
    }
  };

  return (
    <WizardShell currentStep={currentStep} totalSteps={6}>
      {renderStep()}
    </WizardShell>
  );
}
