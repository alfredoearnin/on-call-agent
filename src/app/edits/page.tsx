import { getConfig } from "@/lib/config";
import { getMonitorEdits } from "@/lib/monitor-edits";
import { getSyncSettings } from "@/lib/queries";
import { MonitorEditCard } from "@/components/monitor-edit-card";

export const dynamic = "force-dynamic";

export default async function EditsPage() {
  const cfg = getConfig();
  const [edits, settings] = await Promise.all([
    getMonitorEdits(),
    getSyncSettings(),
  ]);
  const tz = settings?.timezone ?? cfg.team.timezone;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Monitor edits</h1>
        <p className="text-sm text-muted-foreground">
          Detected from Datadog on each sync, plus changes applied from this
          dashboard. Before/after is the live config, not a guess.
        </p>
      </header>

      {edits.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No config edits recorded yet. They appear automatically on the next
          sync after a Datadog Save.
        </p>
      ) : (
        <div className="space-y-4">
          {edits.map((edit) => (
            <MonitorEditCard key={edit.id} edit={edit} tz={tz} />
          ))}
        </div>
      )}
    </div>
  );
}
