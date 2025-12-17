export default function BriefingPage() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Good morning</h1>
          <p className="text-muted-foreground">
            Here&apos;s what needs your attention today.
          </p>
        </div>
        <p className="text-muted-foreground">{today}</p>
      </div>

      <div className="rounded-lg border p-6">
        <p className="text-muted-foreground">
          Morning briefing will be generated here.
        </p>
      </div>
    </div>
  );
}
