"use client";

import { Check } from "lucide-react";

interface WizardShellProps {
  currentStep: number;
  totalSteps: number;
  children: React.ReactNode;
}

const stepLabels = [
  "Organization",
  "Pillars",
  "Team",
  "Vision",
  "Metrics",
  "Complete",
];

export function WizardShell({ currentStep, totalSteps, children }: WizardShellProps) {
  return (
    <div className="space-y-8">
      {/* Progress indicator */}
      <nav aria-label="Progress">
        <ol className="flex items-center justify-center space-x-2">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
            <li key={step} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                  step < currentStep
                    ? "bg-blue-600 text-white"
                    : step === currentStep
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {step < currentStep ? (
                  <Check className="h-4 w-4" />
                ) : (
                  step
                )}
              </div>
              {step < totalSteps && (
                <div
                  className={`w-12 h-1 mx-1 rounded ${
                    step < currentStep ? "bg-blue-600" : "bg-slate-200"
                  }`}
                />
              )}
            </li>
          ))}
        </ol>
        <div className="mt-2 text-center text-sm text-slate-500">
          Step {currentStep} of {totalSteps}: {stepLabels[currentStep - 1]}
        </div>
      </nav>

      {/* Step content */}
      <div className="bg-white rounded-xl border shadow-sm p-8">
        {children}
      </div>
    </div>
  );
}
