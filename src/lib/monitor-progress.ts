/**
 * The tuning state of one monitor, as badges for the index.
 *
 * The counts used to live in the sub-line: seven dot-separated facts in one
 * grey string, where identity, firing volume, tuning progress and recency all
 * rendered identically. On a list of 279 rows that is unscannable — the one
 * question the page exists to answer, *has the advice been taken*, sat between
 * "6 recorded firings" and "analysed Sep 14".
 *
 * Two badges at most, because a row already carries a state and a priority
 * badge and five would be soup. Each tone means one thing:
 *   primary — something can be applied right now. The only call to action.
 *   ok      — the change is in place and this dashboard recorded doing it.
 *   neutral — in place, but observed rather than recorded. Weaker evidence.
 *   warn    — advice is open and nothing can act on it. A dead end, not a task.
 *
 * Badging every row would defeat it; only 12 of 279 monitors carry a
 * recommendation at all, so a row with a badge is genuinely the exception.
 */

export interface ProgressBadge {
  label: string;
  /** A Badge `tone`. See the module comment for what each one means here. */
  tone: "primary" | "ok" | "neutral" | "warn";
  /** Hover text. Carries the detail the label has no room for. */
  title: string;
}

export interface MonitorProgressCounts {
  recommendationCount: number;
  appliedCount: number;
  appliedOutOfBandCount: number;
  openCount: number;
  applyableCount: number;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function monitorProgressBadges(
  m: MonitorProgressCounts,
): ProgressBadge[] {
  const badges: ProgressBadge[] = [];
  const inPlace = m.appliedCount + m.appliedOutOfBandCount;

  if (inPlace > 0) {
    const complete = inPlace === m.recommendationCount;
    const outOfBand = m.appliedOutOfBandCount > 0;
    badges.push({
      label: complete
        ? `${inPlace} applied`
        : `${inPlace} of ${m.recommendationCount} applied`,
      // Neutral rather than green when any of them was only observed: the
      // change was detected in the monitor's history, which is not the same as
      // this dashboard having made it, and the colour should not claim it is.
      tone: outOfBand ? "neutral" : "ok",
      title: outOfBand
        ? `${plural(m.appliedCount, "change")} applied from here; ${m.appliedOutOfBandCount} detected in the monitor's history, edited directly in Datadog`
        : `${plural(m.appliedCount, "change")} applied from this dashboard`,
    });
  }

  if (m.openCount > 0) {
    badges.push(
      m.applyableCount > 0
        ? {
            label: `${m.applyableCount} to apply`,
            tone: "primary",
            title: `${plural(m.applyableCount, "recommendation")} with a change ready to apply`,
          }
        : {
            label: `${m.openCount} open`,
            tone: "warn",
            title: `${plural(m.openCount, "recommendation")} awaiting a decision, none with a change that can be applied to the monitor as it is now — re-run the analysis`,
          },
    );
  }

  return badges;
}
