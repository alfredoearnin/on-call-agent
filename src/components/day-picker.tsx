"use client";

import { useRouter } from "next/navigation";

export function DayPicker({
  days,
  selected,
}: {
  days: string[];
  selected: string;
}) {
  const router = useRouter();
  const options = days.includes(selected) ? days : [selected, ...days];

  return (
    <select
      value={selected}
      onChange={(e) => router.push(`/daily?day=${e.target.value}`)}
      className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring"
    >
      {options.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
    </select>
  );
}
