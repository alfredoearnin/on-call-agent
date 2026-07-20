"use client";

import { useRouter } from "next/navigation";

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
  const days = weeks.find((w) => w.start === selectedWeek)?.days ?? [];

  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Week
        <select
          value={selectedWeek}
          onChange={(e) => router.push(`/daily?week=${e.target.value}`)}
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
          onChange={(e) =>
            router.push(`/daily?week=${selectedWeek}&day=${e.target.value}`)
          }
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
