🔄 **Live page** — refreshed daily during the on-call week (2026-08-11 → 2026-08-18). Last refreshed **2026-08-11 08:29 AM PT (America/Los_Angeles)**. This page freezes at the Tuesday handoff (2026-08-18); a new page opens for the next week.

⚠️ **incident.io connector unavailable this run** (MCP status `needsAuth` — the outage now spans Aug 5–11). This report is built from **Datadog (read-only) + Jira** only: alerts are Datadog-derived, **ack vs auto-resolved is undeterminable**, and the on-call names + the 4 stale-alert set are **carried from the last incident.io read (Aug 4), unverified**. The new-week on-call handoff (10:00 PT today) could not be verified.

🔴 **Carried real signal — first-cashout volume drop (unresolved).** The First Cashout Volume anomaly ([17131362](https://app.datadoghq.com/monitors/17131362)) fired Aug 7 on a genuine first-cashout drop that has persisted \~4 days into the start of this week: \~10–40/hr vs a \~110–170/hr weekday norm (\~75–85% below), including the full weekday Monday Aug 10 — not weekend seasonality. The monitor is currently quiet (its weekly model is adapting to the sustained low, so it under-reports). **Top priority for this week:** investigate via the Activation runbook (dashboard `kem-tug-987`) and open a Jira fix if a code/product regression is confirmed. Cause not determined from available signals.

# Growth Team Ops Review — Weekly Handoff

**08/11/2026 Growth Team Ops Review** · On-call week **2026-08-11 → 2026-08-18** (Tuesday → Tuesday, America/Los_Angeles) · Sources: incident.io + Datadog (read-only) — incident.io unavailable this run, so alerts are Datadog-derived · Last refreshed: **2026-08-11 08:29 AM PT** (\~8.5 h into the week).

On-call: the week-to-week handoff occurs Tue Aug 11 10:00 PT; the new primary/secondary could not be verified (incident.io connector down). Last week: Primary **Ankur Shivani**, Secondary **Edder Núñez**.

## SLOs / SLAs (15 minutes)

* [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
* [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
* [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume this week (week-to-date, \~8.5 h in):** 0 page-worthy alerts | **Prior full week:** 9 (8 High, 1 Low) | **Trend: too early to call** (only \~8.5 h into the week; a run-rate verdict is not meaningful yet). **Human-attention:** n/a · **Auto-resolved:** n/a (incident.io unavailable). **Escalation rate (alerts → incidents):** 0/0. **Still firing: 0 active / 4 stale** (incident.io, carried/unverified). Total alert-event firehose: **20 events** week-to-date (all Datadog-only backlog noise — first-mile/deactivated SQS + conv-onboarding p99; 0 pages) vs 427 prior full week.

_Priority = monitor severity (High/Low); Warn/Alert = trigger level — a High-priority monitor can fire only at Warn._

## Incidents (15 minutes)

### Production Incidents — Customer Impact

No customer-impact production incidents so far this week (Datadog-native incident search returned 0). _incident.io incident list unavailable — connector returned Unauthorized; verify manually._

### Operational Incidents — Deploys / Data Repairs / Infra

Data unavailable — check incident.io manually (connector returned Unauthorized). Datadog-native incident search returned 0 incidents for the team so far this week.

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

No alerts have required human attention yet this week (\~8.5 h in; 0 page-worthy alerts). incident.io unavailable — ack state undeterminable.

### Auto-Resolved — Escalation Cancelled

No alerts auto-resolved yet this week. incident.io unavailable — auto-resolved vs acknowledged cannot be classified.

### Recurring / Flappy Alerts — Monitor Tuning Candidates

| Alert | Times Fired | Notes |
| --- | --- | --- |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Carried real signal (monitor currently quiet) | Real drop, NOT monitor noise → investigate / Jira; do not tune. Persisted \~4 days incl. weekday Mon Aug 10. |
| [137629294](https://app.datadoghq.com/monitors/137629294) — first-mile SQS backlog | \~10 (week-to-date) | Chronic Datadog-only noise, 0 pages; add env:prod + sustain; verify prod routing. |
| [137629364](https://app.datadoghq.com/monitors/137629364) — deactivated-user SQS backlog | \~8 (week-to-date) | Chronic Datadog-only noise; add env:prod + sustain. |
| [259552001](https://app.datadoghq.com/monitors/259552001) — conv-onboarding p99 latency | \~2 (week-to-date) | P5 Slack-only; add sustain / verify baseline. |

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persisted \~4 days (Aug 7→Aug 11) incl weekday Mon; \~75–85% below baseline; weeks_seen 2; monitor now quiet (model adapting); routes low-urgency | **Do NOT tune → investigate.** before: monitor unchanged (correctly catching a real drop). after: investigate via Activation runbook (dashboard kem-tug-987); open a Jira code/product fix if a regression is confirmed. Coverage: monitor unchanged — keeps catching real drops. | high | <custom data-type="status" data-id="id-0">strongly recommend</custom> |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; a Warn pages like a critical page | 5 self-resolving Warn pages last wk; weeks_seen 6; 0 incidents; auto-resolved (ack n/a) | **Route HIGH → LOW / gate to critical.** before: util > 90 Alert / \~80 Warn → @webhook-incidentio-high + @pagerduty-Activation-Alerts. after: route the sustained-utilization branch → @webhook-incidentio-low (or scope the page handle to critical only); keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | <custom data-type="status" data-id="id-1">strongly recommend</custom> |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM + [133647342](https://app.datadoghq.com/monitors/133647342) mem-util | Activation dev-leak: dev OOM pages prod (handles unconditional) + stale dev-eks mem-util orphan | OOM paged prod from dev-eks Aug 6 (weeks_seen 1); mem-util stale \~10 wks, prod OK (weeks_seen 3+) | **Gate to prod / clear orphan.** 133647340 — move the High handles inside the prod is_match block (mirror 133647342); route the dev branch to a dev Slack. 133647342 — scope out dev + clear the orphan. Coverage: prod-cluster OOM / memory still page High. | high | <custom data-type="status" data-id="id-2">strongly recommend</custom> |
| [143507582](https://app.datadoghq.com/monitors/143507582) — duplicate funnel cashout | Recurring REAL failure (code bug), NOT noise + 2 stale alerts | 0 new fires; 2 alerts firing since Jun 3 (High) / Jul 23 (Low); Datadog No Data; weeks_seen 3+ | **Do NOT tune → Jira code fix.** after: open/track a Jira fix for the duplicate funnel-cashout bug (runbook SRE/3082453072); resolve the 2 stale alerts once shipped. Coverage: monitor unchanged, keeps catching duplicates. (Monitor SQL uses a `userid` placeholder — no customer value.) | high | <custom data-type="status" data-id="id-3">strongly recommend</custom> |
| [137629294](https://app.datadoghq.com/monitors/137629294) (+ [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650)) — Activation SQS backlog | Flappy backlog, no env scope / no sustain (0 pages) | Chronic; \~200 / \~32 / \~20 events last wk; 0 incident.io pages; weeks_seen 6 / 5 / 5 | **Add scope + sustain; verify routing.** before: SQS oldest-age > 90s (> 150s for user-activation), last_5m, no sustain. after: add env:prod + a 10–15 min sustain (self-clears in \~2–4 min); verify the prod routing branch actually resolves. Coverage: a sustained real backlog still pages High. | med | <custom data-type="status" data-id="id-4">recommend</custom> |

_Full 18-row history →_ [_Monitor Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577)_. Feedback loop (this run): all 18 diffable monitor configs were re-read and are unchanged vs their recorded before-state — no recommendation has been applied (≈18 consecutive runs, no validation win)._

### 🔴 Open Going Into Handoff

**Active prod Alert/Warn now:** none (0).

**Stale / lingering incident.io alerts (need a manual clear, not active prod work): 4** (carried from Aug 4, unverified — connector down):

* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High, firing since 2026-06-03; Datadog **No Data**. Code bug → Jira + clear.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low, firing since 2026-07-23; same bug.
* Activation processor sustained memory utilization ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks-cluster group firing since 2026-05-29; Datadog **OK on prod**. Dev-scope leak → scope out dev + clear.
* Databricks "Promotions Metrics Processor Job Failed" — High, firing since 2025-12-17; no live Datadog monitor. Verify job + clear.

**Not a clean start:** the first-cashout volume drop remains a real, unresolved signal carried in from last week (monitor quiet, metric \~75–85% below baseline), plus 4 stale incident.io alerts to clear.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** 10 open (<custom data-type="status" data-id="id-5">3 Critical</custom> / <custom data-type="status" data-id="id-6">7 High</custom>) via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) — **org-wide** scope (no Growth-owned ticket). Up from 8 (0 Critical / 8 High) on Aug 9; the 3 new Criticals are `ECD-11625` / `ECD-11626` / `ECD-11627` (\[VM,SAST\] Critical: unsanitized dynamic input in OS command). High: SV-4262 (pyarrow), QAMRE-1847 (ws), DISC-2434 (joserfc), WEBPLAT-1467 (SAST file path), KMONO-49 (jackson-databind), DISC-2439 (ddtrace), DISC-2438 (mcp).

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

- [ ] **Investigate the first-cashout volume drop** (real, \~75–85% below baseline Aug 7 → Aug 11 incl. weekday Mon Aug 10) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); open a Jira code/product fix if a regression is confirmed. Do NOT tune the monitor.
- [ ] Tune HPA [135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate the page to critical-only); keep OOM / pod-not-ready at HIGH.
- [ ] Fix Activation OOM routing [133647340](https://app.datadoghq.com/monitors/133647340): move the High handles inside the prod is_match block (mirror 133647342) so a dev-eks OOM stops paging prod.
- [ ] Clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342) + scope out dev.
- [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582); runbook SRE/3082453072) and clear the 2 stale alerts once shipped.
- [ ] Tune the Activation SQS backlog cluster ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650)): add env:prod + a 10–15 min sustain; verify the prod routing branch actually pages.
- [ ] Verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (firing \~8 months); fix its auto-resolution.
- [ ] Re-authenticate the incident.io connector (down Aug 5–11) — ack/auto-resolve classification, firing-set reconciliation, and on-call verification are blocked.
- [ ] Review open vulnerability tickets — 10 open (3 Critical / 7 High), org-wide; triage the 3 new Critical SAST OS-command-injection findings (ECD-11625 / ECD-11626 / ECD-11627).

## 📝 Manual Notes (preserved across refreshes)

_Add notes here; they survive daily refreshes._

---

_Generated by the Growth Team Ops Review agent. Window: 2026-08-11 00:00 → 2026-08-18 00:00 America/Los_Angeles (week-to-date, \~8.5 h in; live, refreshed daily). Last refreshed: 2026-08-11 08:29 AM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities); incident.io unavailable this run — alerts are Datadog-derived, and on-call + the 4 stale alerts are carried from the Aug 4 read. Customer identifiers redacted where present (the duplicate-cashout monitor SQL uses a_ `userid` _placeholder, not customer data). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent._
