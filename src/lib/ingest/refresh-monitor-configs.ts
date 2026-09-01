/**
 * Overlay live Datadog monitor config onto whatever weekly source just
 * persisted. Confluence must not clobber query/message, but it also never
 * *reads* Datadog — without this pass, a Save in the Datadog UI is invisible
 * until someone forces SYNC_SOURCE=live.
 */

import { prisma } from "@/lib/db";
import { getConfig, hasDatadogRead } from "@/lib/config";
import { DatadogClient } from "@/lib/clients/datadog";
import { HttpError } from "@/lib/clients/http";
import { redactDeep, redactString } from "@/lib/redact";
import { hashMonitorConfig, thresholdsFromOptions } from "@/lib/monitor-config";
import { mapMonitors } from "@/lib/ingest/sources/live";

/**
 * `forbidden` is called out separately from `unavailable` because it is the
 * one an operator can act on: the app key's user is missing `audit_logs_read`.
 */
export type AuditStatus = "ok" | "forbidden" | "unavailable" | "skipped";

export interface ConfigRefreshResult {
  updated: number;
  snapshots: number;
  audit: AuditStatus;
}

export async function refreshMonitorConfigsFromDatadog(
  runId: string,
): Promise<ConfigRefreshResult> {
  const cfg = getConfig();
  const empty: ConfigRefreshResult = { updated: 0, snapshots: 0, audit: "skipped" };
  if (cfg.demoMode) return empty;
  if (!hasDatadogRead(cfg)) return empty;

  const dd = new DatadogClient(cfg);
  const raw = await dd.listMonitors();
  const monitors = mapMonitors(raw, dd);
  const now = new Date();

  let actors = new Map<string, { name: string; at: Date }>();
  let audit: AuditStatus = "skipped";
  try {
    const from = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    actors = await dd.searchMonitorAuditActors(from, now);
    audit = "ok";
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 0;
    audit = status === 401 || status === 403 ? "forbidden" : "unavailable";
  }

  let updated = 0;
  let snapshots = 0;

  for (const m of monitors) {
    const message = m.message ? redactString(m.message).value : null;
    // options carries escalation_message, which is notify text like `message`.
    const options = m.options ? redactDeep(m.options).value : m.options;
    const thresholds = m.thresholds ?? thresholdsFromOptions(options);
    const hash = hashMonitorConfig({
      query: m.query,
      message,
      priority: m.priority,
      thresholds,
      options,
    });
    const actor = actors.get(m.id);
    const actorName = actor?.name ?? null;
    const actorAt = actor?.at ?? null;

    const existing = await prisma.monitor.findUnique({ where: { id: m.id } });
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
      updated += 1;
    } else {
      await prisma.monitor.update({
        where: { id: m.id },
        data: {
          name: m.name,
          service: m.service,
          tags: JSON.stringify(m.tags),
          currentState: m.state,
          query: m.query,
          message,
          priority: m.priority,
          configHash: hash,
          datadogUrl: m.datadogUrl,
          envScope: m.envScope,
          cluster: m.cluster,
          modifiedAt: m.modifiedAt,
          lastSeenAt: now,
        },
      });
      updated += 1;
    }

    const lastSnap = await prisma.monitorConfigSnapshot.findFirst({
      where: { monitorId: m.id },
      orderBy: { capturedAt: "desc" },
    });

    if (lastSnap?.hash === hash) {
      if (actorName && !lastSnap.actorName) {
        await prisma.monitorConfigSnapshot.update({
          where: { id: lastSnap.id },
          data: { actorName, actorAt },
        });
      }
      continue;
    }

    await prisma.monitorConfigSnapshot.create({
      data: {
        monitorId: m.id,
        runId,
        query: m.query ?? null,
        message,
        priority: m.priority,
        thresholds: thresholds ? JSON.stringify(thresholds) : null,
        options: options ? JSON.stringify(options) : null,
        hash,
        actorName,
        actorAt,
      },
    });
    snapshots += 1;
  }

  return { updated, snapshots, audit };
}
