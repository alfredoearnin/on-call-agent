"use client";

import { useEffect, useState } from "react";

/**
 * Renders an instant in the VIEWER's timezone, with the zone named.
 *
 * These pages are Server Components, so the server cannot know the reader's zone.
 * It renders `fallback` (the same instant in the on-call week's timezone), and this
 * component reformats on mount — so the first paint matches the server exactly and
 * there is no hydration mismatch, just a swap to local time once JS runs. With JS
 * off you still get a correct, labelled time, only in the team's zone.
 *
 * The zone label is not decoration. An alert that paged at 02:17 in California is
 * 03:17 in Mexico City and 09:17 UTC; an unlabelled "2:17 AM" invites every reader
 * to assume it was their own 2:17, which is exactly how an overnight page gets
 * misread as a mid-morning one.
 */
export type LocalTimeVariant = "time" | "datetime" | "date";

const OPTIONS: Record<LocalTimeVariant, Intl.DateTimeFormatOptions> = {
  time: { hour: "numeric", minute: "2-digit", timeZoneName: "short" },
  datetime: {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  },
  date: { month: "short", day: "numeric", year: "numeric" },
};

export function LocalTime({
  iso,
  fallback,
  variant = "time",
  timeKnown = true,
}: {
  /** The instant, as an ISO string. */
  iso: string;
  /** Server-rendered text in the team timezone, shown until mount. */
  fallback: string;
  variant?: LocalTimeVariant;
  /**
   * False when the handoff page stated a day but no clock time. Showing any clock
   * time then would be inventing one, so we say so instead.
   */
  timeKnown?: boolean;
}) {
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    if (!timeKnown && variant !== "date") return;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return;
    setLocal(new Intl.DateTimeFormat("en-US", OPTIONS[variant]).format(d));
  }, [iso, variant, timeKnown]);

  if (!timeKnown && variant !== "date") {
    return (
      <span
        className="text-muted-foreground"
        title="The handoff page stated the day but no clock time, so none is shown."
      >
        time not stated
      </span>
    );
  }

  return <span suppressHydrationWarning>{local ?? fallback}</span>;
}
