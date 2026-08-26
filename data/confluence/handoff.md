🔄 **Live page** — refreshed daily during the on-call week (2026-08-25 → 2026-09-01). Last refreshed **2026-08-25 2:18 PM PT (America/Los_Angeles)** (\~4 h / \~0.18 days into the week). This page freezes at the Tuesday handoff (2026-09-01 11:00 America/Mexico_City); a new page opens for the next week.

🔴 **Carry-in from last week — two real, unresolved cashout-volume signals.** (1) **First-cashout volume drop** — the Aug 7 \~15:00 UTC cliff persists (\~18 days; recent hours \~1–40/hr with occasional daytime peaks \~53–83/hr vs pre-cliff weekday \~110–198/hr). Monitor [17131362](https://app.datadoghq.com/monitors/17131362) reads OK only because its anomaly model adapted (quiet ≠ recovered). (2) **Funnel-cashout-expirations remain low** — `FunnelCashoutExpired` \~1–13/hr (vs \~20–79/hr earlier); monitor [143509449](https://app.datadoghq.com/monitors/143509449) paged 10× last week. Its threshold was tightened `< 5` → `< 2` at this handoff, which should reduce paging but does **not** resolve the drop. **Cause not determined from available signals.** → Investigate both via the Activation runbook / dashboard `kem-tug-987`; open a Jira fix.

# Growth Team Ops Review — Weekly Handoff

**08/25/2026 Growth Team Ops Review** · On-call week **2026-08-25 11:00 → 2026-09-01 11:00** (America/Mexico_City) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-08-25 2:18 PM PT** (\~4 h into the week; live, refreshed daily).

_This on-call week — primary: **Alfred**; secondary: **aiden.ramgoolam** (shift Tue Aug 25 → Tue Sep 1; verified live via_ `schedule_show`_). Next handoff Sep 1: primary **aiden.ramgoolam**, secondary **Edder Núñez**._

_Coverage check: could not be completed (this automation's Slack integration does not expose member out-of-office status) — verify availability manually._

## SLOs / SLAs (15 minutes)

* [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
* [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
* [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — week-to-date (\~4 h / \~0.18 days in):** **0 incident.io High alert records**, 0 Low. | **Prior full week (Aug 18–25):** 22 High. | **Trend: too early to call** (only \~4 h into the week; a run-rate is not meaningful below one day elapsed). **Human-attention: 0.** **Auto-resolved: 0.** **Escalation rate (alerts → incidents): 0/0.** **Still firing: 0 active / 4 stale** (incident.io; the same lingering orphans carried from last week). _Note: the two early-Tuesday fires (funnel-expirations \~1:03 AM PT + dev-eks OOM \~3:18 AM PT) occurred before the 10:00 AM PT / 17:00 UTC handoff and are charged to **last week** (shashank's shift), per the handoff-boundary rule — see the_ [_frozen Aug 18 → 25 page_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5425135649)_._

_Priority = monitor severity (High/Low); Warn/Alert = trigger level — a High-priority monitor can fire only at Warn._

## Incidents (15 minutes)

### Production Incidents — Customer Impact

No production incidents this week so far (incident.io `incident_list` for the team = 0; Datadog-native incident search = 0). Carry-overs still tracked: the quick-reply dead-button frontend bug (INC-2824, [312932032](https://app.datadoghq.com/monitors/312932032), fix incomplete) and the Anthropic-quota fragility (INC-2795 class, [309355473](https://app.datadoghq.com/monitors/309355473), OK).

### Operational Incidents — Deploys / Data Repairs / Infra

No operational incidents this week so far (0 in incident.io for the team; 0 in Datadog-native incident search).

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

No alerts required human attention this week so far (0 incident.io records week-to-date, \~4 h in).

### Auto-Resolved — Escalation Cancelled

No alerts auto-resolved this week so far.

### Recurring / Flappy Alerts — Monitor Tuning Candidates

No recurring/flappy alerts have fired yet this week. Standing candidates carried from last week — funnel-cashout-expirations [143509449](https://app.datadoghq.com/monitors/143509449) (threshold just tightened, outcome watch), the Activation dev-eks OOM leak [133647340](https://app.datadoghq.com/monitors/133647340), HPA [135119948](https://app.datadoghq.com/monitors/135119948), the P5-over-routed cron [313314019](https://app.datadoghq.com/monitors/313314019) / svc-mark-tech [301972958](https://app.datadoghq.com/monitors/301972958), and the SQS backlog cluster — are tracked in the Tuning Recommendations below and the [Ledger](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577).

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [143509449](https://app.datadoghq.com/monitors/143509449) — funnel-cashout expirations low | Real, sustained-low expiration drop paged High overnight — a threshold change was applied at this handoff | 10 fires last wk (9 acked / 1 auto-cancel); `FunnelCashoutExpired` \~1–13/hr; **config changed** `< 5` → `< 2` (observed Tue handoff); 0 fires yet this wk (\~4 h in — outcome watch begins); weeks_seen 2 | **Applied (threshold 5 → 2).** Reduces overnight paging but does not resolve the underlying drop. Still needed: investigate the throughput drop + retrigger cronjob; if benign low-volume, a min-volume / time-of-day guard is cleaner than a bare threshold. Coverage: a real funnel-cashout outage still pages. **Watching whether the new threshold actually cuts the overnight pages next week.** | high (observed diff) | <custom data-type="status" data-id="id-0">applied</custom> |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM + [133647342](https://app.datadoghq.com/monitors/133647342) mem-util | Activation dev-leak: dev-eks OOM pages prod on-call High — fired 2 days running (Sun + Tue) last wk | OOM fired Sun + Tue on dev-eks last wk, paged prod High both (acked Edder Núñez); handles still unconditional; weeks_seen 4; config unchanged (re-verified today) | **Gate to prod / clear orphan.** 133647340 — move the High handles inside the prod `is_match` block (mirror 133647342); route dev to a dev Slack. 133647342 — scope out dev + clear the stale orphan. Coverage: prod OOM / memory still page High. | high | <custom data-type="status" data-id="id-1">strongly recommend</custom> |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~18 days (Aug 7 cliff); recent \~1–40/hr vs pre-cliff \~110–198/hr weekday; weeks_seen 4; monitor quiet (model adapting) | **Do NOT tune → investigate.** before: monitor unchanged. after: investigate via Activation runbook (`kem-tug-987`); rule out an Aug 7 \~15:00 UTC deploy/instrumentation change vs a demand regression; open a Jira fix. Coverage: monitor unchanged. | high | <custom data-type="status" data-id="id-2">strongly recommend</custom> |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; a Warn pages like a critical page | Chronic (3 Warn last wk; weeks_seen 8); 0 fires yet this wk; config unchanged | **Route HIGH → LOW / gate to critical.** before: util `> 90` Alert / \~80 Warn → `@webhook-incidentio-high`. after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | <custom data-type="status" data-id="id-3">strongly recommend</custom> |
| [313314019](https://app.datadoghq.com/monitors/313314019) — cronjob-mark-tech-crons cron-run failure | P5 auto-baseline cron monitor over-routed to incident.io High | 3 fires Thu last wk; 0 yet this wk; weeks_seen 2; config unchanged | **Fix the P5→High routing (and/or debounce).** before: Datadog P5; prod branch → `@webhook-incidentio-high`; trips on any 1 failed run in `last_5m`. after: route prod → `@webhook-incidentio-low` / Growth Slack, AND/OR require ≥ 2 consecutive failed runs. Coverage: a genuinely stuck cron still surfaces. | high | <custom data-type="status" data-id="id-4">recommend</custom> |

_Top 5 by expected impact; **full history (21 rows) →**_ [_Monitor Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577)_. Feedback loop: of the 11 diffable monitors, **143509449 changed (threshold < 5 → < 2) this handoff — recorded as applied, outcome watch begins**; the other 10 remain unchanged vs their recorded before-state. No regression detected._

### 🔴 Open Going Into Handoff

**Active Datadog Alert/Warn now: 0.** No Growth-team monitor reads Alert or Warn at the 2:18 PM PT snapshot (verified live via `status:(alert OR warn)`). The two early-Tuesday fires (funnel \~1:03 AM PT, dev-eks OOM \~3:18 AM PT — both charged to last week) have self-resolved; the underlying funnel-cashout-expiration drop and the first-cashout volume drop remain real and unresolved.

**Stale / lingering incident.io alerts (need a manual clear, not active prod work): 4** (carried from last week, verified still-firing):

* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High, since 2026-06-03; Datadog No Data. Code bug → Jira + clear.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low, since 2026-07-23; same bug.
* Activation mem-util ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks group since 2026-05-29; Datadog OK on prod. Dev-scope leak → scope out dev + clear.
* Databricks "Promotions Metrics Processor Job Failed" — High, since 2025-12-17; no live Datadog monitor. Verify job + clear.

**No active prod issues; 4 stale incident.io alert(s) to clear** — plus the real carry-in work: the first-cashout + funnel-expiration drops, the quick-reply frontend bug, the dev-eks OOM leak that paged prod two days running last week, and the P5→High over-routing on the cron / svc-mark-tech monitors.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** 10 open (<custom data-type="status" data-id="id-5">4 Critical</custom> / <custom data-type="status" data-id="id-6">6 High</custom>) via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) — **org-wide** scope (no Growth-owned ticket; closest is `ACT-2563`, a Datadog.Trace bump). 4 Criticals: `WEBPLAT-1569` (handlebars), `WEBPLAT-1570` (shell-quote), `WEBPLAT-1571` (@xhmikosr/decompress) — SCA, all To Do — plus SAST `EBBUD-3697` (OS-command injection, To Do). 6 High: transitive SCA bumps (`brace-expansion` WEBPLAT-1484; `Datadog.Trace` ACT-2563; `jackson-core` KMONO-51; `jackson-databind` KMONO-49) + SAST (`QAMRE-1842` anti-forgery, `CXP-1998` file-path). Org-wide + volatile intraday.

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

- [ ] **Escalate the first-cashout volume drop** (\~18 days, well below baseline) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); check the Aug 7 \~15:00 UTC cliff; open a Jira fix. Do NOT tune the monitor.
- [ ] **Investigate the funnel-cashout-expiration drop** ([143509449](https://app.datadoghq.com/monitors/143509449)): check the retrigger-funnel-cashout cronjob + tie to the first-cashout decline. Threshold was tightened `< 5` → `< 2` this handoff — verify it does not mask a real outage; prefer a min-volume/time-of-day guard.
- [ ] **Fix Activation OOM routing** ([133647340](https://app.datadoghq.com/monitors/133647340)): paged prod on-call High from dev-eks-cluster Sun + Tue last wk — move the High handles inside the prod is_match block (mirror 133647342); route dev to a dev Slack. Clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342) + scope out dev.
- [ ] **Ship the quick-reply routing fix** (INC-2824; [312932032](https://app.datadoghq.com/monitors/312932032); fix incomplete). Real dead button → frontend Jira, not tuning.
- [ ] **Fix the P5→High over-routing** on the cron ([313314019](https://app.datadoghq.com/monitors/313314019)) and svc-mark-tech ([301972958](https://app.datadoghq.com/monitors/301972958)) baseline monitors; confirm Growth ownership of svc-mark-tech.
- [ ] **Add durable Anthropic-quota protection** for svc-conversational-onboarding (INC-2795 class; [309355473](https://app.datadoghq.com/monitors/309355473)).
- [ ] **Verify OTGE monitor routing** ([111957816](https://app.datadoghq.com/monitors/111957816)): fired \~49 min in prod last wk with no handles — add a page/Slack handle.
- [ ] Tune HPA [135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate to critical-only); keep OOM / pod-not-ready at HIGH.
- [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582)) and clear the 2 stale alerts once shipped.
- [ ] Tune the Activation SQS backlog cluster ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650)): add env:prod + a 10–15 min sustain; verify routing.
- [ ] Verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (\~8 months).
- [ ] Review open vulnerability tickets — 10 open (4 Critical / 6 High), org-wide.

## 📝 Manual Notes (preserved across refreshes)

_Add notes here; they survive daily refreshes._

---

_Generated by the Growth Team Ops Review agent. Window: 2026-08-25 11:00 → 2026-09-01 11:00 America/Mexico_City (week-to-date, \~4 h in; live, refreshed daily until it freezes at the Sep 1 handoff). Last refreshed: 2026-08-25 2:18 PM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities) — all connectors healthy. Customer identifiers redacted where present (none required this run). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent._
