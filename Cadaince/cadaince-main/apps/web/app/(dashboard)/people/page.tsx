export default function PeoplePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">People</h1>
        <div className="flex gap-2">
          {/* Add user button will go here (admin only) */}
        </div>
      </div>

      <div className="rounded-lg border p-6">
        <p className="text-muted-foreground">
          Team members and pillars will be displayed here.
        </p>
      </div>
    </div>
  );
}
