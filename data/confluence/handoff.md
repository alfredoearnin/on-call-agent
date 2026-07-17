# Growth Team Ops Review — Weekly Handoff

**07/17/2026 Growth Team Ops Review** · On-call week **Tue 2026-07-14 00:00 → Tue 2026-07-21 00:00 (America/Los_Angeles)**, reported **week-to-date (window start → now, ~3.3 days in)**. Source: incident.io + Datadog, read-only. **Last refreshed: 2026-07-17 08:02 AM PT (America/Los_Angeles).**

_This on-call week — primary: **Alfred**; secondary: **aiden.ramgoolam** (shift Tue 2026-07-14 10:00 PT → Tue 2026-07-21 10:00 PT). Next handoff Tue 2026-07-21 10:00 PT → primary **aiden.ramgoolam**, secondary **Edder Núñez**. Verified via incident.io schedule this run._

## SLOs / SLAs (15 minutes)

* [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
* [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
* [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Auto-generated alert-volume summary (week-to-date, ~3.3 days into the on-call week).** incident.io paging alerts: **2 total** so far (2 High, 0 Low) — both resolved. Prior full week (Jul 7 → Jul 14): **16 (2 High, 14 Low)** — all resolved. Trend: **run-rate ~4/wk vs prior 16/wk → ↓**. Human-attention: **1** | Auto-resolved: **1**. Escalation rate (alerts → incidents): **0/2 (0%)**. Still firing: **0 active / 3 stale** (incident.io) — the 3 stale are carryover alerts (see Open Going Into Handoff); no Growth monitor is in Alert/Warn at refresh time.

## Incidents (15 minutes)

### Production Incidents — Customer Impact

No production incidents this week.

### Operational Incidents — Deploys / Data Repairs / Infra

No operational incidents this week.

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

| Alert | Priority | Service | On-call | Agent Finding |
| --- | --- | --- | --- | --- |
| [**Monitor 135119948**](https://app.datadoghq.com/monitors/135119948) — "[job-user-setup-user-first-mile-calc-processor] HPA has sustained high utilization" · incident.io alert 01KXNXK70HQ6ZNK22C702XW6AJ | <custom data-type="status" data-id="id-0">High</custom> | `job-user-setup-user-first-mile-calc-processor` | Alfred (primary) | **Observed:** fired 2026-07-16 09:53 PT (16:53 UTC) at **Warn** — HPA utilization 82.3% in `production-eks-cluster`; Alfred acked ~19s later; auto-resolved ~11 min later at 10:04 PT; no incident promoted; monitor currently OK. **Likely cause:** transient prod HPA saturation the autoscaler absorbed. This is the standing HIGH→LOW tuning candidate. |

### Auto-Resolved — Escalation Cancelled

* [**Monitor 27555488**](https://app.datadoghq.com/monitors/27555488) **— "svc-referral has an abnormal change in Apdex on env:prod"** (<custom data-type="status" data-id="id-1">High</custom>, service `svc-referral`). incident.io alert 01KXN9EMZQXFX6B51JXNWD2FWV. **Agent Finding — Observed:** fired 2026-07-16 04:02 PT (11:02 UTC), auto-resolved ~1 min later at 04:03 PT; escalation `cancelled` (no human ack); no incident promoted; monitor currently OK. **Likely cause:** a transient overnight Apdex dip at low traffic.

### Recurring / Flappy Alerts — Monitor Tuning Candidates

| Alert | Times Fired | Notes |
| --- | --- | --- |
| [**135119948**](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization (env:prod, High) | 1× this week (Jul 16, Warn) + 2× last week | Work-hours High page that Alfred acked and autoscaling self-resolved in ~11 min; no incident. Standing HIGH→LOW candidate. |
| [**27555488**](https://app.datadoghq.com/monitors/27555488) — svc-referral Apdex abnormal change (env:prod, High) | 1× this week (Jul 16) | High night page at 04:02 PT that auto-resolved in ~1 min with no human ack. |

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [**135119948**](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization (job-user-setup-user-first-mile-calc-processor, env:prod) | Infra saturation that autoscaling already handles — a High page that self-resolves in minutes with no incident. | 1 fire this wk (Jul 16, Warn 82.3%, acked ~19s, self-resolved ~11 min); recurring ~3 wks; 0 incidents. | **Route HIGH → LOW (and/or gate the page to critical-only).** before: sustained-utilization → `@webhook-incidentio-high` + `@pagerduty-Activation-Alerts` (prod branch). after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. _Coverage preserved:_ a genuine capacity pin still pages HIGH. _Impact:_ removes ~2–3 interrupt-grade High pages/wk. | High — 3-wk streak, fired again + human-acked this wk, 100% self-resolve, 0 incidents. | <custom data-type="status" data-id="id-2">strongly recommend</custom> |
| [**133647342**](https://app.datadoghq.com/monitors/133647342) — [job-user-user-activation-processor] sustained high memory utilization | Dev noise paging the prod High path + stale — a dev-eks-cluster group firing since May 29 while prod reads OK. | Firing ~7 wks (since 2026-05-29), dev-eks-cluster group; Datadog OK on prod; 0 new fires this wk. | **Scope out dev + clear the orphan.** before: mem-util ≥85% grouped by `kube_cluster_name`. after: exclude non-prod (add `cluster_flavor:prod` / `!kube_cluster_name:dev-eks-cluster`); route any dev branch to a dev Slack; then manually resolve the orphaned dev alert. _Coverage preserved:_ prod memory-utilization still pages High. _Impact:_ clears 1 stuck High. | High — clear dev-scope leak; prod reads OK. | <custom data-type="status" data-id="id-3">strongly recommend</custom> |
| [**143507582**](https://app.datadoghq.com/monitors/143507582) — CM has requested more than one funnel cashout (job-cashout-user-cashout-status-processor) | Recurring REAL failure, not monitor noise — a duplicate funnel-cashout code/business-logic bug. | Firing ~6 wks (since 2026-06-03); Datadog No Data. | **Do NOT tune — route to a Jira code fix.** before: monitor left as-is (it is catching a real condition). after: open/track a Jira fix for the duplicate funnel-cashout bug; once shipped, resolve or mute the stale alert. _Coverage preserved:_ monitor unchanged, so it keeps catching duplicates. _Impact:_ eliminates a recurring High. | High — it is a bug, not noise. | <custom data-type="status" data-id="id-4">strongly recommend</custom> |
| [**27555488**](https://app.datadoghq.com/monitors/27555488) — svc-referral has an abnormal change in Apdex (env:prod) | Transient overnight Apdex dip paging High — a 1-min self-resolving blip at low-traffic hours. | 1 fire this wk (04:02 PT, auto-resolved ~1 min, no ack); no recurrence since. | **Debounce and/or add a volume guard (or route transient dips to Low).** before: `avg(last_5m) apdex < 0.9` → HIGH. after: require the breach to be sustained — `last_5m` → `last_15m` or ≥2 consecutive eval windows; and/or add a minimum request-volume guard. _Coverage preserved:_ a sustained real Apdex degradation still pages High. _Impact:_ removes overnight High pages from 1-min blips. | Low — single fire, no recurrence yet. | <custom data-type="status" data-id="id-5">proposed</custom> |
| **Databricks — Promotions Metrics Processor Job Failed** (earnin-prod; no Datadog monitor) — alert 01KCMWX2W… | Stale / non-auto-resolving alert source — firing since Dec 17 2025 (~7 months). | Firing ~7 mo (since 2025-12-17); no live Datadog monitor. | **Verify + clear; fix auto-resolve.** before: the http_custom job-failure alert never auto-resolves and lingers. after: confirm the Promotions Metrics job has since succeeded, then resolve the alert; if the source cannot auto-resolve, reconfigure or deprecate it. _Coverage preserved:_ real job failures still notify. _Impact:_ clears a 7-month stuck High. | Medium — needs job verification. | <custom data-type="status" data-id="id-6">recommend</custom> |

### 🔴 Open Going Into Handoff

**Active prod Alert/Warn now: 0.** No Growth-owned monitor is in Alert/Warn at refresh time.

**Stale / lingering incident.io alerts: 3** (carried from prior weeks):

* **Monitor 143507582 — "CM has requested more than one funnel cashout"** (<custom data-type="status" data-id="id-7">High</custom>). incident.io alert 01KT752A4WBQQ6AKYNP8AB4AD6, firing since 2026-06-03. Datadog: <custom data-type="status" data-id="id-8">NO DATA</custom>. Duplicate-cashout code bug → Jira fix + resolve/mute.
* **Monitor 133647342 — "[job-user-user-activation-processor] sustained high memory utilization"** (<custom data-type="status" data-id="id-9">High</custom>). incident.io alert 01KST6RVJA4YYGHZS07M0N1T7V, firing since 2026-05-29 on `dev-eks-cluster` (non-prod). Datadog: OK on prod. Orphaned dev-cluster fire → clear it.
* **Databricks "Promotions Metrics Processor Job" — run failed** (workspace earnin-prod, <custom data-type="status" data-id="id-10">High</custom>). incident.io alert 01KCMWX2WHXP5F7R8KHHG3693E, firing since 2025-12-17 (>6 months). No live Datadog monitor. Verify the job has since succeeded → resolve.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** **32 open tickets** (org-wide scope; count as of 2026-07-17 via Jira filter 15295) — **12 Critical, 20 High**. Down from 37 on Jul 16.

## Action Items

- [ ] Review the Monitor Tuning Recommendations (top 5) and the Monitor Tuning Ledger.
- [ ] Route HPA 135119948 High → Low (fired again + human-acked this week).
- [ ] Clear stale: duplicate funnel cashout (monitor 143507582), dev-cluster memory (133647342), Databricks Promotions-Metrics.

## 📝 Manual Notes (preserved across refreshes)

_Add notes here; they survive daily refreshes._
