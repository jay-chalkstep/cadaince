export default function RocksPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Rocks</h1>
        <div className="flex gap-2">
          {/* Quarter selector and add button will go here */}
        </div>
      </div>

      <div className="rounded-lg border p-6">
        <p className="text-muted-foreground">
          Rocks will be displayed here.
        </p>
      </div>
    </div>
  );
}
