🔄 **Live page** — refreshed daily during the on-call week (2026-09-29 → 2026-10-06). Last refreshed **2026-09-30 10:07 AM PT (America/Los\_Angeles)** (\~1.0 day into the week). This page freezes at the Tuesday handoff (2026-10-06 11:00 America/Mexico\_City); a new page opens for the next week.

🗓️ **Week-to-date (\~1.0 day in): quiet start.** **0 incident.io alert records**, **0 incidents**, **0 monitor config changes**, and **0 Growth monitors in Alert/Warn right now**. Standing noise only: \~**25 Datadog Warn-level fire transitions** (net; 43 events − 18 recoveries) — SQS-backlog trio \~19, svc-links resolveshortlink/anomaly 4, OTGE CPU+HPA 2 — all self-recovered in minutes and **none paged**. Carried in from the closed week: **5 stale incident.io alerts** (4 High + 1 Low) still to clear, the `svc-links-internal` transfer surface to keep watching, and the Activation funnel / first-cashout drop to investigate. **Prior week (Sep 22 → Sep 29, closed):** 4 incident.io records (3 acked Highs + 1 Low), 0 incidents, 183 Datadog fires. incident.io + Datadog + Jira healthy; vulnerabilities **47 open** (org-wide, volatile).

# Growth Team Ops Review — Weekly Handoff

**09/30/2026 Growth Team Ops Review** · On-call week **2026-09-29 11:00 → 2026-10-06 11:00** (America/Mexico\_City) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-09-30 10:07 AM PT** (week-to-date, \~1.0 day in; live, refreshed daily).

*This on-call week — primary: **Alfred**; secondary: **aiden.ramgoolam** (shift 2026-09-29 → 2026-10-06; verified live via *`schedule_show`*). Next handoff 2026-10-06: primary **aiden.ramgoolam**, secondary **Edder Núñez**.*

*Verified live via *`schedule_show`* this run (incident.io connector healthy) — the rotation is confirmed unchanged from the Sep 29 handoff and no PTO is booked for the rotation this window.*

*Coverage check (Slack out-of-office, as of 2026-09-30 10:07 AM PT): could not be completed (no Slack profile-read tool available under either name) — verify availability manually. incident.io *`schedule_show`* shows no PTO booked for the rotation members (Alfred, aiden.ramgoolam, Edder Núñez) this window.*

## SLOs / SLAs (15 minutes)

- [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
- [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
- [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — week-to-date (\~1.0 day in):** **0 incident.io Growth alert records** and \~**25 Datadog fire transitions** (net; 43 events − 18 recoveries) so far (window opened 2026-09-29 11:00 America/Mexico\_City / 17:00 UTC). | **Prior full week (Sep 22 → Sep 29, closed):** 4 incident.io records (3 High + 1 Low) — 3 acked, 1 auto-resolved — 0 incidents; 183 Datadog fires across 17 monitors. | **Trend:** 0 incident.io records week-to-date → run-rate \~0/wk vs prior 4/wk; the prior week's same first-day slice was also 0, so on pace with a quiet start (verdict from run-rate, not partial-vs-full). Datadog fire run-rate \~174/wk vs 183 prior → flat. **Human-attention: 0 · Auto-resolved: 0 · Escalation rate (alerts → incidents): 0/0 (n/a). Still firing: 0 active / 5 stale** (incident.io, re-verified via `alert_stats` — the same 5 orphans carried from prior weeks; none created after Sep 10).

*Priority = monitor severity/routing (High/Low); Warn/Alert = the level a fire crossed — independent. A High-priority monitor can fire only at Warn.*

## Incidents (15 minutes)

### Production Incidents — Customer Impact

**No production incidents this week** (incident.io `incident_list`, team L2-PENG-Growth → 0 in-window). Live page; fills in daily.

### Operational Incidents — Deploys / Data Repairs / Infra

**No operational incidents this week** (incident.io → 0). **No monitor config changes** in the window (Datadog `monitor_audit_event`, `team:l2-peng-growth` → 0 since 2026-09-29 17:00 UTC).

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

**No alerts required human attention this week** (0 incident.io Growth records created in-window).

### Auto-Resolved — Escalation Cancelled

**No alerts auto-resolved this week** (0 incident.io records). All Datadog activity this week was Warn-level monitor noise that never created an incident.io alert.

### Recurring / Flappy Alerts — Monitor Tuning Candidates

| Alert | Times Fired (week-to-date) | Notes |
| --- | --- | --- |
| SQS backlog cluster — [137629294](https://app.datadoghq.com/monitors/137629294) first-mile / [137629364](https://app.datadoghq.com/monitors/137629364) deactivate / [137629650](https://app.datadoghq.com/monitors/137629650) user-activation | **\~19** (7 / 5 / 7), all Warn, each self-recovered \~2–3 min | Standing SQS oldest-age backlog flappers (`approximate_age_of_oldest_message > 60s`, no env scope / no sustain). Datadog-only — **0 pages**. On pace \~140/wk. Tuning candidate — see recommendations. |
| svc-links error rate — [180229880](https://app.datadoghq.com/monitors/180229880) (resolveshortlink, P1/Warn) | **2**: (1) 2026-09-29 23:55 UTC → rec 00:23; (2) 2026-09-30 12:18 UTC → rec 12:47 | Warn branch (resolveshortlink) notifies Slack + agent only. The **Alert** branch (createshortlink), which pages `incidentio-high`, did **not** fire this week. Both self-recovered; monitor now OK. |
| svc-links anomaly — [180230890](https://app.datadoghq.com/monitors/180230890) (spike in request errors, P2) | **2**: (1) 2026-09-30 00:08 UTC → rec 01:08; (2) 2026-09-30 15:08 UTC → self-cleared (monitor now OK) | gRPC error-count anomaly; Slack-only (non-paging). Not yet a ledger row — fold into the svc-links cluster at the Oct 6 roll. |
| OTGE CPU throttling — [111957818](https://app.datadoghq.com/monitors/111957818) | **1**: 2026-09-30 08:49 UTC → rec 08:58 (\~9 min) | Container CPU throttling on `svc-earnings-sqs-one-time-granted-earnings` (env:prod); autoscaling absorbs it. Non-paging. |
| OTGE HPA sustained util — [111957822](https://app.datadoghq.com/monitors/111957822) (Warn) | **1**: 2026-09-30 09:15 UTC → rec 09:23 (\~8 min, production-eks-cluster \~80%) | HPA replica utilization; autoscaling handles. Non-paging. |

### 🔧 Monitor Tuning Recommendations (learned)

*Standing candidates from the ledger, evidence refreshed to this week-to-date (*`weeks_seen`* held until the Oct 6 handoff roll):*

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; pages for a self-resolving condition, incl. off-hours | Chronic (`weeks_seen` 13); **0 fires this week** (first-mile fires this wk were the SQS-backlog monitor 137629294, not the HPA); monitor OK | **Route HIGH → LOW / gate to critical.** before: util `> 90` Alert → `@webhook-incidentio-high`. after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | STRONGLY RECOMMEND |
| [180229880](https://app.datadoghq.com/monitors/180229880) — svc-links error rate (+ [180230890](https://app.datadoghq.com/monitors/180230890) anomaly + SLO/latency cluster) | Prod error/latency signal on the Sep-15 svc-links transfer surface (createshortlink paged High last week) | `weeks_seen` 1; this wk resolveshortlink Warn ×2 + anomaly 180230890 ×2 (Slack-only, **0 page**); monitor OK | **Do NOT tune → investigate + confirm ownership.** after: run the svc-links-internal runbook; confirm Growth is meant to own the 21-monitor svc-links surface and its on-call routing; only then consider a min-volume guard on the recurring resolveshortlink Warn. | high | RECOMMEND |
| [137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650) — SQS backlog cluster | Flappy backlog, no env scope / no sustain (Datadog noise; 0 incident.io pages) | \~19 fires wk-to-date (7/5/7), on pace \~140/wk; `weeks_seen` 11 / 10 / 10; 0 pages | **Add scope + sustain; verify routing.** before: SQS oldest-age Alert on `last_5m`, no env scope, no sustain. after: add `env:prod` + a sustain ≥ 10–15 min; verify the prod routing branch resolves. Coverage: a sustained real backlog still alerts. | med | RECOMMEND |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~55 days (Aug 7 cliff); `weeks_seen` 5; 0 fires this wk; monitor quiet | **Do NOT tune → investigate.** after: investigate via the Activation runbook (`kem-tug-987`); rule out an Aug 7 \~15:00 UTC deploy / instrumentation change vs a demand regression; open a Jira fix. | high | STRONGLY RECOMMEND |
| [89496579](https://app.datadoghq.com/monitors/89496579) — svc-verify → postman hello-postman synthetic (deleted Sep 29) | Cross-team synthetic tagged to Growth; paged High + renotified hourly overnight, deleted by on-call last week | Deleted Sep 29 16:37 UTC (prior week, observed audit); **0 fires this wk** (as expected) | **Re-home, do not tune.** after: confirm the deletion was intentional and re-create under `svc-verify`'s own team with a renotify limit, so Growth on-call is not paged for another team's synthetic. | high (observed page + deletion) | CHANGED (DELETED) |

*Top standing candidates by expected impact; **full history (36 rows) →*** [Monitor Tuning Ledger](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577/Growth+Team+Ops+Review+Monitor+Tuning+Ledger)*. Also tracked: the OOM routing fix [133647340](https://app.datadoghq.com/monitors/133647340) (validated ✓, held) and OTGE CPU [111957818](https://app.datadoghq.com/monitors/111957818) (1 fire this wk, non-paging).*

### 🔴 Open Going Into Handoff

**Active — Datadog Alert/Warn now: 0.** No Growth monitor reads Alert/Warn (`search_datadog_monitors team:l2-peng-growth status:(alert OR warn)` → none; the svc-links resolveshortlink/anomaly monitors that flapped today are back to OK).

**Stale / lingering incident.io alerts: 5** (carried from prior weeks; re-verified this run via `alert_stats` — 4 High + 1 Low; most-recent firing alert created Sep 10, so no new stale this week). None is an active prod problem; each needs a manual clear:

- Funnel-cashout expirations low ([143509449](https://app.datadoghq.com/monitors/143509449)) — High, firing since 2026-09-10; **orphaned** (monitor deleted Sep 22 15:43 UTC) — clear manually.
- Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High \[P2\], since 2026-06-03; real code bug → Jira + clear.
- Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low \[P4\], since 2026-07-23; same bug.
- Activation mem-util ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks group since 2026-05-29; monitor is `env:prod`-scoped and reads OK — lingering orphan; clear it.
- Databricks "Promotions Metrics Processor Job Failed" — High, since 2025-12-17; no live Datadog monitor. Verify the job + clear.

**0 active paging issues; 5 stale incident.io alerts to clear** — carried into this week; not a clean slate until those are cleared.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** **47 open** via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) (org-wide, as of 2026-09-30 10:07 AM PT) — 30 CRITICAL / 17 HIGH by ticket summary prefix (30 + 17 = 47). Secrets-detection findings dominate the Critical set and SCA dependency CVEs dominate High. Severity is read from the ticket summary prefix (the Jira priority field is uniformly "Low"). **org-wide** scope (no Growth-owned ticket). *Count is volatile intraday (was 45 at the Sep 29 handoff).*

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

*Carried forward for the primary (Alfred); nothing new was paged this week-to-date:*

* [ ] **Investigate the svc-links error/latency surface** ([180229880](https://app.datadoghq.com/monitors/180229880) resolveshortlink Warn + [180230890](https://app.datadoghq.com/monitors/180230890) anomaly, both Slack-only this week) — run the svc-links-internal runbook and confirm Growth ownership/routing of the 21-monitor surface from the Sep-15 transfer. Investigate, do NOT tune.
* [ ] **Confirm the svc-verify hello-postman synthetic deletion + re-home it** ([89496579](https://app.datadoghq.com/monitors/89496579)) — deleted by on-call Sep 29 to stop an hourly overnight renotify; confirm intended and re-create under `svc-verify`'s own team tag with a renotify limit.
* [ ] **Clear the 5 stale incident.io alerts** (4 High + 1 Low) — including the orphaned funnel-cashout alert ([143509449](https://app.datadoghq.com/monitors/143509449), monitor deleted) which can only be cleared manually; re-cover the real funnel-cashout-expiration drop.
* [ ] **Escalate the first-cashout volume drop** (\~55 days below baseline) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); open a Jira fix. Investigate the Activation funnel-anomaly cluster ([143518919](https://app.datadoghq.com/monitors/143518919) / [143516414](https://app.datadoghq.com/monitors/143516414) / [136473965](https://app.datadoghq.com/monitors/136473965) / [112981198](https://app.datadoghq.com/monitors/112981198) / [112982614](https://app.datadoghq.com/monitors/112982614)) with it. Do NOT tune.
* [ ] **Tune the SQS backlog cluster** ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650), \~19 fires wk-to-date, on pace \~140/wk): add `env:prod` + a 10–15 min sustain; verify the prod routing branch resolves.
* [ ] **Tune HPA **[135119948](https://app.datadoghq.com/monitors/135119948) (route HIGH → LOW; keep OOM / pod-not-ready at HIGH) and close out the Activation OOM routing fix ([133647340](https://app.datadoghq.com/monitors/133647340), validated ✓; optionally add `cluster_flavor:prod`; clear the mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342)).
* [ ] **Keep the incident.io connector authenticated** — healthy since the Sep 22 recovery; watch for another lapse.
* [ ] Review open vulnerability tickets — 47 open (30 Critical / 17 High), org-wide.

## 📝 Manual Notes (preserved across refreshes)

*Add notes here; they survive daily refreshes.*

---

*Generated by the Growth Team Ops Review agent. Window: 2026-09-29 11:00 → 2026-10-06 11:00 America/Mexico\_City (week-to-date; live, refreshed daily until it freezes at the Oct 6 handoff). Last refreshed: 2026-09-30 10:07 AM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities). No customer identifiers present this run. You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent.*
