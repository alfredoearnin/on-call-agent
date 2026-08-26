🔄 **Live page** — refreshed daily during the on-call week (2026-08-25 → 2026-09-01). Last refreshed **2026-08-26 11:04 AM PT (America/Los_Angeles)** (\~25 h / \~1.05 days into the week). This page freezes at the Tuesday handoff (2026-09-01 11:00 America/Mexico_City); a new page opens for the next week.

🔴 **Carry-in from last week — two real, unresolved cashout-volume signals (both re-verified today).** (1) **First-cashout volume drop** — the Aug 7 \~15:00 UTC cliff persists (\~19 days; recent hours \~1–56/hr, with occasional daytime peaks to \~83/hr, vs pre-cliff weekday \~110–198/hr). Monitor [17131362](https://app.datadoghq.com/monitors/17131362) reads OK only because its anomaly model adapted (quiet ≠ recovered). (2) **Funnel-cashout-expirations remain low** — `FunnelCashoutExpired` \~1–13/hr (vs \~20–79/hr earlier); monitor [143509449](https://app.datadoghq.com/monitors/143509449) paged 10× the prior week. Its threshold was tightened `< 5` → `< 2` at the Aug 25 handoff (confirmed live today) and it has **not** fired this week — but that does **not** resolve the underlying drop. **Cause not determined from available signals.** → Investigate both via the Activation runbook / dashboard `kem-tug-987`; open a Jira fix.

# Growth Team Ops Review — Weekly Handoff

**08/26/2026 Growth Team Ops Review** · On-call week **2026-08-25 11:00 → 2026-09-01 11:00** (America/Mexico_City) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-08-26 11:04 AM PT** (\~25 h into the week; live, refreshed daily).

_This on-call week — primary: **Alfred**; secondary: **aiden.ramgoolam** (shift Tue Aug 25 → Tue Sep 1; verified live via_ `schedule_show`_). Next handoff Sep 1: primary **aiden.ramgoolam**, secondary **Edder Núñez**._

_Coverage check: could not be completed (this automation's Slack integration does not expose member out-of-office status) — verify availability manually._

## SLOs / SLAs (15 minutes)

* [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
* [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
* [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — week-to-date (\~25 h / \~1.05 days in):** **1 incident.io High alert record** (fired at Warn, resolved), 0 Low. | **Prior full week (Aug 18–25):** 22 High. | **Trend: run-rate \~7/wk vs prior 22/wk → ↓** (early read — 1 alert over \~1 day; corroborated by 1 week-to-date vs 2 in the prior week's same \~1.05-day slice — both point down). **Human-attention: 1** (acked by Alfred). **Auto-resolved: 0.** **Escalation rate (alerts → incidents): 0/1 (0%).** **Still firing: 0 active / 4 stale** (incident.io; the same lingering orphans carried from last week).

_Priority = monitor severity (High/Low); Warn/Alert = trigger level — a High-priority monitor can fire only at Warn. This week's single alert is exactly that: the High-priority HPA monitor firing at Warn._

## Incidents (15 minutes)

### Production Incidents — Customer Impact

No production incidents this week so far (incident.io `incident_list` for the team = 0). Carry-overs still tracked: the quick-reply dead-button frontend bug (INC-2824, [312932032](https://app.datadoghq.com/monitors/312932032), fix incomplete) and the Anthropic-quota fragility (INC-2795 class, [309355473](https://app.datadoghq.com/monitors/309355473), OK).

### Operational Incidents — Deploys / Data Repairs / Infra

No operational incidents this week so far (0 in incident.io for the team).

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

| Alert | Priority | Service | On-call | Agent Finding |
| --- | --- | --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | <custom data-type="status" data-id="id-0">High</custom> | job-user-setup-user-first-mile-calc-processor | Alfred | **TL;DR:** The first-mile-calc HPA briefly crossed its Warn level (\~80.7% of max replicas) on production-eks-cluster Wed \~9:53 AM PT; Alfred acked and it self-resolved in \~14 min, no customer impact. **What happened:** _Observed_ — High-priority monitor 135119948 (routes `@pagerduty-Activation-Alerts` + `@webhook-incidentio-high`) fired at **Warn** at 2026-08-26 16:53 UTC on **prod** (cluster `production-eks-cluster`, env derived from query scope `cluster_flavor:prod`); replicas ratio ≈ 80.7% (Alert threshold is > 90%). Acked by **Alfred** during working hours; resolved 17:07 UTC (\~14 min later); no incident promoted; monitor now OK. _Likely cause_ — brief autoscaling headroom pressure that scaling absorbed, consistent with the chronic HPA-saturation pattern on this job. This is the recurring HPA tuning candidate (route HIGH → LOW) listed below. |

### Auto-Resolved — Escalation Cancelled

No alerts auto-resolved this week so far (the single alert this week was acked, not auto-cancelled).

### Recurring / Flappy Alerts — Monitor Tuning Candidates

| Alert | Times Fired | Notes |
| --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | 1 this week (Warn, prod, acked) | Recurring across weeks (weeks_seen 8); autoscaling absorbs it, yet a Warn pages like a critical page → route HIGH → LOW (see Tuning Recommendations). |

_Other standing candidates (0 fires yet this week) — funnel-expirations_ [_143509449_](https://app.datadoghq.com/monitors/143509449) _(threshold tightened, outcome watch), the Activation dev-eks OOM leak_ [_133647340_](https://app.datadoghq.com/monitors/133647340)_, the P5-over-routed cron_ [_313314019_](https://app.datadoghq.com/monitors/313314019) _/ svc-mark-tech_ [_301972958_](https://app.datadoghq.com/monitors/301972958)_, and the SQS backlog cluster — are tracked in the Tuning Recommendations below and the_ [_Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577)_._

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [143509449](https://app.datadoghq.com/monitors/143509449) — funnel-cashout expirations low | Real, sustained-low expiration drop paged High overnight — a threshold change was applied at the Aug 25 handoff | 10 fires the prior wk (9 acked / 1 auto-cancel); `FunnelCashoutExpired` \~1–13/hr; **config changed** `< 5` → `< 2` (confirmed live today); 0 fires this wk (\~1 day in — outcome watch continues); weeks_seen 2 | **Applied (threshold 5 → 2).** Reduces overnight paging but does not resolve the underlying drop. Still needed: investigate the throughput drop + retrigger cronjob; if benign low-volume, a min-volume / time-of-day guard is cleaner than a bare threshold. Coverage: a real funnel-cashout outage still pages. **Watching whether the new threshold actually cuts the overnight pages this week.** | high (observed diff) | <custom data-type="status" data-id="id-1">applied</custom> |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM + [133647342](https://app.datadoghq.com/monitors/133647342) mem-util | Activation dev-leak: dev-eks OOM pages prod on-call High — fired 2 days running (Sun + Tue) the prior wk | OOM fired Sun + Tue on dev-eks the prior wk, paged prod High both (acked Edder Núñez); handles still unconditional (re-verified today); 0 fires this wk; weeks_seen 4 | **Gate to prod / clear orphan.** 133647340 — move the High handles inside the prod `is_match` block (mirror 133647342); route dev to a dev Slack. 133647342 — scope out dev + clear the stale orphan. Coverage: prod OOM / memory still page High. | high | <custom data-type="status" data-id="id-2">strongly recommend</custom> |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~19 days (Aug 7 cliff); recent \~1–56/hr vs pre-cliff \~110–198/hr weekday; weeks_seen 4; monitor quiet (model adapting) | **Do NOT tune → investigate.** before: monitor unchanged. after: investigate via Activation runbook (`kem-tug-987`); rule out an Aug 7 \~15:00 UTC deploy/instrumentation change vs a demand regression; open a Jira fix. Coverage: monitor unchanged. | high | <custom data-type="status" data-id="id-3">strongly recommend</custom> |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; a Warn pages like a critical page | Chronic (weeks_seen 8); fired 1× this wk (Warn \~80.7%, prod, acked Alfred, working-hours); config unchanged (re-verified today) | **Route HIGH → LOW / gate to critical.** before: util `> 90` Alert / \~80 Warn → `@webhook-incidentio-high`. after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | <custom data-type="status" data-id="id-4">strongly recommend</custom> |
| [313314019](https://app.datadoghq.com/monitors/313314019) — cronjob-mark-tech-crons cron-run failure | P5 auto-baseline cron monitor over-routed to incident.io High | 3 fires Thu the prior wk; 0 this wk; weeks_seen 2; config unchanged | **Fix the P5→High routing (and/or debounce).** before: Datadog P5; prod branch → `@webhook-incidentio-high`; trips on any 1 failed run in `last_5m`. after: route prod → `@webhook-incidentio-low` / Growth Slack, AND/OR require ≥ 2 consecutive failed runs. Coverage: a genuinely stuck cron still surfaces. | high | <custom data-type="status" data-id="id-5">recommend</custom> |

_Top 5 by expected impact; **full history (21 rows) →**_ [_Monitor Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577)_. Feedback loop (today): all 11 diffable monitors re-read — none changed this run; 143509449 remains at the applied threshold_ `< 2` _(confirmed live), outcome watch continues (0 fires this week); no regression detected. The Ledger is unchanged this run (current as of the Aug 25 roll);_ `weeks_seen` _next rolls at the Sep 1 handoff._

### 🔴 Open Going Into Handoff

**Active Datadog Alert/Warn now: 0.** No Growth-team monitor reads Alert or Warn at the 11:04 AM PT snapshot (verified live via `status:(alert OR warn)`). The week's one alert — the first-mile-calc HPA at Warn (\~9:53 AM PT, acked Alfred) — has self-resolved; the underlying funnel-cashout-expiration drop and the first-cashout volume drop remain real and unresolved.

**Stale / lingering incident.io alerts (need a manual clear, not active prod work): 4** (carried from last week, verified still-firing today):

* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High, since 2026-06-03; Datadog No Data. Code bug → Jira + clear.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low, since 2026-07-23; same bug.
* Activation mem-util ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks group since 2026-05-29; Datadog OK on prod. Dev-scope leak → scope out dev + clear.
* Databricks "Promotions Metrics Processor Job Failed" — High, since 2025-12-17; no live Datadog monitor. Verify job + clear.

**No active prod issues; 4 stale incident.io alert(s) to clear** — plus the real carry-in work: the first-cashout + funnel-expiration drops, the quick-reply frontend bug, the dev-eks OOM leak that paged prod two days running the prior week, and the P5→High over-routing on the cron / svc-mark-tech monitors.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** 25 open (<custom data-type="status" data-id="id-6">4 Critical</custom> / <custom data-type="status" data-id="id-7">21 High</custom>) via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) — **up sharply from 10 on Aug 25** (a fresh SCA scan batch landed today: `js-yaml`, `nanoid`, `postcss`, `brace-expansion`, `fast-uri`, `ddtrace` across WEBPLAT / SV / MOBPLAT / ECD repos, mostly To Do). **org-wide** scope (no Growth-owned ticket; closest is `ACT-2563`, a Datadog.Trace bump in Activation). 4 Criticals: `WEBPLAT-1569` (handlebars), `WEBPLAT-1570` (shell-quote), `WEBPLAT-1571` (@xhmikosr/decompress) — SCA, In Review — plus SAST `EBBUD-3697` (OS-command injection, To Do). 21 High: a large batch of transitive SCA dependency bumps + 2 SAST findings (`QAMRE-1842` anti-forgery, `CXP-1998` file-path). Severity is read from the ticket summary prefix (the Jira priority field is uniformly "Low"). Org-wide + volatile intraday.

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

- [ ] **Escalate the first-cashout volume drop** (\~19 days, well below baseline) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); check the Aug 7 \~15:00 UTC cliff; open a Jira fix. Do NOT tune the monitor.
- [ ] **Investigate the funnel-cashout-expiration drop** ([143509449](https://app.datadoghq.com/monitors/143509449)): check the retrigger-funnel-cashout cronjob + tie to the first-cashout decline. Threshold was tightened `< 5` → `< 2` at the Aug 25 handoff — verify it does not mask a real outage; prefer a min-volume/time-of-day guard.
- [ ] **Fix Activation OOM routing** ([133647340](https://app.datadoghq.com/monitors/133647340)): paged prod on-call High from dev-eks-cluster Sun + Tue the prior wk — move the High handles inside the prod is_match block (mirror 133647342); route dev to a dev Slack. Clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342) + scope out dev.
- [ ] **Tune HPA**[135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate to critical-only); keep OOM / pod-not-ready at HIGH. (Fired again this week — 1× Warn \~80.7% on prod, acked.)
- [ ] **Ship the quick-reply routing fix** (INC-2824; [312932032](https://app.datadoghq.com/monitors/312932032); fix incomplete). Real dead button → frontend Jira, not tuning.
- [ ] **Fix the P5→High over-routing** on the cron ([313314019](https://app.datadoghq.com/monitors/313314019)) and svc-mark-tech ([301972958](https://app.datadoghq.com/monitors/301972958)) baseline monitors; confirm Growth ownership of svc-mark-tech.
- [ ] **Add durable Anthropic-quota protection** for svc-conversational-onboarding (INC-2795 class; [309355473](https://app.datadoghq.com/monitors/309355473)).
- [ ] **Verify OTGE monitor routing** ([111957816](https://app.datadoghq.com/monitors/111957816)): fired \~49 min in prod the prior wk with no handles — add a page/Slack handle.
- [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582)) and clear the 2 stale alerts once shipped.
- [ ] Tune the Activation SQS backlog cluster ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650)): add env:prod + a 10–15 min sustain; verify routing.
- [ ] Verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (\~8 months).
- [ ] Review open vulnerability tickets — now 25 open (4 Critical / 21 High), org-wide (up from 10 on Aug 25).

## 📝 Manual Notes (preserved across refreshes)

_Add notes here; they survive daily refreshes._

---

_Generated by the Growth Team Ops Review agent. Window: 2026-08-25 11:00 → 2026-09-01 11:00 America/Mexico_City (week-to-date, \~25 h in; live, refreshed daily until it freezes at the Sep 1 handoff). Last refreshed: 2026-08-26 11:04 AM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities) — all connectors healthy. Customer identifiers redacted where present (none required this run). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent._
