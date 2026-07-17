import { DateTime } from "luxon";
import { getConfig } from "@/lib/config";
import {
  Priority,
  MonitorState,
  AlertDisposition,
  FiringKind,
  IncidentClass,
  IssueType,
  Confidence,
  RecommendationStatus,
  SourceStatus,
} from "@/lib/constants";
import type { IngestBundle, NormalizedMonitor } from "@/lib/ingest/types";

/**
 * Bundled sample data mirroring real Growth-team monitors (from the on-call.md
 * Confluence reports). Lets the dashboard run with zero credentials and gives
 * the committed SQLite DB meaningful shared "memory" on clone. Times are anchored
 * relative to `now` so the daily view always has recent content.
 */
export function buildDemoBundle(now: Date = new Date()): IngestBundle {
  const tz = getConfig().team.timezone;
  const n = DateTime.fromJSDate(now, { zone: tz });
  const at = (dt: DateTime) => dt.toJSDate();

  const ddUrl = (id: string) =>
    `${getConfig().datadog.appBase}/monitors/${id}`;

  const monitors: NormalizedMonitor[] = [
    {
      id: "135119948",
      name: "[job-user-setup-user-first-mile-calc-processor] HPA has sustained high utilization",
      service: "job-user-setup-user-first-mile-calc-processor",
      priority: Priority.High,
      tags: ["team:l2-peng-growth", "env:prod"],
      state: MonitorState.OK,
      query:
        "avg(last_5m):avg:kubernetes.hpa.current_replicas{cluster_flavor:prod} / avg:kubernetes.hpa.max_replicas{cluster_flavor:prod} * 100 > 90",
      message:
        "HPA sustained high utilization. @pagerduty-Activation-Alerts @webhook-incidentio-high",
      datadogUrl: ddUrl("135119948"),
      envScope: "prod",
      cluster: "production-eks-cluster",
    },
    {
      id: "27555488",
      name: "svc-referral has an abnormal change in Apdex on env:prod",
      service: "svc-referral",
      priority: Priority.High,
      tags: ["team:l2-peng-growth", "env:prod"],
      state: MonitorState.OK,
      query:
        "avg(last_5m):trace.aspnet_core.request.apdex.by.service{env:prod,service:svc-referral} < 0.9",
      message:
        "svc-referral Apdex abnormal. @pagerduty-Referral @webhook-incidentio-high @slack-referral-alerts",
      datadogUrl: ddUrl("27555488"),
      envScope: "prod",
      cluster: "production-eks-cluster",
    },
    {
      id: "143507582",
      name: "CM has requested more than one funnel cashout",
      service: "job-cashout-user-cashout-status-processor",
      priority: Priority.High,
      tags: ["team:l2-peng-growth", "env:prod"],
      state: MonitorState.NoData,
      query:
        "logs(\"service:job-cashout-user-cashout-status-processor duplicate funnel cashout userid\").index(\"*\").rollup(\"count\").last(\"5m\") > 0",
      message: "Duplicate funnel cashout. @webhook-incidentio-high",
      datadogUrl: ddUrl("143507582"),
      envScope: "prod",
    },
    {
      id: "133647342",
      name: "[job-user-user-activation-processor] sustained high memory utilization",
      service: "job-user-user-activation-processor",
      priority: Priority.High,
      tags: ["team:l2-peng-growth"],
      state: MonitorState.OK,
      query:
        "avg(last_5m):avg:kubernetes.memory.usage_pct{*} by {kube_cluster_name} > 85",
      message: "Sustained high memory. @webhook-incidentio-high",
      datadogUrl: ddUrl("133647342"),
      envScope: "mixed",
      cluster: "dev-eks-cluster",
    },
    {
      id: "17131362",
      name: "First Cashout Volume is acting strange!",
      service: "activation-first-cashout",
      priority: Priority.Low,
      tags: ["team:l2-peng-growth", "env:prod"],
      state: MonitorState.OK,
      query:
        "avg(last_2h):anomalies(sum:user.action.cashout{isfirstcashout:true,env:prod}.as_count(), 'agile', 4, direction='below', seasonality='weekly') >= 1",
      message: "First cashout volume anomaly. @webhook-incidentio-low",
      datadogUrl: ddUrl("17131362"),
      envScope: "prod",
    },
    {
      id: "137629294",
      name: "[first-mile-calc] Processor Message Backlog",
      service: "job-user-setup-user-first-mile-calc-processor",
      priority: Priority.High,
      tags: ["team:l2-peng-growth"],
      state: MonitorState.OK,
      query:
        "avg(last_5m):avg:aws.sqs.approximate_age_of_oldest_message{queuename:first-mile-new-user-score} > 90",
      message: "Processor backlog. @pagerduty-Activation-Alerts @webhook-incidentio-high",
      datadogUrl: ddUrl("137629294"),
      envScope: "unscoped",
    },
  ];

  const alerts = [
    // Fired today — HPA Warn, acked, self-resolved.
    {
      id: "01KXNXK70HQ6ZNK22C702XW6AJ",
      monitorId: "135119948",
      source: "incident.io",
      title:
        "[job-user-setup-user-first-mile-calc-processor] HPA has sustained high utilization",
      priority: Priority.High,
      status: "resolved",
      disposition: AlertDisposition.RequiredHumanAttention,
      firingKind: FiringKind.Resolved,
      firedAt: at(n.minus({ hours: 3 })),
      resolvedAt: at(n.minus({ hours: 3 }).plus({ minutes: 11 })),
      ackedBy: "Alfred",
      ackLatencySec: 19,
      escalationStatus: "acknowledged",
      env: "prod",
      cluster: "production-eks-cluster",
      timesFired: 1,
      finding:
        "Observed: fired at Warn (HPA util 82.3%) in production-eks-cluster; acked ~19s; self-resolved ~11 min; no incident. Likely cause: transient prod HPA saturation the autoscaler absorbed.",
    },
    // Fired today — first-cashout anomaly, Low, auto-resolved.
    {
      id: "01KXAS-DEMO-FIRSTCASHOUT-TODAY",
      monitorId: "17131362",
      source: "incident.io",
      title: "First Cashout Volume is acting strange!",
      priority: Priority.Low,
      status: "resolved",
      disposition: AlertDisposition.AutoResolved,
      firingKind: FiringKind.Resolved,
      firedAt: at(n.minus({ hours: 6 })),
      resolvedAt: at(n.minus({ hours: 6 }).plus({ minutes: 8 })),
      escalationStatus: "cancelled",
      env: "prod",
      timesFired: 1,
      finding:
        "Observed: anomaly fired below weekly-seasonal prediction; auto-resolved ~8 min, no ack, no incident. Likely weekend-seasonality sensitivity.",
    },
    // Yesterday — svc-referral Apdex night page, auto-resolved ~1 min.
    {
      id: "01KXN9EMZQXFX6B51JXNWD2FWV",
      monitorId: "27555488",
      source: "incident.io",
      title: "svc-referral has an abnormal change in Apdex on env:prod",
      priority: Priority.High,
      status: "resolved",
      disposition: AlertDisposition.AutoResolved,
      firingKind: FiringKind.Resolved,
      firedAt: at(n.minus({ days: 1 }).set({ hour: 4, minute: 2 })),
      resolvedAt: at(n.minus({ days: 1 }).set({ hour: 4, minute: 3 })),
      escalationStatus: "cancelled",
      env: "prod",
      timesFired: 1,
      finding:
        "Observed: fired 04:02 PT, auto-resolved ~1 min, no ack, no incident. Likely a transient overnight Apdex dip at low traffic.",
    },
    // Stale carryover — duplicate cashout (code bug), firing since Jun 3.
    {
      id: "01KT752A4WBQQ6AKYNP8AB4AD6",
      monitorId: "143507582",
      source: "incident.io",
      title: "CM has requested more than one funnel cashout",
      priority: Priority.High,
      status: "firing",
      firingKind: FiringKind.Stale,
      firedAt: at(DateTime.fromISO("2026-06-03T16:29:00", { zone: tz })),
      env: "prod",
      timesFired: 1,
      finding:
        "Stale: incident.io firing since 2026-06-03 while Datadog reads No Data. Duplicate-cashout code bug -> Jira fix + resolve/mute.",
    },
    // Stale carryover — dev-cluster memory, firing since May 29.
    {
      id: "01KST6RVJA4YYGHZS07M0N1T7V",
      monitorId: "133647342",
      source: "incident.io",
      title:
        "[job-user-user-activation-processor] sustained high memory utilization",
      priority: Priority.High,
      status: "firing",
      firingKind: FiringKind.Stale,
      firedAt: at(DateTime.fromISO("2026-05-29T00:00:00", { zone: tz })),
      env: "dev",
      cluster: "dev-eks-cluster",
      timesFired: 1,
      finding:
        "Stale: firing since 2026-05-29 on dev-eks-cluster (non-prod); prod reads OK. Orphaned dev-cluster fire -> clear it.",
    },
    // Stale carryover — Databricks (no Datadog monitor), firing since Dec 17.
    {
      id: "01KCMWX2WHXP5F7R8KHHG3693E",
      monitorId: undefined,
      source: "incident.io",
      title: "Databricks — Promotions Metrics Processor Job Failed",
      priority: Priority.High,
      status: "firing",
      firingKind: FiringKind.Stale,
      firedAt: at(DateTime.fromISO("2025-12-17T00:00:00", { zone: tz })),
      env: "prod",
      timesFired: 1,
      finding:
        "Stale: firing since 2025-12-17 (>6 months); no live Datadog monitor. Verify the Promotions Metrics job has since succeeded, then resolve.",
    },
  ];

  const recommendations = [
    {
      monitorId: "135119948",
      monitorKey: "135119948",
      monitorName: "HPA sustained high utilization (first-mile-calc)",
      service: "job-user-setup-user-first-mile-calc-processor",
      issueType: IssueType.InfraSaturationAutoscaled,
      title:
        "Infra saturation autoscaling handles — a High page that self-resolves in minutes; a Warn transition pages like a critical page.",
      before:
        "util >90 Alert / ~80 Warn -> @webhook-incidentio-high + @pagerduty-Activation-Alerts; a Warn transition pages the same as Alert.",
      after:
        "route the sustained-utilization branch -> @webhook-incidentio-low (or gate the page to is_alert/critical only); keep OOM / pod-not-ready at HIGH.",
      changeSummary: "Route HIGH -> LOW (or gate Warn out of paging).",
      coveragePreserved: "A genuine capacity pin still pages HIGH.",
      expectedImpact: "Removes ~2-3 interrupt-grade High pages/wk.",
      evidence:
        "1 fire this wk (Warn 82.3%, acked ~19s, self-resolved ~11 min, no incident); recurring ~3 wks; 0 incidents.",
      confidence: Confidence.High,
      status: RecommendationStatus.StronglyRecommend,
      firesThisWeek: 1,
      weeksSeen: 3,
      autoResolvedPct: 0,
      nightPages: 0,
      lastFiredAt: at(n.minus({ hours: 3 })),
      patch: {
        target: "message" as const,
        prod: {
          find: "@webhook-incidentio-high",
          replace: "@webhook-incidentio-low",
        },
        dev: {
          find: "@webhook-incidentio-high",
          replace: "@webhook-incidentio-low",
        },
      },
    },
    {
      monitorId: "133647342",
      monitorKey: "133647342",
      monitorName: "activation-processor sustained high memory",
      service: "job-user-user-activation-processor",
      issueType: IssueType.DevNoisePagingProd,
      title:
        "Dev noise paging the prod High path + stale — a dev-eks-cluster group firing since May 29 while prod reads OK.",
      before:
        "mem-util >=85% grouped by kube_cluster_name — a dev-cluster group can hold the prod High page open.",
      after:
        "exclude non-prod (add cluster_flavor:prod / !kube_cluster_name:dev-eks-cluster); route any dev branch to a dev Slack; then clear the orphaned dev alert.",
      changeSummary: "Scope out dev + clear the orphan.",
      coveragePreserved: "Prod memory-utilization still pages High.",
      expectedImpact: "Clears 1 stuck High; stops dev pressure paging prod.",
      evidence: "Firing ~7 wks; dev-eks group; prod OK; 0 new fires this wk.",
      confidence: Confidence.High,
      status: RecommendationStatus.StronglyRecommend,
      firesThisWeek: 0,
      weeksSeen: 4,
      patch: {
        target: "query" as const,
        prod: {
          find: "by {kube_cluster_name} > 85",
          replace:
            "by {kube_cluster_name} , cluster_flavor:prod !kube_cluster_name:dev-eks-cluster > 85",
        },
      },
    },
    {
      monitorId: "143507582",
      monitorKey: "143507582",
      monitorName: "duplicate funnel cashout",
      service: "job-cashout-user-cashout-status-processor",
      issueType: IssueType.RecurringRealFailure,
      title:
        "Recurring REAL failure, not monitor noise — a duplicate funnel-cashout code bug; alert also stuck (Datadog No Data).",
      before: "monitor left as-is (it is catching a real condition).",
      after:
        "open/track a Jira fix for the duplicate funnel-cashout bug (runbook SRE/3082453072); once shipped, resolve or mute the stale alert.",
      changeSummary: "Do NOT tune — route to a Jira code fix.",
      coveragePreserved: "Monitor unchanged, so it keeps catching duplicates.",
      expectedImpact: "Eliminates a recurring High + a months-old stuck alert.",
      evidence: "Firing ~6 wks (since Jun 3); Datadog No Data.",
      confidence: Confidence.High,
      status: RecommendationStatus.StronglyRecommend,
      firesThisWeek: 0,
      weeksSeen: 4,
      // No patch: this is a code fix, not a monitor edit.
    },
    {
      monitorId: "27555488",
      monitorKey: "27555488",
      monitorName: "svc-referral Apdex abnormal change",
      service: "svc-referral",
      issueType: IssueType.VolatileDenominator,
      title:
        "Transient overnight Apdex dip paging High — a 1-min self-resolving blip at low-traffic hours.",
      before:
        "avg(last_5m) apdex{env:prod,service:svc-referral} < 0.9 -> HIGH (@pagerduty-Referral + @webhook-incidentio-high).",
      after:
        "require the breach to be sustained (last_5m -> last_15m or >=2 consecutive windows) and/or add a minimum request-volume guard; or route sub-15-min dips to Low.",
      changeSummary: "Debounce and/or add a volume guard.",
      coveragePreserved: "A sustained real Apdex degradation still pages High.",
      expectedImpact: "Removes overnight High pages from 1-min blips.",
      evidence: "1 fire this wk (04:02 PT, auto-resolved ~1 min, no ack).",
      confidence: Confidence.Low,
      status: RecommendationStatus.Proposed,
      firesThisWeek: 1,
      weeksSeen: 1,
      autoResolvedPct: 100,
      nightPages: 1,
      lastFiredAt: at(n.minus({ days: 1 }).set({ hour: 4, minute: 2 })),
      patch: {
        target: "query" as const,
        prod: { find: "last_5m", replace: "last_15m" },
      },
    },
    {
      monitorId: "137629294",
      monitorKey: "137629294",
      monitorName: "first-mile-calc Processor Message Backlog",
      service: "job-user-setup-user-first-mile-calc-processor",
      issueType: IssueType.ThresholdTooLoose,
      title:
        "Flappy backlog, no env scope, no sustain — Datadog-only noise routing to the prod High path.",
      before:
        "SQS oldest-age >90s Alert, no env scope, no sustain -> incidentio-high + PagerDuty.",
      after:
        "add env:prod + a sustain >=5-10 min (self-clears in ~2-4 min); if the backlog is real -> Jira capacity for the processor.",
      changeSummary: "Add scope + sustain.",
      coveragePreserved: "A sustained real backlog still alerts.",
      expectedImpact: "Removes flappy High pages from transient backlog blips.",
      evidence: "Flapped ~27x in a prior week; 0 incident.io pages; OK now.",
      confidence: Confidence.Medium,
      status: RecommendationStatus.Recommend,
      firesThisWeek: 0,
      weeksSeen: 2,
      patch: {
        target: "query" as const,
        prod: {
          find: "{queuename:first-mile-new-user-score}",
          replace: "{queuename:first-mile-new-user-score,env:prod}",
        },
      },
    },
    {
      monitorId: undefined,
      monitorKey: "databricks-promotions-metrics",
      monitorName: "Databricks — Promotions Metrics Processor Job Failed",
      service: "databricks-earnin-prod",
      issueType: IssueType.StaleNonResolving,
      title:
        "Stale / non-auto-resolving alert source — a one-off job-failure notification firing since Dec 17 2025.",
      before: "http_custom job-failure alert never auto-resolves and lingers.",
      after:
        "confirm the Promotions Metrics job has since succeeded, then resolve; if it cannot auto-resolve, reconfigure/deprecate it.",
      changeSummary: "Verify + clear; fix auto-resolve.",
      coveragePreserved: "Real job failures still notify.",
      expectedImpact: "Clears a 7-month stuck High + a false still-firing signal.",
      evidence: "Firing ~7 mo (since 2025-12-17); no live Datadog monitor.",
      confidence: Confidence.Medium,
      status: RecommendationStatus.Recommend,
      firesThisWeek: 0,
      weeksSeen: 6,
    },
    {
      monitorId: "17131362",
      monitorKey: "17131362",
      monitorName: "First Cashout Volume anomaly",
      service: "activation-first-cashout",
      issueType: IssueType.VolatileDenominator,
      title:
        "Anomaly flapping — weekend clustering leans toward weekly-seasonality sensitivity over a sustained conversion dip.",
      before:
        "fires when first-cashout volume runs >4 std-dev below the weekly-seasonal prediction over last_2h -> Low.",
      after:
        "add weekend seasonality and/or lengthen last_2h -> last_4h; verify baseline on dashboard kem-tug-987 before widening the deviation bound.",
      changeSummary: "Reduce anomaly sensitivity (verify baseline first).",
      coveragePreserved: "A real sustained drop still trips widened bounds.",
      expectedImpact: "Could remove most weekend Low pages if it is seasonality.",
      evidence: "13 fires two weeks ago (7 over the weekend); quiet since.",
      confidence: Confidence.Medium,
      status: RecommendationStatus.Recommend,
      firesThisWeek: 1,
      weeksSeen: 2,
      lastFiredAt: at(n.minus({ hours: 6 })),
      patch: {
        target: "query" as const,
        prod: { find: "last_2h", replace: "last_4h" },
      },
    },
  ];

  return {
    monitors,
    alerts,
    incidents: [], // no production/operational incidents in the sample window
    recommendations,
    vuln: {
      total: 32,
      critical: 12,
      high: 20,
      scope: "org-wide",
      source: "Jira filter 15295",
    },
    schedule: {
      primary: "Alfred",
      secondary: "aiden.ramgoolam",
      nextPrimary: "aiden.ramgoolam",
      nextSecondary: "Edder Núñez",
    },
    sourceStatus: {
      datadog: SourceStatus.OK,
      incidentio: SourceStatus.OK,
      jira: SourceStatus.OK,
    },
    notes: "Demo mode — bundled sample data (no live credentials used).",
  };
}
