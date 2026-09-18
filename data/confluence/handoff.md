🔄 **Live page** — refreshed daily during the on-call week (2026-09-15 → 2026-09-22). Last refreshed **2026-09-18 10:15 AM PT (America/Los_Angeles)** (day 3 of the on-call week). This page freezes at the Tuesday handoff (2026-09-22 11:00 America/Mexico_City); a new page opens for the next week.

⚠️ **incident.io connector still unavailable this refresh (needs auth) — unchanged since the Sep 16 run.** Alert enrichment, the human-attention / auto-resolved split, escalation rate, the incident list, on-call re-verification, and the stale-alert recheck could not run. Alert data below is **Datadog-only**; on-call names and the 6 stale alerts are **carried forward from the last verified state (2026-09-15)** and were not re-checked. Datadog and Jira are healthy. See Action Items to re-authenticate the connector.

🆕 **First real fire from the newly-transferred svc-links-internal surface.** On **Thu 2026-09-17 14:30 UTC** the P2 SLO high-latency burn-rate monitor [181530102](https://app.datadoghq.com/monitors/181530102) (env prod) breached — the 30-min burn rate spiked to \~39× budget (gRPC responses > 800 ms) — and self-recovered \~45 min later (15:15 UTC). It notifies `@slack-growth-engineering-alerts` + the Growth on-call-agent email (**not** a pager, not incident.io), so it did not page a human. This is the first fire from the 21 `svc-links-internal` monitors moved into `team:l2-peng-growth` on Sep 15 — confirm Growth is meant to own this SLO surface and investigate the latency spike (Action Items).

🔴 **Ongoing cashout-funnel signals — carried in, keep watching.** (1) **First-cashout volume drop** [17131362](https://app.datadoghq.com/monitors/17131362) — the Aug 7 \~15:00 UTC cliff persists (\~42 days); reads OK only because the anomaly model adapted (quiet ≠ recovered). Real signal — do NOT tune → Activation runbook `kem-tug-987` + Jira. (2) **Funnel-cashout expirations low** [143509449](https://app.datadoghq.com/monitors/143509449) — did not newly fire in Datadog this week; the Sep 10 & Sep 14 fires remain open as stale incident.io alerts (Datadog No Data); the monitor routes incidentio-low (was High at fire time — confirm the re-route was intentional). _Not re-verified this run — incident.io down._ The real drop persists → Jira / throughput fix, do NOT tune further. Prior on-call week (Sep 8 → Sep 15) closed at **28 records** (12 High / 16 Low), all resolved, 0 incidents.

# Growth Team Ops Review — Weekly Handoff

**09/18/2026 Growth Team Ops Review** · On-call week **2026-09-15 11:00 → 2026-09-22 11:00** (America/Mexico_City) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-09-18 10:15 AM PT** (week-to-date, day 3; live, refreshed daily).

_This on-call week — primary: **Nabi**; secondary: **Ankur Shivani** (shift Tue Sep 15 → Tue Sep 22). Next handoff Sep 22: primary **Ankur Shivani**, secondary **Alfred**._

_Last verified (2026-09-15) via_ `schedule_show`_; not re-verified this run — incident.io connector unavailable (needs auth). Rotation carried forward from last known, not invented._

_Coverage check (Slack out-of-office, as of 2026-09-18 10:15 AM PT): could not be completed (no Slack profile-read tool available under either name) — verify availability manually._

## SLOs / SLAs (15 minutes)

* [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
* [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
* [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — week-to-date (day 3 of 7; Datadog-only — incident.io connector down):** Datadog shows **4 Growth monitors fired** since the Sep 15 handoff — the chronic **SQS backlog cluster** ([137629294](https://app.datadoghq.com/monitors/137629294) ×45 \[43 Warn + 2 Alert\], [137629364](https://app.datadoghq.com/monitors/137629364) ×19 \[12 Warn + 7 Alert\], [137629650](https://app.datadoghq.com/monitors/137629650) ×19 \[12 Warn + 7 Alert\]) plus **one real prod SLO latency alert** on svc-links-internal ([181530102](https://app.datadoghq.com/monitors/181530102) ×1, Sep 17, self-recovered \~45 min); **84 Warn/Alert transitions total**, every one self-recovered within minutes; **0 currently firing**. | **Prior full week (Sep 8 → Sep 15):** 28 incident.io records (12 High, 16 Low), 26 resolved, 0 incidents. | **Trend: not computed this run** — incident.io (the alert-record source) is unavailable, so a comparable record count, the human-attention / auto-resolved split, and the escalation rate cannot be derived; the Datadog-only transition run-rate (\~195/wk) is \~entirely the standing SQS flapper. **Human-attention: n/a · Auto-resolved: n/a · Escalation rate (alerts → incidents): n/a** (all require incident.io). **Still firing: 0 active** (Datadog) **/ stale not re-verified this run** (incident.io down; 6 carried in as of Sep 15).

_Priority = monitor severity/routing (High/Low); Warn/Alert = the level a fire crossed — the two are independent. A High-priority monitor can fire only at Warn._

## Incidents (15 minutes)

### Production Incidents — Customer Impact

**Data unavailable — check incident.io manually (connector returned Unauthorized / needs auth).** Production incidents could not be queried this run. As of the last verified state (Sep 15) there were no live production incidents; two carry-over items remain tracked but were _not_ re-verified this run: the quick-reply dead-button frontend bug (INC-2824, [312932032](https://app.datadoghq.com/monitors/312932032)) and the Anthropic-quota fragility (INC-2795 class, [309355473](https://app.datadoghq.com/monitors/309355473)).

### Operational Incidents — Deploys / Data Repairs / Infra

Data unavailable — check incident.io manually (connector returned Unauthorized / needs auth). Datadog config audit surfaced one operational change this week (the Sep 15 svc-links-internal ownership transfer, not an incident) — see _Config changes_ below; its first alert (the Sep 17 SLO latency burn) is covered under incident.io Alerts / Monitoring.

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

**Data unavailable — the acknowledged / human-attention split requires incident.io (connector down this run).** Per Datadog, one real prod alert fired this week — the svc-links-internal SLO high-latency burn ([181530102](https://app.datadoghq.com/monitors/181530102)) — but it routes to Slack + the Growth on-call-agent email, not incident.io / pagerduty, so whether a human acked it cannot be confirmed. No other High-priority or customer-facing Growth monitor fired. Agent Finding below.

| Alert | Priority | Service | On-call | Agent Finding |
| --- | --- | --- | --- | --- |
| [181530102](https://app.datadoghq.com/monitors/181530102) — SLO High Latency Burn Rate (gRPC slow requests) | <custom data-type="status" data-id="id-0">P2 / High</custom> | svc-links-internal (prod) | n/a — routes Slack + on-call-agent email, not a pager (incident.io unavailable, ack unverifiable) | **TL;DR:** svc-links-internal (prod) briefly breached its gRPC latency SLO on Thu Sep 17 — the 30-min burn rate spiked to \~39× budget (responses > 800 ms) — the P2 monitor notified Slack + the Growth on-call-agent email (not a pager) and self-recovered in \~45 min; no customer-impact incident recorded. **What happened:** Observed — SLO burn-rate monitor 181530102 (30-day target, long window 6h / short window 30m, threshold > 6) triggered **2026-09-17 14:30:42 UTC** at burn rates 6.25 (6h) / 39.34 (30m); recovered **2026-09-17 15:15:42 UTC** (\~45 min) at 8.92 (6h) / 4.7 (30m). Env prod (production-eks-cluster); reads OK now. Routing is `@slack-growth-engineering-alerts` + `@svc-cursor-growth-oncall-agent@earnin.com` — no pagerduty / incidentio handle, so no human page and no incident.io record. This is the **first fire from the 21 svc-links-internal monitors transferred into team:l2-peng-growth on Sep 15**. Likely cause: a transient \~30–45 min prod gRPC latency spike (slow requests > 800 ms) burning latency budget faster than baseline. Cause not determined beyond that from available signals — APM / deploy correlation and incident.io enrichment were unavailable this run. |

### Auto-Resolved — Escalation Cancelled

**Data unavailable — auto-resolution is an incident.io determination (connector down).** Datadog-observed: the SQS backlog cluster ([137629294](https://app.datadoghq.com/monitors/137629294) ×45, [137629364](https://app.datadoghq.com/monitors/137629364) ×19, [137629650](https://app.datadoghq.com/monitors/137629650) ×19) each recovered within \~2–5 minutes without a sustained backlog, and the svc-links SLO burn ([181530102](https://app.datadoghq.com/monitors/181530102)) self-recovered in \~45 min. Whether any escalated to a human cannot be confirmed this run. Detail in Recurring / Flappy below.

### Recurring / Flappy Alerts — Monitor Tuning Candidates

| Alert | Times Fired (week-to-date, Datadog) | Notes |
| --- | --- | --- |
| [137629294](https://app.datadoghq.com/monitors/137629294) — SQS backlog, First Mile Calculations (job-user-setup-user-first-mile-calc-processor) | **45×** (43 Warn + 2 Alert >90; Sep 15 17:03 UTC → Sep 18, each recovered \~2 min) | Chronic flapper (ledger weeks_seen 9). Query `avg(last_5m):avg:aws.sqs.approximate_age_of_oldest_message{name:first-mile-new-user-score} by {queuename} > 90`, no `env` scope, no sustain. Prod branch routes @pagerduty-Activation-Alerts + incidentio-high (gated `is_match env.name prod`) but self-recovers before escalation. Datadog-only noise historically. See tuning rec. |
| [137629364](https://app.datadoghq.com/monitors/137629364) — SQS backlog, Deactivated User (job-user-deactivated-user-processor) | **19×** (12 Warn + 7 Alert >90; latest Sep 18 14:24 UTC) | weeks_seen 8. Same `> 90` / `last_5m` pattern, no env scope, no sustain. Add `env:prod` + a 10–15 min sustain. |
| [137629650](https://app.datadoghq.com/monitors/137629650) — SQS backlog, User Activation (queuename:prod_statusactivationattempt) | **19×** (12 Warn + 7 Alert >150) | weeks_seen 8. Explicitly prod queue; `> 150` / `last_5m`. Add a sustain so a 4–5 min blip does not alert. |

**Config changes detected this week (Datadog audit):** on **2026-09-15** (18:55–19:07 UTC), **21** `svc-links-internal` **monitors were re-tagged** `team:l3-peng-coreuxbackend` **→** `team:l2-peng-growth` (by Jon Nahum) and had the Growth on-call-agent notification handle (`@svc-cursor-growth-oncall-agent@earnin.com`) added — moving a whole service's prod monitors into Growth, including p1 OOM ([180335208](https://app.datadoghq.com/monitors/180335208)), HPA sustained-utilization ([180924435](https://app.datadoghq.com/monitors/180924435)), pods-not-ready ([181023027](https://app.datadoghq.com/monitors/181023027)), CPU throttling ([180334855](https://app.datadoghq.com/monitors/180334855)), memory-utilization ([180341877](https://app.datadoghq.com/monitors/180341877)), and gRPC error / latency SLO burn-rate monitors ([181525229](https://app.datadoghq.com/monitors/181525229) / [181527447](https://app.datadoghq.com/monitors/181527447) / [181529286](https://app.datadoghq.com/monitors/181529286) / [181530102](https://app.datadoghq.com/monitors/181530102)). **No monitor config changes occurred after Sep 15.** The surface produced its first fire on Sep 17 (the 181530102 SLO latency burn, above). No changes were made to Growth's pre-existing monitors. Confirm the transfer + routing / coverage are intended (Action Items).

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; pages for a self-resolving condition, incl. outside working hours | Chronic (weeks_seen 11); 0 fires week-to-date; fired 9× the prior week at Warn/Low (7 acked + 2 no-ack); monitor OK | **Route HIGH → LOW / gate to critical.** before: util `> 90` Alert / \~80 Warn → `@webhook-incidentio-high`. after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | <custom data-type="status" data-id="id-1">strongly recommend</custom> |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~42 days (Aug 7 cliff); weeks_seen 5; monitor quiet (model adapting) | **Do NOT tune → investigate.** before: monitor unchanged. after: investigate via the Activation runbook (`kem-tug-987`); rule out an Aug 7 \~15:00 UTC deploy / instrumentation change vs a demand regression; open a Jira fix. Coverage: monitor unchanged. | high | <custom data-type="status" data-id="id-2">strongly recommend</custom> |
| [143509449](https://app.datadoghq.com/monitors/143509449) — funnel-cashout expirations low | Real, sustained-low expiration drop — threshold change applied at the Aug 25 handoff; a further high→low re-route was observed at the Sep 15 close | Threshold `< 5` → `< 2` (applied); routing now incidentio-low; weeks_seen 5; did not newly fire this week; the drop persists; _not re-verified this run (incident.io down)_ | **Applied (threshold 5 → 2); routing re-route observed.** Confirm the incidentio-low re-route was intentional. Still needed: investigate throughput + the retrigger-funnel-cashout cronjob; prefer a time-of-day / min-volume guard. Coverage: a real funnel-cashout outage still pages. | high (observed diff) | <custom data-type="status" data-id="id-3">applied</custom> |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM (+ sibling [133647342](https://app.datadoghq.com/monitors/133647342) mem-util) | Activation dev-leak: a dev-eks OOM paged prod on-call High because the page handles were unconditional | Routing fixed 2026-08-28 (handles inside the prod `is_match` block); weeks_seen 5; 0 OOM week-to-date — no post-fix dev-eks OOM yet to validate | **ACHIEVED — handles prod-gated.** Remaining: query still has no env scope (still enters Alert on dev, no page); optionally add `cluster_flavor:prod`; clear the stale mem-util 133647342 dev-eks orphan + scope out dev. Coverage: prod OOM still pages High. | high (observed diff + audit) | <custom data-type="status" data-id="id-4">applied</custom> |
| [137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650) — SQS backlog cluster | Flappy backlog, no env scope / no sustain (Datadog noise; historically 0 incident.io pages) | Fired again this week: 45 / 19 / 19 (all self-recovered in minutes); weeks_seen 9 / 8 / 8; incident.io page status unverifiable this run | **Add scope + sustain; verify routing.** before: SQS oldest-age `> 90–150 s` Alert, `last_5m`, no env scope, no sustain. after: add `env:prod` + a sustain ≥ 10–15 min; verify the prod routing branch actually resolves. Coverage: a sustained real backlog still alerts. | med | <custom data-type="status" data-id="id-5">recommend</custom> |

_Top 5 by expected impact; **full history (28 rows) →**_ [_Monitor Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577)_. Standing, learned recommendations carried into the week — weeks_seen holds until the Tue Sep 22 roll. This week's fires were the SQS backlog cluster plus a first, self-recovered SLO latency burn on the newly-transferred svc-links-internal surface (_[_181530102_](https://app.datadoghq.com/monitors/181530102)_, a real SLO signal — confirm ownership + investigate, do NOT tune); the cashout-funnel signal cluster remains the key watch. See Action Items._

### 🔴 Open Going Into the Week

**Active — Datadog Alert/Warn now: 0.** No Growth monitor currently reads Alert/Warn (`search_datadog_monitors team:l2-peng-growth status:(alert OR warn)` → none). The SQS cluster flaps in and out but reads OK right now, and the svc-links SLO monitor recovered Sep 17 15:15 UTC.

**Stale / lingering incident.io alerts: not re-verified this run (incident.io connector down).** The **6** below are carried forward from the last verified check (Sep 15 via `alert_list status:firing`) and still need a manual clear — re-confirm once incident.io is back:

* Funnel-cashout expirations low ([143509449](https://app.datadoghq.com/monitors/143509449)) — High, since 2026-09-14 01:24 UTC; Datadog No Data. Tied to the real funnel-cashout drop.
* Funnel-cashout expirations low ([143509449](https://app.datadoghq.com/monitors/143509449)) — High, since 2026-09-10 03:24 UTC; Datadog No Data. Earlier lingering fire; same drop.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High, since 2026-06-03; Datadog No Data. Code bug → Jira + clear.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low, since 2026-07-23; same bug.
* Activation mem-util ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks group since 2026-05-29; Datadog OK on prod. Dev-scope leak → scope out dev + clear.
* Databricks "Promotions Metrics Processor Job Failed" — High, since 2025-12-17; no live Datadog monitor. Verify job + clear.

**0 active paging issues.** Stale count not re-verified this run (incident.io down); 6 carried in as of Sep 15 to clear — not a clean handoff until those are cleared.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** **24 open** via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) (org-wide, as of 2026-09-18 10:15 AM PT) — <custom data-type="status" data-id="id-6">19 Critical</custom> / <custom data-type="status" data-id="id-7">3 High</custom> by ticket summary prefix, plus 2 security tickets with no severity prefix (a CORS misconfiguration `WEBPLAT-1489`, In Progress, and an IAM config review `ACC-6258`, Blocked). The 19 Criticals are led by `io.netty:netty-handler` (11), `tomcat-embed-core` (2), Next.js (3), plus `System.Text.Encodings.Web` (1) and 2 secrets-detection findings (`MOBPLAT-4778/4779`). 3 High: `tar` (`MOBPLAT-4682`, In Review), `netty-codec-http` (`KMONO-59`), and log-leakage SAST (`SV-4848`). **Down from 29 at the Sep 16 refresh** (−3 tomcat-embed-core Criticals cleared; −2 High cleared — anti-forgery `QAMRE-1920` and log-leakage `MOBPLAT-4684`). Severity from the ticket summary prefix (Jira priority field uniformly "Low"). **org-wide** scope (no Growth-owned ticket). _Count is volatile intraday._

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

- [ ] **Re-authenticate the incident.io connector** — it has returned needs-auth since the Sep 16 run, so alert enrichment, the escalation / human-attention split, the incident list, on-call re-verification, and the stale-alert recheck are all degraded (Datadog-only report). Restore before the next run for a complete handoff.
- [ ] **Confirm the** `svc-links-internal` **monitor ownership transfer is intended — and triage its first fire.** 21 prod monitors moved `team:l3-peng-coreuxbackend` → `team:l2-peng-growth` on Sep 15 (incl. p1 OOM [180335208](https://app.datadoghq.com/monitors/180335208), HPA [180924435](https://app.datadoghq.com/monitors/180924435), pods-not-ready [181023027](https://app.datadoghq.com/monitors/181023027), SLO burn-rate [181530102](https://app.datadoghq.com/monitors/181530102)). The SLO latency monitor already fired once (Sep 17, \~45 min, self-recovered). Verify Growth on-call routing / coverage for the new surface and investigate the Sep 17 gRPC latency spike.
- [ ] **Escalate the first-cashout volume drop** (\~42 days below baseline) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); check the Aug 7 \~15:00 UTC cliff (deploy vs demand); open a Jira fix. Do NOT tune the monitor.
- [ ] **Investigate the funnel-cashout-expiration drop** ([143509449](https://app.datadoghq.com/monitors/143509449)): the Sep 10 & Sep 14 fires were still open (stale) at the Sep 15 check — clear both once incident.io is back, check the retrigger-funnel-cashout cronjob, tie to the first-cashout decline. Confirm the recent incidentio-low re-route was intentional.
- [ ] **Watch the funnel-anomaly monitors** (registration-completion [143518919](https://app.datadoghq.com/monitors/143518919) fired ×2 the prior week; good-to-go [143516414](https://app.datadoghq.com/monitors/143516414)): robust weekly anomalies echoing the funnel-cashout / first-cashout drop — route to that Activation investigation rather than tuning.
- [ ] **Tune the SQS backlog cluster** ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650), the standing flapper — fired 45 / 19 / 19 this week): add `env:prod` + a 10–15 min sustain; verify the prod routing branch resolves (Datadog noise, historically 0 incident.io pages).
- [ ] **Tune HPA** [135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate to critical-only); keep OOM / pod-not-ready at HIGH. Chronic (weeks_seen 11); quiet this week.
- [ ] **Finish the svc-mark-tech P5 → High fix** (request-duration [301972958](https://app.datadoghq.com/monitors/301972958)): eval window was widened `last_10m → last_1d` on Sep 9 (0 fires since) but `last_1d` p99 may mask a real regression — prefer `last_1h`; route the prod branch to Low or require ≥ N consecutive windows; confirm Growth ownership of svc-mark-tech.
- [ ] **Add a sustain to the svc-notification-preferences latency pair** ([243692163](https://app.datadoghq.com/monitors/243692163) p90 High / [243692043](https://app.datadoghq.com/monitors/243692043) avg Low): p90 fired 4× the prior week (incl. a night page); keep the grounded p90 baseline \~116 ms / 14 d, require ≥ 2 consecutive windows; consider consolidating the two.
- [ ] **Verify the Activation OOM routing fix holds** ([133647340](https://app.datadoghq.com/monitors/133647340)): handles gated to prod (2026-08-28). Confirm no dev-eks OOM pages prod; optionally add `cluster_flavor:prod`; clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342).
- [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582)) and clear the 2 stale alerts once shipped.
- [ ] Verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (\~9 months).
- [ ] Review open vulnerability tickets — 24 open (19 Critical / 3 High + 2 unlabeled), org-wide; the `netty-handler` (11), Next.js (3) and `tomcat-embed-core` (2) Criticals lead; 2 secrets-detection Criticals remain.

## 📝 Manual Notes (preserved across refreshes)

_Add notes here; they survive daily refreshes._

---

_Generated by the Growth Team Ops Review agent. Window: 2026-09-15 11:00 → 2026-09-22 11:00 America/Mexico_City (week-to-date, day 3; live, refreshed daily until it freezes at the Sep 22 handoff). Last refreshed: 2026-09-18 10:15 AM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities). **incident.io connector was unavailable this run (needs auth)** — alert / incident / on-call / stale sections are Datadog-only or carried-forward and flagged inline; Datadog and Jira were healthy. Customer identifiers redacted where present (none required this run). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent._
