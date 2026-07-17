import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { redactString } from "@/lib/redact";
import {
  FiringKind,
  RecommendationStatus,
  type RecommendationStatus as RecStatus,
} from "@/lib/constants";
import type { IngestBundle } from "@/lib/ingest/types";
import type { OpsWindow } from "@/lib/ingest/window";

export interface KpiSummary {
  totalAlerts: number;
  highAlerts: number;
  lowAlerts: number;
  humanAttention: number;
  autoResolved: number;
  incidentsCount: number;
  escalationRateNum: number;
  escalationRateDen: number;
  activeFiring: number;
  staleFiring: number;
  runRateWeekly: number;
  priorWeekTotal: number | null;
  trend: string;
}

export interface PersistResult {
  kpis: KpiSummary;
  monitors: number;
  alerts: number;
  incidents: number;
  recommendations: number;
}

function hashConfig(parts: (string | null | undefined)[]): string {
  return createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}

const STATUS_RANK: Record<string, number> = {
  proposed: 1,
  recommend: 2,
  "strongly-recommend": 3,
};

/** Escalation tone from streak + active noise (on-call.md Step 4b). */
function computeStatus(
  weeksSeen: number,
  firesThisWeek: number,
  nightPages: number,
  cfg = getConfig(),
): RecStatus {
  if (weeksSeen >= cfg.thresholds.noiseMinRecurringWeeks) {
    return firesThisWeek > 0 || nightPages > 0
      ? RecommendationStatus.StronglyRecommend
      : RecommendationStatus.Recommend;
  }
  return RecommendationStatus.Proposed;
}

export async function persistBundle(
  bundle: IngestBundle,
  window: OpsWindow,
  runId: string,
  opts: { preserveExistingConfig?: boolean } = {},
): Promise<PersistResult> {
  const now = new Date();
  const monitorIds = new Set(bundle.monitors.map((m) => m.id));

  // --- Monitors + per-run config snapshot -----------------------------------
  // In demo mode the DB is the source of truth for config, so applied changes
  // survive later syncs. In live mode config always refreshes from Datadog
  // (that's how the feedback loop observes real drift).
  for (const m of bundle.monitors) {
    const message = m.message ? redactString(m.message).value : null;
    const hash = hashConfig([m.query, message, m.priority]);
    const existing = await prisma.monitor.findUnique({ where: { id: m.id } });
    const preserve = Boolean(opts.preserveExistingConfig && existing);

    if (!existing) {
      await prisma.monitor.create({
        data: {
          id: m.id,
          name: m.name,
          service: m.service,
          priority: m.priority,
          tags: JSON.stringify(m.tags),
          currentState: m.state,
          query: m.query,
          message,
          configHash: hash,
          datadogUrl: m.datadogUrl,
          envScope: m.envScope,
          cluster: m.cluster,
          modifiedAt: m.modifiedAt,
          firstSeenAt: now,
          lastSeenAt: now,
        },
      });
    } else {
      await prisma.monitor.update({
        where: { id: m.id },
        data: {
          name: m.name,
          service: m.service,
          tags: JSON.stringify(m.tags),
          currentState: m.state,
          datadogUrl: m.datadogUrl,
          envScope: m.envScope,
          cluster: m.cluster,
          modifiedAt: m.modifiedAt,
          lastSeenAt: now,
          // Config fields: keep DB values in demo (preserve applied changes).
          ...(preserve
            ? {}
            : { priority: m.priority, query: m.query, message, configHash: hash }),
        },
      });
    }

    const snap = preserve && existing
      ? {
          query: existing.query,
          message: existing.message,
          priority: existing.priority,
          hash: existing.configHash ?? hash,
        }
      : { query: m.query, message, priority: m.priority, hash };

    await prisma.monitorConfigSnapshot.create({
      data: {
        monitorId: m.id,
        runId,
        query: snap.query,
        message: snap.message,
        priority: snap.priority,
        thresholds: m.thresholds ? JSON.stringify(m.thresholds) : null,
        options: m.options ? JSON.stringify(m.options) : null,
        hash: snap.hash,
      },
    });
  }

  // --- Alerts (idempotent by id) --------------------------------------------
  for (const a of bundle.alerts) {
    const titleR = redactString(a.title);
    const findingR = a.finding ? redactString(a.finding) : { value: null, redacted: false };
    const monitorId = a.monitorId && monitorIds.has(a.monitorId) ? a.monitorId : null;
    const redacted = titleR.redacted || findingR.redacted;
    await prisma.alertFire.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        monitorId,
        source: a.source,
        title: titleR.value,
        priority: a.priority,
        status: a.status,
        disposition: a.disposition,
        firingKind: a.firingKind,
        firedAt: a.firedAt,
        resolvedAt: a.resolvedAt,
        ackedBy: a.ackedBy,
        ackLatencySec: a.ackLatencySec,
        escalationStatus: a.escalationStatus,
        env: a.env,
        cluster: a.cluster,
        timesFired: a.timesFired,
        finding: findingR.value,
        redacted,
        firstRunId: runId,
        lastRunId: runId,
      },
      update: {
        monitorId,
        status: a.status,
        disposition: a.disposition,
        firingKind: a.firingKind,
        resolvedAt: a.resolvedAt,
        ackedBy: a.ackedBy,
        ackLatencySec: a.ackLatencySec,
        escalationStatus: a.escalationStatus,
        timesFired: a.timesFired,
        finding: findingR.value,
        redacted,
        lastRunId: runId,
      },
    });
  }

  // --- Incidents (idempotent by id) -----------------------------------------
  for (const inc of bundle.incidents) {
    const titleR = redactString(inc.title);
    await prisma.incident.upsert({
      where: { id: inc.id },
      create: {
        id: inc.id,
        title: titleR.value,
        severity: inc.severity,
        classification: inc.classification,
        service: inc.service,
        status: inc.status,
        openedAt: inc.openedAt,
        resolvedAt: inc.resolvedAt,
        url: inc.url,
        redacted: titleR.redacted,
      },
      update: {
        title: titleR.value,
        severity: inc.severity,
        classification: inc.classification,
        status: inc.status,
        resolvedAt: inc.resolvedAt,
        redacted: titleR.redacted,
      },
    });
  }

  // --- Recommendations (ledger merge; rows never deleted) -------------------
  for (const r of bundle.recommendations) {
    const monitorId = r.monitorId && monitorIds.has(r.monitorId) ? r.monitorId : null;
    const existing = await prisma.tuningRecommendation.findUnique({
      where: {
        monitorKey_issueType: { monitorKey: r.monitorKey, issueType: r.issueType },
      },
    });

    // weeksSeen streak: bump only when we cross into a new window.
    let weeksSeen = r.weeksSeen ?? 1;
    let firstSeen = now;
    if (existing) {
      firstSeen = existing.firstSeen;
      const crossedWeek = existing.lastUpdated < window.start;
      weeksSeen = existing.weeksSeen + (crossedWeek ? 1 : 0);
      if (r.weeksSeen && r.weeksSeen > weeksSeen) weeksSeen = r.weeksSeen;
    }

    const computed = computeStatus(weeksSeen, r.firesThisWeek, r.nightPages ?? 0);
    // Respect a curated/higher incoming status; never downgrade a feedback state.
    const feedbackStates: string[] = [
      RecommendationStatus.Applied,
      RecommendationStatus.Validated,
      RecommendationStatus.Regressed,
    ];
    let status: string = computed;
    if ((STATUS_RANK[r.status] ?? 0) > (STATUS_RANK[computed] ?? 0)) {
      status = r.status;
    }
    if (existing && feedbackStates.includes(existing.status)) {
      status = existing.status;
    }

    await prisma.tuningRecommendation.upsert({
      where: {
        monitorKey_issueType: { monitorKey: r.monitorKey, issueType: r.issueType },
      },
      create: {
        monitorId,
        monitorKey: r.monitorKey,
        monitorName: r.monitorName,
        service: r.service,
        issueType: r.issueType,
        title: r.title,
        before: r.before,
        after: r.after,
        changeSummary: r.changeSummary,
        coveragePreserved: r.coveragePreserved,
        expectedImpact: r.expectedImpact,
        evidence: r.evidence,
        confidence: r.confidence,
        status,
        firstSeen,
        weeksSeen,
        firesThisWeek: r.firesThisWeek,
        autoResolvedPct: r.autoResolvedPct,
        nightPages: r.nightPages ?? 0,
        lastFiredAt: r.lastFiredAt,
        lastUpdated: now,
        patchJson: r.patch ? JSON.stringify(r.patch) : null,
      },
      update: {
        monitorId,
        monitorName: r.monitorName,
        service: r.service,
        title: r.title,
        before: r.before,
        after: r.after,
        changeSummary: r.changeSummary,
        coveragePreserved: r.coveragePreserved,
        expectedImpact: r.expectedImpact,
        evidence: r.evidence,
        confidence: r.confidence,
        status,
        weeksSeen,
        firesThisWeek: r.firesThisWeek,
        autoResolvedPct: r.autoResolvedPct,
        nightPages: r.nightPages ?? 0,
        lastFiredAt: r.lastFiredAt,
        lastUpdated: now,
        patchJson: r.patch ? JSON.stringify(r.patch) : null,
      },
    });
  }

  // --- KPIs ------------------------------------------------------------------
  const windowAlerts = bundle.alerts.filter((a) => a.firedAt >= window.start);
  const totalAlerts = windowAlerts.length;
  const highAlerts = windowAlerts.filter((a) => a.priority === "High").length;
  const humanAttention = windowAlerts.filter(
    (a) => a.disposition === "required_human_attention",
  ).length;
  const autoResolved = windowAlerts.filter(
    (a) => a.disposition === "auto_resolved",
  ).length;
  const activeFiring = bundle.alerts.filter(
    (a) => a.firingKind === FiringKind.Active,
  ).length;
  const staleFiring = bundle.alerts.filter(
    (a) => a.firingKind === FiringKind.Stale,
  ).length;
  const incidentsCount = bundle.incidents.length;
  const runRateWeekly = Math.round((totalAlerts / window.daysElapsed) * 7);

  const priorRun = await prisma.ingestionRun.findFirst({
    where: { status: "success", NOT: { id: runId } },
    orderBy: { startedAt: "desc" },
  });
  const priorWeekTotal = priorRun?.runRateWeekly
    ? Math.round(priorRun.runRateWeekly)
    : (priorRun?.totalAlerts ?? null);
  let trend = "n/a";
  if (priorWeekTotal != null) {
    trend =
      runRateWeekly > priorWeekTotal
        ? "up"
        : runRateWeekly < priorWeekTotal
          ? "down"
          : "flat";
  }

  const kpis: KpiSummary = {
    totalAlerts,
    highAlerts,
    lowAlerts: totalAlerts - highAlerts,
    humanAttention,
    autoResolved,
    incidentsCount,
    escalationRateNum: incidentsCount,
    escalationRateDen: totalAlerts,
    activeFiring,
    staleFiring,
    runRateWeekly,
    priorWeekTotal,
    trend,
  };

  // --- Vulnerabilities -------------------------------------------------------
  if (bundle.vuln) {
    await prisma.vulnerabilitySnapshot.create({
      data: {
        runId,
        total: bundle.vuln.total,
        critical: bundle.vuln.critical,
        high: bundle.vuln.high,
        scope: bundle.vuln.scope,
        source: bundle.vuln.source,
      },
    });
  }

  return {
    kpis,
    monitors: bundle.monitors.length,
    alerts: bundle.alerts.length,
    incidents: bundle.incidents.length,
    recommendations: bundle.recommendations.length,
  };
}
