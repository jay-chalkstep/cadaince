export default function UpdatesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Updates</h1>
        <div className="flex gap-2">
          {/* Filter and add button will go here */}
        </div>
      </div>

      <div className="rounded-lg border p-6">
        <p className="text-muted-foreground">
          Update feed will be displayed here.
        </p>
      </div>
    </div>
  );
}
