"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface WeekOption {
  start: string;
  label: string;
  days: string[];
}

export function DayPicker({
  weeks,
  selectedWeek,
  selectedDay,
}: {
  weeks: WeekOption[];
  selectedWeek: string;
  selectedDay: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const days = weeks.find((w) => w.start === selectedWeek)?.days ?? [];

  /**
   * Navigate changing only the keys this control owns.
   *
   * These selects used to rebuild the query from scratch, which silently
   * dropped every other param — picking a different week threw away the
   * List/Timeline choice. Carrying the existing query forward means a control
   * added later keeps working without touching this one.
   */
  function go(next: Record<string, string | null>) {
    const p = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null) p.delete(key);
      else p.set(key, value);
    }
    router.push(`/daily?${p.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Week
        <select
          value={selectedWeek}
          // Day values are dates inside one week, so a day carried into another
          // week would name a date that week does not contain.
          onChange={(e) => go({ week: e.target.value, day: null })}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
        >
          {weeks.map((w) => (
            <option key={w.start} value={w.start}>
              {w.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Day
        <select
          value={selectedDay}
          onChange={(e) => go({ week: selectedWeek, day: e.target.value })}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
        >
          <option value="all">All week</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
