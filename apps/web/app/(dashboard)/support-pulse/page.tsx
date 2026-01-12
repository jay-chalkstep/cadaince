import { SupportPulseDashboard } from "@/components/support-pulse/support-pulse-dashboard";

export default function SupportPulsePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Support Pulse</h1>
        <p className="text-sm text-muted-foreground">
          Monitor support ticket trends and team performance
        </p>
      </div>
      <SupportPulseDashboard />
    </div>
  );
}
