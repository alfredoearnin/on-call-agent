import { prisma } from "@/lib/db";
import { AppliedChangeStatus, MonitorEditSource } from "@/lib/constants";
import type { ProposedPatch } from "@/lib/ingest/types";
import {
  diffMonitorConfig,
  recommendationExplainsEdit,
  type FieldDiff,
  type MonitorConfigFields,
} from "@/lib/monitor-config";

export interface EditWhy {
  title: string;
  summary: string;
  coverage?: string | null;
  expectedImpact?: string | null;
  source: "recommendation" | "apply";
  recommendationId?: string;
}

/**
 * An operator's own explanation. Kept beside `why` rather than folded into it:
 * a matched recommendation says what the change was meant to achieve, and the
 * note says why it was made — one must not hide the other.
 */
export interface EditNote {
  text: string;
  operator: string;
  at: Date;
}

export interface MonitorEdit {
  id: string;
  monitorId: string;
  monitorName: string;
  datadogUrl: string | null;
  source: MonitorEditSource;
  detectedAt: Date;
  modifiedAt: Date | null;
  actorName: string | null;
  actorAt: Date | null;
  afterHash: string;
  diffs: FieldDiff[];
  why: EditWhy | null;
  note: EditNote | null;
}

function parseJson(raw: string | null): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function safePatch(raw: string): ProposedPatch | null {
  try {
    return JSON.parse(raw) as ProposedPatch;
  } catch {
    return null;
  }
}

function fieldsFromSnap(s: {
  query: string | null;
  message: string | null;
  priority: string | null;
  thresholds: string | null;
  options: string | null;
}): MonitorConfigFields {
  return {
    query: s.query,
    message: s.message,
    priority: s.priority,
    thresholds: parseJson(s.thresholds),
    options: parseJson(s.options),
  };
}

function diffsFromApplied(beforeJson: string, afterJson: string, diffJson: string | null): FieldDiff[] {
  if (diffJson) {
    try {
      const d = JSON.parse(diffJson) as { field?: string; before?: string; after?: string };
      if (d.field && d.before !== undefined && d.after !== undefined) {
        return [
          {
            field: d.field as FieldDiff["field"],
            before: String(d.before),
            after: String(d.after),
          },
        ];
      }
    } catch {
      /* fall through */
    }
  }
  try {
    const b = JSON.parse(beforeJson) as { field?: string; value?: string };
    const a = JSON.parse(afterJson) as { field?: string; value?: string };
    const field = (a.field ?? b.field ?? "message") as FieldDiff["field"];
    return [
      {
        field,
        before: String(b.value ?? ""),
        after: String(a.value ?? ""),
      },
    ];
  } catch {
    return [];
  }
}

export async function getMonitorEdits(opts?: {
  monitorId?: string;
  since?: Date;
}): Promise<MonitorEdit[]> {
  const monitorWhere = opts?.monitorId ? { id: opts.monitorId } : {};
  const monitors = await prisma.monitor.findMany({
    where: monitorWhere,
    include: {
      snapshots: { orderBy: { capturedAt: "asc" } },
      appliedChanges: { orderBy: { appliedAt: "asc" } },
      recommendations: true,
    },
  });

  const notes = await prisma.monitorEditNote.findMany({
    where: opts?.monitorId ? { monitorId: opts.monitorId } : {},
    orderBy: { createdAt: "desc" },
  });
  // Newest note per edit wins; a later one supersedes rather than appends.
  const noteByKey = new Map<string, EditNote>();
  for (const n of notes) {
    const key = `${n.monitorId}:${n.afterHash}`;
    if (noteByKey.has(key)) continue;
    noteByKey.set(key, { text: n.note, operator: n.operator, at: n.createdAt });
  }

  const out: MonitorEdit[] = [];

  for (const monitor of monitors) {
    const collapsed = collapseSnapshots(monitor.snapshots);
    const applied = monitor.appliedChanges.filter(
      (c) => c.status === AppliedChangeStatus.Applied,
    );
    const covered = new Set<string>();

    for (let i = 1; i < collapsed.length; i++) {
      const prev = collapsed[i - 1];
      const next = collapsed[i];
      const diffs = diffMonitorConfig(fieldsFromSnap(prev), fieldsFromSnap(next));
      if (diffs.length === 0) continue;

      const matchingApply = applied.find(
        (c) =>
          c.appliedAt.getTime() >= prev.capturedAt.getTime() &&
          c.appliedAt.getTime() <= next.capturedAt.getTime() + 120_000,
      );
      if (matchingApply) {
        covered.add(matchingApply.id);
        continue;
      }

      const detectedAt = next.capturedAt;
      if (opts?.since && detectedAt < opts.since) continue;

      out.push({
        id: `snap:${next.id}`,
        monitorId: monitor.id,
        monitorName: monitor.name,
        datadogUrl: monitor.datadogUrl,
        source: MonitorEditSource.DatadogDetected,
        detectedAt,
        modifiedAt: monitor.modifiedAt,
        actorName: next.actorName,
        actorAt: next.actorAt,
        afterHash: next.hash,
        diffs,
        why: whyFor(monitor, fieldsFromSnap(next)),
        note: noteByKey.get(`${monitor.id}:${next.hash}`) ?? null,
      });
    }

    for (const c of applied) {
      if (covered.has(c.id)) {
        if (opts?.since && c.appliedAt < opts.since) continue;
        out.push(appliedEdit(monitor, c, noteByKey));
        continue;
      }
      if (opts?.since && c.appliedAt < opts.since) continue;
      out.push(appliedEdit(monitor, c, noteByKey));
    }
  }

  out.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  return out;
}

function appliedEdit(
  monitor: {
    id: string;
    name: string;
    datadogUrl: string | null;
    recommendations: { id: string; title: string; changeSummary: string; coveragePreserved: string | null; expectedImpact: string | null }[];
  },
  c: {
    id: string;
    appliedAt: Date;
    changeSummary: string;
    beforeJson: string;
    afterJson: string;
    diffJson: string | null;
    recommendationId: string | null;
    operator: string;
  },
  noteByKey: Map<string, EditNote>,
): MonitorEdit {
  const rec = monitor.recommendations.find((r) => r.id === c.recommendationId);
  const why: EditWhy | null = rec
    ? {
        title: rec.title,
        summary: rec.changeSummary || c.changeSummary,
        coverage: rec.coveragePreserved,
        expectedImpact: rec.expectedImpact,
        source: "apply",
        recommendationId: rec.id,
      }
    : {
        title: c.changeSummary,
        summary: `Applied from the dashboard by ${c.operator}.`,
        source: "apply",
      };
  return {
    id: `apply:${c.id}`,
    monitorId: monitor.id,
    monitorName: monitor.name,
    datadogUrl: monitor.datadogUrl,
    source: MonitorEditSource.DashboardApply,
    detectedAt: c.appliedAt,
    modifiedAt: c.appliedAt,
    actorName: c.operator,
    actorAt: c.appliedAt,
    afterHash: c.id,
    diffs: diffsFromApplied(c.beforeJson, c.afterJson, c.diffJson),
    why,
    note: noteByKey.get(`${monitor.id}:${c.id}`) ?? null,
  };
}

function collapseSnapshots<T extends { hash: string }>(snaps: T[]): T[] {
  const out: T[] = [];
  for (const s of snaps) {
    if (out.length > 0 && out[out.length - 1].hash === s.hash) continue;
    out.push(s);
  }
  return out;
}

function whyFor(
  monitor: {
    recommendations: {
      id: string;
      title: string;
      changeSummary: string;
      after: string;
      coveragePreserved: string | null;
      expectedImpact: string | null;
      patchJson: string | null;
    }[];
  },
  after: MonitorConfigFields,
): EditWhy | null {
  for (const rec of monitor.recommendations) {
    const patch: ProposedPatch | null = rec.patchJson
      ? safePatch(rec.patchJson)
      : null;
    const patchMatch = recommendationExplainsEdit(patch, after);
    const textMatch =
      Boolean(after.message) &&
      /incidentio-low|growth-low-urgency|is_warning/i.test(after.message ?? "") &&
      /HIGH\s*→\s*LOW|HIGH -> LOW|warn.*low|incidentio-low/i.test(
        `${rec.title} ${rec.changeSummary} ${rec.after}`,
      );
    if (patchMatch || textMatch) {
      return {
        title: rec.title,
        summary: rec.changeSummary,
        coverage: rec.coveragePreserved,
        expectedImpact: rec.expectedImpact,
        source: "recommendation",
        recommendationId: rec.id,
      };
    }
  }
  return null;
}

export async function countMonitorEditsSince(since: Date): Promise<number> {
  const edits = await getMonitorEdits({ since });
  return edits.length;
}
