import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/pos/AppShell";
import { useDB } from "@/lib/pos/store";
import { meta } from "@/lib/pos/meta";

export const Route = createFileRoute("/audit")({
  head: () => meta("Audit Log", "History of sensitive actions by staff."),
  component: () => (
    <AppShell perm="audit">
      <Audit />
    </AppShell>
  ),
});

function Audit() {
  const logs = useDB((d) => d.audit);
  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Most recent first." />
      <div className="p-8">
        <div className="overflow-hidden rounded-lg border border-border bg-card text-sm shadow-card">
          {logs.map((l) => (
            <div key={l.id} className="flex gap-4 border-b border-border p-3 last:border-0">
              <span className="w-40 text-muted-foreground">{new Date(l.at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "medium" })}</span>
              <span className="w-36 font-medium">{l.by}</span>
              <span className="w-40 text-primary">{l.action}</span>
              <span className="flex-1">{l.detail}</span>
            </div>
          ))}
          {!logs.length && <p className="p-6 text-muted-foreground">No activity yet.</p>}
        </div>
      </div>
    </div>
  );
}
