import "server-only";
import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { getConfig, hasCloudAutomations } from "@/lib/config";
import { dayKey } from "@/lib/format";
import {
  AlertDisposition,
  AutomationKey,
  FiringKind,
  IncidentClass,
  RunStatus,
  TriggerStatus,
} from "@/lib/constants";
import { readGitEvidence } from "@/lib/automations/git-evidence";
import { assessAutomations, type AutomationHealth } from "@/lib/automations/health";

export async function getSyncSettings() {
  return prisma.syncSettings.findUnique({ where: { id: "singleton" } });
}

export async function getLatestRun() {
  return prisma.ingestionRun.findFirst({
    where: { status: { in: ["success", "partial"] } },
    orderBy: { startedAt: "desc" },
  });
}

/**
 * The newest run of ANY finished status.
 *
 * getLatestRun() filters to success|partial, so after a failed run it returns an
 * older one — and quoting that row's page stamp as "the latest look" would
 * overstate how recently the handoff page was seen. Automation health needs the
 * newest row, whatever its status.
 */
export async function getLatestRunAnyStatus() {
  return prisma.ingestionRun.findFirst({
    where: { status: { not: RunStatus.Running } },
    orderBy: { startedAt: "desc" },
  });
}

export async function getRuns(limit = 20) {
  return prisma.ingestionRun.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

/** Summary of the data source + freshness for the Settings page. */
export async function getSourceSummary() {
  const [latest, weekRows] = await Promise.all([
    getLatestRun(),
    prisma.alertFire.findMany({
      where: { weekStart: { not: null } },
      select: { weekStart: true },
      distinct: ["weekStart"],
    }),
  ]);
  return { weeksIngested: weekRows.length, latest };
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

/** All still-firing carryover alerts (stale), longest-firing first. */
export async function getCarryoverAlerts() {
  return prisma.alertFire.findMany({
    where: { firingKind: FiringKind.Stale },
    orderBy: { firedAt: "asc" },
    include: { monitor: true },
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

export interface WeekOption {
  start: string;
  end: string;
  label: string;
  days: string[];
}

export interface DailyView {
  weeks: WeekOption[];
  selectedWeek: string;
  selectedDay: string;
  requiredHumanAttention: Awaited<ReturnType<typeof fetchAlertsForDay>>;
  autoResolved: Awaited<ReturnType<typeof fetchAlertsForDay>>;
  other: Awaited<ReturnType<typeof fetchAlertsForDay>>;
  incidents: Awaited<ReturnType<typeof fetchIncidentsForDay>>;
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

/**
 * Weeks come from the handoff window each alert was tagged with (weekStart),
 * so navigation matches the Confluence pages — not scattered by alert fire dates.
 * Within a week: "new fires" (non-stale, fired inside the window) are day-filterable;
 * stale carryover alerts are always shown.
 */
export async function getDailyView(
  weekISO?: string,
  dayISO?: string,
): Promise<DailyView> {
  const tz = getConfig().team.timezone;

  const idx = await prisma.alertFire.findMany({
    where: { weekStart: { not: null } },
    select: { weekStart: true, weekEnd: true, firedAt: true, firingKind: true },
  });

  interface Wk {
    startDate: Date;
    endDate: Date;
    days: Set<string>;
  }
  const byWeek = new Map<string, Wk>();
  for (const a of idx) {
    if (!a.weekStart) continue;
    const id = dayKey(a.weekStart, tz);
    let wk = byWeek.get(id);
    if (!wk) {
      const endDate =
        a.weekEnd ?? new Date(a.weekStart.getTime() + 7 * 86_400_000);
      wk = { startDate: a.weekStart, endDate, days: new Set() };
      byWeek.set(id, wk);
    }
    const within = a.firedAt >= wk.startDate && a.firedAt < wk.endDate;
    if (a.firingKind !== FiringKind.Stale && within) {
      wk.days.add(dayKey(a.firedAt, tz));
    }
  }

  const weeks: WeekOption[] = [...byWeek.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([id, wk]) => ({
      start: id,
      end: dayKey(wk.endDate, tz),
      label: `${DateTime.fromJSDate(wk.startDate, { zone: tz }).toFormat("MMM d")} – ${DateTime.fromJSDate(wk.endDate, { zone: tz }).toFormat("MMM d")}`,
      days: [...wk.days].sort().reverse(),
    }));

  let selectedWeek = weekISO && byWeek.has(weekISO) ? weekISO : weeks[0]?.start;
  if (!selectedWeek) {
    selectedWeek = dayKey(DateTime.now().setZone(tz).toJSDate(), tz);
    weeks.unshift({ start: selectedWeek, end: selectedWeek, label: "This week", days: [] });
  }

  const wk = byWeek.get(selectedWeek);
  const dayOptions = weeks.find((w) => w.start === selectedWeek)?.days ?? [];
  // Default to the whole week ("all"); a specific day narrows the view.
  const selectedDay =
    dayISO && dayISO !== "all" && dayOptions.includes(dayISO) ? dayISO : "all";

  const weekAlerts = wk
    ? await prisma.alertFire.findMany({
        where: { weekStart: wk.startDate },
        orderBy: { firedAt: "desc" },
        include: { monitor: true },
      })
    : [];
  const incidents = wk
    ? await prisma.incident.findMany({
        where: { weekStart: wk.startDate },
        orderBy: { openedAt: "desc" },
      })
    : [];

  const newFires = weekAlerts.filter((a) => a.firingKind !== FiringKind.Stale);
  const carryover = weekAlerts.filter((a) => a.firingKind === FiringKind.Stale);
  const dayFires =
    selectedDay === "all"
      ? newFires
      : newFires.filter((a) => dayKey(a.firedAt, tz) === selectedDay);

  return {
    weeks,
    selectedWeek,
    selectedDay,
    requiredHumanAttention: dayFires.filter(
      (a) => a.disposition === AlertDisposition.RequiredHumanAttention,
    ),
    autoResolved: dayFires.filter(
      (a) => a.disposition === AlertDisposition.AutoResolved,
    ),
    other: carryover,
    incidents,
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

/**
 * Evidence-derived health of the two cloud Cursor Automations.
 *
 * Returns [] in demo and live mode: there are no automations feeding those, so
 * inventing a verdict about them would be a fabrication.
 */
export async function getAutomationHealth(
  now: Date = new Date(),
): Promise<AutomationHealth[]> {
  const cfg = getConfig();
  if (!hasCloudAutomations(cfg)) return [];

  const [git, run] = await Promise.all([
    readGitEvidence(),
    getLatestRunAnyStatus(),
  ]);

  return assessAutomations({
    now,
    schedule: cfg.automations,
    git,
    page: {
      refreshedAt: run?.handoffRefreshedAt ?? undefined,
      refreshedText: run?.handoffRefreshedText ?? undefined,
      runStartedAt: run?.startedAt,
      runStatus: run?.status,
      noRun: !run,
    },
  });
}

/** The most recent trigger fired from this dashboard, per automation. */
export async function getLastAutomationTriggers(): Promise<
  Record<AutomationKey, { id: string; triggeredAt: Date; status: string } | null>
> {
  const [healthCheck, dashboardRefresh] = await Promise.all(
    [AutomationKey.HealthCheck, AutomationKey.DashboardRefresh].map((key) =>
      prisma.automationTrigger.findFirst({
        where: { automationKey: key, status: TriggerStatus.Triggered },
        orderBy: { triggeredAt: "desc" },
        select: { id: true, triggeredAt: true, status: true },
      }),
    ),
  );
  return {
    [AutomationKey.HealthCheck]: healthCheck,
    [AutomationKey.DashboardRefresh]: dashboardRefresh,
  };
}

/** Recent trigger attempts, for the Settings run log. */
export async function getAutomationTriggers(limit = 10) {
  return prisma.automationTrigger.findMany({
    orderBy: { triggeredAt: "desc" },
    take: limit,
  });
}
