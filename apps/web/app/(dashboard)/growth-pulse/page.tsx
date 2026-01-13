import { GrowthPulseDashboard } from "@/components/growth-pulse/growth-pulse-dashboard";

export default function GrowthPulsePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Growth Pulse</h1>
        <p className="text-sm text-muted-foreground">
          Track deal pipeline performance and sales team metrics
        </p>
      </div>
      <GrowthPulseDashboard />
    </div>
  );
}
