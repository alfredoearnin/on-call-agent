import "server-only";
import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { dayKey } from "@/lib/format";
import { AlertDisposition, FiringKind, IncidentClass } from "@/lib/constants";

export async function getSyncSettings() {
  return prisma.syncSettings.findUnique({ where: { id: "singleton" } });
}

export async function getLatestRun() {
  return prisma.ingestionRun.findFirst({
    where: { status: { in: ["success", "partial"] } },
    orderBy: { startedAt: "desc" },
  });
}

export async function getRuns(limit = 20) {
  return prisma.ingestionRun.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

/** Trend series (oldest -> newest) for the Overview charts. */
export async function getTrendSeries(limit = 30) {
  const runs = await prisma.ingestionRun.findMany({
    where: { status: { in: ["success", "partial"] } },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
  return runs.reverse();
}

export async function getLatestVuln() {
  return prisma.vulnerabilitySnapshot.findFirst({
    orderBy: { capturedAt: "desc" },
  });
}

export async function getActiveAndStaleAlerts() {
  const [active, stale] = await Promise.all([
    prisma.alertFire.findMany({
      where: { firingKind: FiringKind.Active },
      orderBy: { firedAt: "desc" },
      include: { monitor: true },
    }),
    prisma.alertFire.findMany({
      where: { firingKind: FiringKind.Stale },
      orderBy: { firedAt: "asc" },
      include: { monitor: true },
    }),
  ]);
  return { active, stale };
}

/** Distinct local days (newest first) that have alert activity. */
export async function getActivityDays(): Promise<string[]> {
  const tz = getConfig().team.timezone;
  const alerts = await prisma.alertFire.findMany({
    select: { firedAt: true },
    orderBy: { firedAt: "desc" },
    take: 500,
  });
  const set = new Set<string>();
  for (const a of alerts) set.add(dayKey(a.firedAt, tz));
  return [...set];
}

export interface DailyData {
  day: string;
  requiredHumanAttention: Awaited<ReturnType<typeof fetchAlertsForDay>>;
  autoResolved: Awaited<ReturnType<typeof fetchAlertsForDay>>;
  other: Awaited<ReturnType<typeof fetchAlertsForDay>>;
  incidents: Awaited<ReturnType<typeof fetchIncidentsForDay>>;
  days: string[];
}

async function fetchAlertsForDay(dayISO: string) {
  const tz = getConfig().team.timezone;
  const start = DateTime.fromISO(dayISO, { zone: tz }).startOf("day");
  const end = start.endOf("day");
  return prisma.alertFire.findMany({
    where: { firedAt: { gte: start.toJSDate(), lte: end.toJSDate() } },
    orderBy: { firedAt: "desc" },
    include: { monitor: true },
  });
}

async function fetchIncidentsForDay(dayISO: string) {
  const tz = getConfig().team.timezone;
  const start = DateTime.fromISO(dayISO, { zone: tz }).startOf("day");
  const end = start.endOf("day");
  return prisma.incident.findMany({
    where: { openedAt: { gte: start.toJSDate(), lte: end.toJSDate() } },
    orderBy: { openedAt: "desc" },
  });
}

export async function getDailyData(dayISO?: string): Promise<DailyData> {
  const days = await getActivityDays();
  const tz = getConfig().team.timezone;
  const day = dayISO ?? days[0] ?? (DateTime.now().setZone(tz).toISODate() as string);

  const alerts = await fetchAlertsForDay(day);
  const incidents = await fetchIncidentsForDay(day);

  return {
    day,
    requiredHumanAttention: alerts.filter(
      (a) => a.disposition === AlertDisposition.RequiredHumanAttention,
    ),
    autoResolved: alerts.filter(
      (a) => a.disposition === AlertDisposition.AutoResolved,
    ),
    other: alerts.filter((a) => !a.disposition),
    incidents,
    days,
  };
}

const STATUS_ORDER: Record<string, number> = {
  "strongly-recommend": 0,
  regressed: 1,
  recommend: 2,
  applied: 3,
  proposed: 4,
  validated: 5,
  resolved: 6,
};

export async function getRecommendations() {
  const recs = await prisma.tuningRecommendation.findMany({
    include: { monitor: true },
  });
  return recs.sort(
    (a, b) =>
      (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
      b.weeksSeen - a.weeksSeen,
  );
}

export async function getRecommendationById(id: string) {
  return prisma.tuningRecommendation.findUnique({
    where: { id },
    include: { monitor: true, appliedChanges: { orderBy: { appliedAt: "desc" } } },
  });
}

export async function getMonitorDetail(id: string) {
  return prisma.monitor.findUnique({
    where: { id },
    include: {
      alerts: { orderBy: { firedAt: "desc" }, take: 50 },
      recommendations: true,
      appliedChanges: { orderBy: { appliedAt: "desc" } },
      snapshots: { orderBy: { capturedAt: "desc" }, take: 20 },
    },
  });
}

export async function getProductionIncidents(runWindowStart?: Date) {
  return prisma.incident.findMany({
    where: {
      classification: IncidentClass.ProductionCustomerImpact,
      ...(runWindowStart ? { openedAt: { gte: runWindowStart } } : {}),
    },
    orderBy: { openedAt: "desc" },
  });
}
