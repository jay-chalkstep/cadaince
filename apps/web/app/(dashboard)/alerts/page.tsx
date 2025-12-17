export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Alerts</h1>
        <div className="flex gap-2">
          {/* Filter will go here */}
        </div>
      </div>

      <div className="rounded-lg border p-6">
        <p className="text-muted-foreground">
          Alert history will be displayed here.
        </p>
      </div>
    </div>
  );
}
