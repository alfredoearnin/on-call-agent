# Growth Team Ops Review — Weekly Handoff

**07/20/2026 Growth Team Ops Review** · On-call week **Tue 2026-07-14 00:00 → Tue 2026-07-21 00:00 (America/Los_Angeles)**, reported **week-to-date (window start → now, ~6.3 days in)**. Source: incident.io + Datadog, read-only. **Last refreshed: 2026-07-20 08:02 AM PT (America/Los_Angeles).**

_This on-call week — primary: **Alfred**; secondary: **aiden.ramgoolam** (shift Tue 2026-07-14 10:00 PT → Tue 2026-07-21 10:00 PT). Next handoff Tue 2026-07-21 10:00 PT → primary **aiden.ramgoolam**, secondary **Edder Núñez**. Verified via incident.io schedule this run._

## SLOs / SLAs (15 minutes)

* [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
* [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
* [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Auto-generated alert-volume summary (week-to-date, ~6.3 days into the on-call week).** incident.io paging alerts: **5 total** so far (3 High, 2 Low) — all resolved. Prior full week (Jul 7 → Jul 14): **16 (2 High, 14 Low)** — all resolved. Trend: **run-rate ~6/wk vs prior 16/wk → ↓**. Human-attention: **2** | Auto-resolved: **3**. Escalation rate (alerts → incidents): **0/5 (0%)**. Still firing: **0 active / 3 stale** (incident.io) — the 3 stale are carryover alerts (see Open Going Into Handoff); no Growth monitor is in Alert/Warn at refresh time. **3 new alerts since the last refresh (Sun–Mon):** a `svc-notification-preferences` latency blip on Sun Jul 19 ~11:18 AM PT that double-fired (High p90 acked by Alfred + Low avg auto-resolved), and a `job-cashout-attempt-restore-event-processor` error-rate blip Mon Jul 20 02:30 AM PT (Low, auto-resolved).

## Incidents (15 minutes)

### Production Incidents — Customer Impact

No production incidents this week.

### Operational Incidents — Deploys / Data Repairs / Infra

No operational incidents this week.

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

| Alert | Priority | Service | On-call | Agent Finding |
| --- | --- | --- | --- | --- |
| [**Monitor 135119948**](https://app.datadoghq.com/monitors/135119948) — "[job-user-setup-user-first-mile-calc-processor] HPA has sustained high utilization" · incident.io alert 01KXNXK70HQ6ZNK22C702XW6AJ | <custom data-type="status" data-id="id-0">High</custom> | `job-user-setup-user-first-mile-calc-processor` | Alfred (primary) | **Observed:** fired 2026-07-16 09:53 PT (16:53 UTC) at **Warn** — HPA utilization 82.3% in `production-eks-cluster`; Alfred acked ~19s later; auto-resolved ~11 min later at 10:04 PT; no incident promoted; monitor currently OK with no further fires in the ~4 days since. Routes `@pagerduty-Activation-Alerts` + `@webhook-incidentio-high` (prod branch). **Env: prod** — `production-eks-cluster`. **Likely cause:** transient prod HPA saturation the autoscaler absorbed. Standing HIGH→LOW tuning candidate. |
| [**Monitor 243692163**](https://app.datadoghq.com/monitors/243692163) — "Service svc-notification-preferences has a high p90 latency on env:prod" · incident.io alert 01KXXSPNAQSVMKFYNQKMPC0S8F | <custom data-type="status" data-id="id-1">High</custom> | `svc-notification-preferences` | Alfred (primary) | **Observed:** fired 2026-07-19 11:18 AM PT (18:18 UTC, Sunday) at **Warn** — p90 request latency crossed the Warn threshold (~0.8s; the Alert/critical threshold is p90 > 1s) on `env:prod`; Alfred acked ~1m48s later at 11:21 AM PT; auto-resolved ~9 min after firing; no incident; monitor currently OK. Routes `@webhook-incidentio-high` (unconditional — a Warn crossing pages High). **Likely cause:** a brief Sunday late-morning p90 latency spike that recovered on its own within ~9 min; the Low avg-latency companion monitor `243692043` fired on the same blip. New Warn-paging-as-High tuning candidate. |

### Auto-Resolved — Escalation Cancelled

* [**Monitor 27555488**](https://app.datadoghq.com/monitors/27555488) **— "svc-referral has an abnormal change in Apdex on env:prod"** (<custom data-type="status" data-id="id-2">High</custom>, service `svc-referral`). incident.io alert 01KXN9EMZQXFX6B51JXNWD2FWV. **Agent Finding — Observed:** fired 2026-07-16 04:02 PT (11:02 UTC), auto-resolved ~1 min later at 04:03 PT; escalation `cancelled` (no human ack); no incident; monitor currently OK with no recurrence since. **Likely cause:** a transient overnight Apdex dip at low traffic.
* [**Monitor 243692043**](https://app.datadoghq.com/monitors/243692043) **— "Service svc-notification-preferences has a high average latency on env:prod"** (<custom data-type="status" data-id="id-3">Low</custom>, service `svc-notification-preferences`). incident.io alert 01KXXSPNH9M8E7WD31HHEFVC15. **Agent Finding — Observed:** fired 2026-07-19 11:18 AM PT (18:18 UTC, Sunday), auto-resolved ~9 min later; escalation `cancelled` (no human ack); no incident. Routes `@webhook-incidentio-low`. **Likely cause:** the Low avg-latency companion to the High p90 alert above — tripped on the same brief latency blip and recovered on its own.
* [**Monitor 143557417**](https://app.datadoghq.com/monitors/143557417) **— "[job-cashout-attempt-restore-event-processor] Message Processing Error Rate is too high!"** (<custom data-type="status" data-id="id-4">Low</custom>, service `job-cashout-attempt-restore-event-processor`). incident.io alert 01KXZDVSQ471AYTN84RY7M67T1. **Agent Finding — Observed:** fired 2026-07-20 02:30 AM PT (09:30 UTC, Monday), auto-resolved ~4 min later; escalation `cancelled` (no human ack); no incident; monitor currently OK. Routes `@pagerduty-growth-low-urgency` + `@webhook-incidentio-low`. **Likely cause:** a short burst pushed the SQS error ratio `sum(last_10m) errors/hits > 0.25` past 25% and cleared within minutes; the query has no `env:prod` scope and no minimum-volume guard. New tuning candidate.

### Recurring / Flappy Alerts — Monitor Tuning Candidates

| Alert | Times Fired | Notes |
| --- | --- | --- |
| [**135119948**](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization (env:prod, High) | 1× this week (Jul 16, Warn) + 2× last week | Work-hours High page that Alfred acked and autoscaling self-resolved in ~11 min; no incident; no re-fire since. Standing HIGH→LOW candidate. |
| [**243692163**](https://app.datadoghq.com/monitors/243692163) — svc-notification-preferences high p90 latency (env:prod, High) | 1× this week (Jul 19, Warn) — new candidate | High page on a Sunday (11:18 AM PT) acked by Alfred; self-resolved ~9 min; no incident. Fired at Warn (~0.8s) yet pages High unconditionally. Co-fired with the Low avg monitor `243692043`. Warn-paging-as-High candidate. |
| [**27555488**](https://app.datadoghq.com/monitors/27555488) — svc-referral Apdex abnormal change (env:prod, High) | 1× this week (Jul 16) | High night page at 04:02 PT that auto-resolved in ~1 min with no human ack. Single fire, no recurrence → "consider". |
| [**143557417**](https://app.datadoghq.com/monitors/143557417) — cashout-attempt-restore message error rate (Low) | 1× this week (Jul 20) | Low alert overnight (02:30 AM PT) auto-resolved ~4 min, no ack. Ratio query has no `env:prod` scope and no min-volume guard. New candidate. |

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [**135119948**](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization (job-user-setup-user-first-mile-calc-processor, env:prod) | Infra saturation that autoscaling already handles — a High page that self-resolves in minutes with no incident. | 1 fire this wk (Jul 16, Warn 82.3%, acked ~19s, self-resolved ~11 min, none since); 2 last wk; recurring ~3 wks; 0 incidents. | **Route HIGH → LOW (and/or gate the page to critical-only).** before: sustained-utilization → `@webhook-incidentio-high` + `@pagerduty-Activation-Alerts` (prod branch). after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. _Coverage preserved:_ a genuine capacity pin still pages HIGH. _Impact:_ removes ~2–3 interrupt-grade High pages/wk. | High — 3-wk streak, 100% self-resolve, 0 incidents. | <custom data-type="status" data-id="id-5">strongly recommend</custom> |
| [**133647342**](https://app.datadoghq.com/monitors/133647342) — [job-user-user-activation-processor] sustained high memory utilization | Dev noise paging the prod High path + stale — a dev-eks-cluster group firing since May 29 while prod reads OK. | Firing ~7 wks (since 2026-05-29), dev-eks-cluster group; Datadog OK on prod; 0 new fires this wk. | **Scope out dev + clear the orphan.** before: mem-util ≥85% grouped by `kube_cluster_name`. after: exclude non-prod (add `cluster_flavor:prod` / `!kube_cluster_name:dev-eks-cluster`); route any dev branch to a dev Slack; then resolve the orphaned dev alert. _Coverage preserved:_ prod memory-utilization still pages High. | High — clear dev-scope leak; prod reads OK. | <custom data-type="status" data-id="id-6">strongly recommend</custom> |
| [**143507582**](https://app.datadoghq.com/monitors/143507582) — CM has requested more than one funnel cashout (job-cashout-user-cashout-status-processor) | Recurring REAL failure, not monitor noise — a duplicate funnel-cashout code/business-logic bug. Also stuck firing (Datadog No Data). | Firing ~6 wks (since 2026-06-03); Datadog No Data; 0 new fires this wk. | **Do NOT tune — route to a Jira code fix.** before: monitor left as-is (it is catching a real condition). after: open/track a Jira fix for the duplicate funnel-cashout bug (runbook SRE/3082453072); once shipped, resolve or mute the stale alert. _Coverage preserved:_ monitor unchanged. _Impact:_ eliminates a recurring High and a months-old stuck alert. | High — it is a bug, not noise. | <custom data-type="status" data-id="id-7">strongly recommend</custom> |
| [**243692163**](https://app.datadoghq.com/monitors/243692163) — svc-notification-preferences high p90 latency (env:prod) | Warn transition paging like a critical page — a High page fired at the Warn threshold (~0.8s p90) even though the critical threshold is p90 > 1s, because the page handle is unconditional. Double-alerts with the Low avg monitor on one blip. | 1 fire this wk (Jul 19 11:18 AM PT Sunday, Warn ~0.8s, acked ~1m48s, self-resolved ~9 min, no incident); new candidate; co-fired with Low avg `243692043`. | **Gate the page to critical-only (or split Warn → Low).** before: p90 > 1 Alert / ~0.8 Warn → `@webhook-incidentio-high` unconditionally, so a Warn crossing pages High. after: wrap the `@webhook-incidentio-high` handle in `{{#is_alert}}` so only the p90 > 1s crossing pages High, and route the Warn tier → Slack/Low. _Coverage preserved:_ a real p90 > 1s latency emergency still pages High. _Impact:_ stops Warn-level latency blips from paging on-call. | Med — clear routing gap; 1 occurrence → "consider". | <custom data-type="status" data-id="id-8">proposed</custom> |
| [**27555488**](https://app.datadoghq.com/monitors/27555488) — svc-referral has an abnormal change in Apdex (env:prod) | Transient overnight Apdex dip paging High — a 1-min self-resolving blip at low-traffic hours, no incident. | 1 fire this wk (04:02 PT, auto-resolved ~1 min, no ack, no incident); no recurrence since. Night page + auto-resolved-no-ack. | **Debounce and/or add a volume guard (or route transient dips to Low).** before: `avg(last_5m) apdex < 0.9` → HIGH. after: require the breach to be sustained (`last_5m` → `last_15m` or ≥2 consecutive windows) and/or add a minimum request-volume guard; or route sub-15-min transient dips → Slack/Low. _Coverage preserved:_ a sustained real Apdex degradation still pages High. | Low — single fire, no recurrence yet. | <custom data-type="status" data-id="id-9">proposed</custom> |

### 🔴 Open Going Into Handoff

**Active prod Alert/Warn now: 0.** No Growth-owned monitor is in Alert/Warn at refresh time.

**Stale / lingering incident.io alerts: 3** (carried from prior weeks):

* **Monitor 143507582 — "CM has requested more than one funnel cashout"** (<custom data-type="status" data-id="id-10">High</custom>). incident.io alert 01KT752A4WBQQ6AKYNP8AB4AD6, firing since 2026-06-03. Datadog: NO DATA. Duplicate-cashout code bug → Jira fix + resolve/mute.
* **Monitor 133647342 — "[job-user-user-activation-processor] sustained high memory utilization"** (<custom data-type="status" data-id="id-11">High</custom>). incident.io alert 01KST6RVJA4YYGHZS07M0N1T7V, firing since 2026-05-29 on `dev-eks-cluster` (non-prod). Datadog: OK on prod. Orphaned dev-cluster fire → clear it.
* **Databricks "Promotions Metrics Processor Job" — run failed** (<custom data-type="status" data-id="id-12">High</custom>). incident.io alert 01KCMWX2WHXP5F7R8KHHG3693E, firing since 2025-12-17 (>6 months). No live Datadog monitor. Verify the job has since succeeded → resolve.

**Handoff status:** **No active prod issues; 3 stale incident.io alert(s) to clear** (all carryover from prior weeks).

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** **30 open tickets** (org-wide scope; count as of 2026-07-20 via Jira filter 15295) — **13 Critical, 17 High**. Up from 29 (11C / 18H) on Jul 19 — two new Critical (`websocket-driver`) appeared and one High cleared. Criticals: 10 `golang.org/x/crypto` + 1 `@xhmikosr/decompress` + 2 new `websocket-driver`. Growth-scoped matches are High SCA advisories on `svc-conversational-onboarding` and `svc-growth-ai-ops`. **Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

- [ ] Review the Monitor Tuning Recommendations (top 5) and the Monitor Tuning Ledger — none applied yet (feedback loop day 7).
- [ ] NEW — svc-notification-preferences p90 latency (monitor 243692163): gate the page to critical-only (`{{#is_alert}}`) and route the Warn tier to Slack/Low.
- [ ] NEW — cashout-attempt-restore error-rate (monitor 143557417): add `env:prod` scope + a minimum-volume guard.
- [ ] Route HPA 135119948 High → Low; scope 133647342 out of dev + clear the orphan; open a Jira code fix for the duplicate-cashout bug 143507582.
- [ ] Clear stale: 143507582 (Jun 3), 133647342 (May 29, dev), Databricks Promotions-Metrics (Dec 17).
- [ ] Vulnerabilities at 30 open org-wide (13 Critical, 17 High): prioritize the `golang.org/x/crypto` cluster (10) and the new `websocket-driver` Criticals (2).

## 📝 Manual Notes (preserved across refreshes)

_Add notes here; they survive daily refreshes._
