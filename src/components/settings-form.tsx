"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateSyncSettingsAction } from "@/lib/actions";

interface Props {
  mode: string;
  scheduleCron: string;
  timezone: string;
  enabled: boolean;
}

export function SettingsForm(initial: Props) {
  const [mode, setMode] = useState(initial.mode);
  const [scheduleCron, setScheduleCron] = useState(initial.scheduleCron);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await updateSyncSettingsAction({
        mode,
        scheduleCron,
        timezone,
        enabled,
      });
      setMsg(res.ok ? "Saved." : `Error: ${res.error}`);
      router.refresh();
      if (res.ok) setTimeout(() => setMsg(null), 3000);
    });
  }

  const isAuto = mode === "automatic";

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Sync mode
        </div>
        <div className="flex gap-2">
          {["manual", "automatic"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md border px-4 py-2 text-sm capitalize transition-colors ${
                mode === m
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Manual: use the “Sync now” button or <code>npm run ingest</code>.
          Automatic: run <code>npm run scheduler</code> to fire on the schedule
          below.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Schedule (cron)
          </span>
          <input
            value={scheduleCron}
            onChange={(e) => setScheduleCron(e.target.value)}
            disabled={!isAuto}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring disabled:opacity-50"
            placeholder="0 8 * * *"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Timezone
          </span>
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            placeholder="America/Los_Angeles"
          />
        </label>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={!isAuto}
          className="h-4 w-4 accent-[var(--primary)]"
        />
        <span className="text-sm">
          Enable the automatic scheduler worker
        </span>
      </label>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : "Save settings"}
        </Button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}
