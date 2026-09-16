🔄 **Live page** — refreshed daily during the on-call week (2026-09-15 → 2026-09-22). Last refreshed **2026-09-16 10:20 AM PT (America/Los_Angeles)** (day 1 of the on-call week). This page freezes at the Tuesday handoff (2026-09-22 11:00 America/Mexico_City); a new page opens for the next week.

⚠️ **incident.io connector unavailable this refresh (needs auth).** Alert enrichment, the human-attention / auto-resolved split, escalation rate, the incident list, on-call re-verification, and the stale-alert recheck could not run this run. Alert data below is **Datadog-only**; on-call names and the 6 stale alerts are **carried forward from the last verified state (2026-09-15)** and were not re-checked. Datadog and Jira are healthy. See Action Items to re-authenticate the connector.

🔴 **Ongoing cashout-funnel signals — carried in, keep watching.** (1) **First-cashout volume drop** [17131362](https://app.datadoghq.com/monitors/17131362) — the Aug 7 \~15:00 UTC cliff persists (\~40 days); reads OK only because the anomaly model adapted (quiet ≠ recovered). Real signal — do NOT tune → Activation runbook `kem-tug-987` + Jira. (2) **Funnel-cashout expirations low** [143509449](https://app.datadoghq.com/monitors/143509449) — the Sep 10 and Sep 14 fires were still open as stale incident.io alerts at the Sep 15 handoff (Datadog No Data); the monitor now routes incidentio-low (was High at fire time — confirm the re-route was intentional). _Not re-verified this run — incident.io down._ Registration-completion [143518919](https://app.datadoghq.com/monitors/143518919) also fired ×2 the prior week. The real drop persists → Jira / throughput fix, do NOT tune further. Prior on-call week (Sep 8 → Sep 15) closed at **28 records** (12 High / 16 Low), all resolved, 0 incidents.

# Growth Team Ops Review — Weekly Handoff

**09/16/2026 Growth Team Ops Review** · On-call week **2026-09-15 11:00 → 2026-09-22 11:00** (America/Mexico_City) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-09-16 10:20 AM PT** (week-to-date, day 1; live, refreshed daily).

_This on-call week — primary: **Nabi**; secondary: **Ankur Shivani** (shift Tue Sep 15 → Tue Sep 22). Next handoff Sep 22: primary **Ankur Shivani**, secondary **Alfred**._

_Last verified (2026-09-15) via_ `schedule_show`_; not re-verified this run — incident.io connector unavailable (needs auth). Rotation carried forward from last known, not invented._

_Coverage check (Slack out-of-office, as of 2026-09-16 10:20 AM PT): could not be completed (no Slack profile-read tool available under either name) — verify availability manually._

## SLOs / SLAs (15 minutes)

* [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
* [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
* [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — week-to-date (day 1 of 7; Datadog-only — incident.io connector down):** Datadog shows **3 Growth monitors fired** since the Sep 15 handoff, all the chronic **SQS backlog cluster** — [137629294](https://app.datadoghq.com/monitors/137629294) ×18 Warn, [137629364](https://app.datadoghq.com/monitors/137629364) ×6 (4 Warn + 2 Alert), [137629650](https://app.datadoghq.com/monitors/137629650) ×3 (2 Warn + 1 Alert); **27 Warn/Alert transitions total**, every one self-recovered within minutes; **0 currently firing**. No High-priority or customer-facing monitor fired. | **Prior full week (Sep 8 → Sep 15):** 28 incident.io records (12 High, 16 Low), 26 resolved, 0 incidents. | **Trend: not computed this run** — incident.io (the alert-record source) is unavailable, so a comparable record count, the human-attention / auto-resolved split, and the escalation rate cannot be derived; the Datadog-only signal is quiet (only the standing SQS flapper). **Human-attention: n/a · Auto-resolved: n/a · Escalation rate (alerts → incidents): n/a** (all require incident.io). **Still firing: 0 active** (Datadog) **/ stale not re-verified this run** (incident.io down; 6 carried in as of Sep 15).

_Priority = monitor severity/routing (High/Low); Warn/Alert = the level a fire crossed — the two are independent. A High-priority monitor can fire only at Warn._

## Incidents (15 minutes)

### Production Incidents — Customer Impact

**Data unavailable — check incident.io manually (connector returned Unauthorized / needs auth).** Production incidents could not be queried this run. As of the last verified state (Sep 15) there were no live production incidents; two carry-over items remain tracked but were _not_ re-verified this run: the quick-reply dead-button frontend bug (INC-2824, [312932032](https://app.datadoghq.com/monitors/312932032)) and the Anthropic-quota fragility (INC-2795 class, [309355473](https://app.datadoghq.com/monitors/309355473)).

### Operational Incidents — Deploys / Data Repairs / Infra

Data unavailable — check incident.io manually (connector returned Unauthorized / needs auth). Datadog config audit did surface one operational change this week (an ownership transfer, not an incident) — see _Config changes_ below.

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

**Data unavailable — the acknowledged / human-attention split requires incident.io (connector down this run).** Per Datadog, **no High-priority or customer-facing Growth monitor fired** this week-to-date, so no clear human page is expected; this cannot be confirmed without incident.io.

### Auto-Resolved — Escalation Cancelled

**Data unavailable — auto-resolution is an incident.io determination (connector down).** Datadog-observed: the only Growth monitors that fired were the SQS backlog cluster ([137629294](https://app.datadoghq.com/monitors/137629294) ×18, [137629364](https://app.datadoghq.com/monitors/137629364) ×6, [137629650](https://app.datadoghq.com/monitors/137629650) ×3), each recovering within \~2–5 minutes without a sustained backlog. Whether any escalated to a human cannot be confirmed this run. Detail in Recurring / Flappy below.

### Recurring / Flappy Alerts — Monitor Tuning Candidates

| Alert | Times Fired (week-to-date, Datadog) | Notes |
| --- | --- | --- |
| [137629294](https://app.datadoghq.com/monitors/137629294) — SQS backlog, First Mile Calculations (job-user-setup-user-first-mile-calc-processor) | **18× Warn** (Sep 15 17:03 UTC → Sep 16 16:53 UTC; each recovered \~2 min) | Chronic flapper (ledger weeks_seen 9). Query `avg(last_5m):aws.sqs.approximate_age_of_oldest_message{name:first-mile-new-user-score} > 90`, no `env` scope, no sustain. Prod branch routes @pagerduty-Activation-Alerts + incidentio-high (gated `is_match prod`). Datadog-only noise historically. See tuning rec. |
| [137629364](https://app.datadoghq.com/monitors/137629364) — SQS backlog, Deactivated User (job-user-deactivated-user-processor) | **6×** (4 Warn + 2 Alert >90; Sep 15 20:21 UTC & Sep 16 08:21/14:21 UTC) | weeks_seen 8. Same `> 90` / `last_5m` pattern, no env scope, no sustain. Add `env:prod` + a 10–15 min sustain. |
| [137629650](https://app.datadoghq.com/monitors/137629650) — SQS backlog, User Activation (queuename:prod_statusactivationattempt) | **3×** (2 Warn + 1 Alert >150; Sep 16 04:21–04:28 UTC) | weeks_seen 8. Explicitly prod queue; `> 150` / `last_5m`. Add a sustain so a 4–5 min blip does not alert. |

**Config changes detected this week (Datadog audit):** on **2026-09-15 18:55–18:59 UTC**, **21** `svc-links-internal` **monitors were re-tagged from** `team:l3-peng-coreuxbackend` **→** `team:l2-peng-growth` (by Jon Nahum), moving a whole service's prod monitors into the Growth team — including p1 OOM ([180335208](https://app.datadoghq.com/monitors/180335208)), HPA sustained-utilization ([180924435](https://app.datadoghq.com/monitors/180924435)), pods-not-ready ([181023027](https://app.datadoghq.com/monitors/181023027)), CPU throttling ([180334855](https://app.datadoghq.com/monitors/180334855)), memory-utilization ([180341877](https://app.datadoghq.com/monitors/180341877)), error-rate / latency / SLO burn-rate monitors. None fired this week. No changes were made to Growth's existing monitors. This expands the team's paging surface — confirm the transfer + routing/coverage are intended (Action Items).

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; pages for a self-resolving condition, incl. outside working hours | Chronic (weeks_seen 11); 0 fires week-to-date; fired 9× the prior week at Warn/Low (7 acked + 2 no-ack); monitor OK | **Route HIGH → LOW / gate to critical.** before: util `> 90` Alert / \~80 Warn → `@webhook-incidentio-high`. after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | <custom data-type="status" data-id="id-0">strongly recommend</custom> |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~40 days (Aug 7 cliff); weeks_seen 5; monitor quiet (model adapting) | **Do NOT tune → investigate.** before: monitor unchanged. after: investigate via the Activation runbook (`kem-tug-987`); rule out an Aug 7 \~15:00 UTC deploy/instrumentation change vs a demand regression; open a Jira fix. Coverage: monitor unchanged. | high | <custom data-type="status" data-id="id-1">strongly recommend</custom> |
| [143509449](https://app.datadoghq.com/monitors/143509449) — funnel-cashout expirations low | Real, sustained-low expiration drop — threshold change applied at the Aug 25 handoff; a further high→low re-route was observed at the Sep 15 close | Threshold `< 5` → `< 2` (applied); routing now incidentio-low; weeks_seen 5; the drop persists; _not re-verified this run (incident.io down)_ | **Applied (threshold 5 → 2); routing re-route observed.** Confirm the incidentio-low re-route was intentional. Still needed: investigate throughput + the retrigger-funnel-cashout cronjob; prefer a time-of-day / min-volume guard. Coverage: a real funnel-cashout outage still pages. | high (observed diff) | <custom data-type="status" data-id="id-2">applied</custom> |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM (+ sibling [133647342](https://app.datadoghq.com/monitors/133647342) mem-util) | Activation dev-leak: a dev-eks OOM paged prod on-call High because the page handles were unconditional | Routing fixed 2026-08-28 (handles inside the prod `is_match` block); weeks_seen 5; 0 OOM week-to-date — no post-fix dev-eks OOM yet to validate | **ACHIEVED — handles prod-gated.** Remaining: query still has no env scope (still enters Alert on dev, no page); optionally add `cluster_flavor:prod`; clear the stale mem-util 133647342 dev-eks orphan + scope out dev. Coverage: prod OOM still pages High. | high (observed diff + audit) | <custom data-type="status" data-id="id-3">applied</custom> |
| [137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650) — SQS backlog cluster | Flappy backlog, no env scope / no sustain (Datadog noise; historically 0 incident.io pages) | Fired again this week: 18 / 6 / 3 (all self-recovered in minutes); weeks_seen 9 / 8 / 8; incident.io page status unverifiable this run | **Add scope + sustain; verify routing.** before: SQS oldest-age `> 90–150 s` Alert, `last_5m`, no env scope, no sustain. after: add `env:prod` + a sustain ≥ 10–15 min; verify the prod routing branch actually resolves. Coverage: a sustained real backlog still alerts. | med | <custom data-type="status" data-id="id-4">recommend</custom> |

_Top 5 by expected impact; **full history (27 rows) →**_ [_Monitor Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577)_. Standing, learned recommendations carried into the week — they persist until applied (weeks_seen holds until the Tue Sep 22 roll). This week's only firing was the SQS backlog cluster; the cashout-funnel signal cluster (funnel expirations, registration-completion, first-cashout) remains the key watch. See Action Items._

### 🔴 Open Going Into the Week

**Active — Datadog Alert/Warn now: 0.** No Growth monitor currently reads Alert/Warn (`search_datadog_monitors team:l2-peng-growth status:(alert OR warn)` → none). The SQS cluster flaps in and out but reads OK right now.

**Stale / lingering incident.io alerts: not re-verified this run (incident.io connector down).** The **6** below are carried forward from the last verified check (Sep 15 via `alert_list status:firing`) and still need a manual clear — re-confirm once incident.io is back:

* Funnel-cashout expirations low ([143509449](https://app.datadoghq.com/monitors/143509449)) — High, since 2026-09-14 01:24 UTC; Datadog No Data. Tied to the real funnel-cashout drop.
* Funnel-cashout expirations low ([143509449](https://app.datadoghq.com/monitors/143509449)) — High, since 2026-09-10 03:24 UTC; Datadog No Data. Earlier lingering fire; same drop.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High, since 2026-06-03; Datadog No Data. Code bug → Jira + clear.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low, since 2026-07-23; same bug.
* Activation mem-util ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks group since 2026-05-29; Datadog OK on prod. Dev-scope leak → scope out dev + clear.
* Databricks "Promotions Metrics Processor Job Failed" — High, since 2025-12-17; no live Datadog monitor. Verify job + clear.

**0 active paging issues.** Stale count not re-verified this run (incident.io down); 6 carried in as of Sep 15 to clear — not a clean handoff until those are cleared.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** **29 open** via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) (org-wide, as of 2026-09-16 10:20 AM PT) — <custom data-type="status" data-id="id-5">22 Critical</custom> / <custom data-type="status" data-id="id-6">5 High</custom> by ticket summary prefix, plus 2 security tickets with no severity prefix (a CORS misconfiguration `WEBPLAT-1489`, In Progress, and an IAM config review `ACC-6258`, Blocked). The 22 Criticals are led by `io.netty:netty-handler` (11), `tomcat-embed-core` (5), Next.js (3), plus `System.Text.Encodings.Web` (1) and 2 new secrets-detection findings (`MOBPLAT-4778/4779`). 5 High: anti-forgery-token (`QAMRE-1920`), log-leakage (`MOBPLAT-4684`, and new `SV-4848`), `tar` (`MOBPLAT-4682`), `netty-codec-http` (`KMONO-59`). Up from 26 at the Sep 15 handoff (+2 Critical secrets-detection, +1 High log-leakage). Severity from the ticket summary prefix (Jira priority field uniformly "Low"). **org-wide** scope (no Growth-owned ticket). _Count is volatile intraday._

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

- [ ] **Re-authenticate the incident.io connector** — it returned needs-auth this run, so alert enrichment, the escalation / human-attention split, the incident list, on-call re-verification, and the stale-alert recheck were all degraded (Datadog-only report). Restore before the next run for a complete handoff.
- [ ] **Confirm the** `svc-links-internal` **monitor ownership transfer is intended** — 21 prod monitors moved `team:l3-peng-coreuxbackend` → `team:l2-peng-growth` on Sep 15 (incl. p1 OOM [180335208](https://app.datadoghq.com/monitors/180335208), HPA [180924435](https://app.datadoghq.com/monitors/180924435), pods-not-ready [181023027](https://app.datadoghq.com/monitors/181023027), SLO burn-rate). Verify Growth on-call routing/coverage for the new surface; add to the tuning watch list.
- [ ] **Escalate the first-cashout volume drop** (\~40 days below baseline) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); check the Aug 7 \~15:00 UTC cliff (deploy vs demand); open a Jira fix. Do NOT tune the monitor.
- [ ] **Investigate the funnel-cashout-expiration drop** ([143509449](https://app.datadoghq.com/monitors/143509449)): the Sep 10 & Sep 14 fires were still open (stale) at the Sep 15 check — clear both once incident.io is back, check the retrigger-funnel-cashout cronjob, tie to the first-cashout decline. Confirm the recent incidentio-low re-route was intentional.
- [ ] **Watch the funnel-anomaly monitors** (registration-completion [143518919](https://app.datadoghq.com/monitors/143518919) fired ×2 the prior week; good-to-go [143516414](https://app.datadoghq.com/monitors/143516414)): robust weekly anomalies echoing the funnel-cashout / first-cashout drop — route to that Activation investigation rather than tuning.
- [ ] **Tune the SQS backlog cluster** ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650), the only fires this week — 18 / 6 / 3): add `env:prod` + a 10–15 min sustain; verify the prod routing branch resolves (Datadog noise, historically 0 incident.io pages).
- [ ] **Tune HPA** [135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate to critical-only); keep OOM / pod-not-ready at HIGH. Chronic (weeks_seen 11); quiet this week.
- [ ] **Finish the svc-mark-tech P5 → High fix** (request-duration [301972958](https://app.datadoghq.com/monitors/301972958)): eval window was widened `last_10m → last_1d` on Sep 9 (0 fires since) but `last_1d` p99 may mask a real regression — prefer `last_1h`; route the prod branch to Low or require ≥ N consecutive windows; confirm Growth ownership of svc-mark-tech.
- [ ] **Add a sustain to the svc-notification-preferences latency pair** ([243692163](https://app.datadoghq.com/monitors/243692163) p90 High / [243692043](https://app.datadoghq.com/monitors/243692043) avg Low): p90 fired 4× the prior week (incl. a night page); keep the grounded p90 baseline \~116 ms / 14 d, require ≥ 2 consecutive windows; consider consolidating the two.
- [ ] **Verify the Activation OOM routing fix holds** ([133647340](https://app.datadoghq.com/monitors/133647340)): handles gated to prod (2026-08-28). Confirm no dev-eks OOM pages prod; optionally add `cluster_flavor:prod`; clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342).
- [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582)) and clear the 2 stale alerts once shipped.
- [ ] Verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (\~9 months).
- [ ] Review open vulnerability tickets — 29 open (22 Critical / 5 High + 2 unlabeled), org-wide; the `netty-handler` (11), `tomcat-embed-core` (5) and Next.js (3) Criticals lead; 2 new secrets-detection Criticals this refresh.

## 📝 Manual Notes (preserved across refreshes)

_Add notes here; they survive daily refreshes._

---

_Generated by the Growth Team Ops Review agent. Window: 2026-09-15 11:00 → 2026-09-22 11:00 America/Mexico_City (week-to-date, day 1; live, refreshed daily until it freezes at the Sep 22 handoff). Last refreshed: 2026-09-16 10:20 AM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities). **incident.io connector was unavailable this run (needs auth)** — alert/incident/on-call/stale sections are Datadog-only or carried-forward and flagged inline; Datadog and Jira were healthy. Customer identifiers redacted where present (none required this run). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent._
