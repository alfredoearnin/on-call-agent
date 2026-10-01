🔄 **Live page** — refreshed daily during the on-call week (2026-09-29 → 2026-10-06). Last refreshed **2026-10-01 10:01 AM PT (America/Los\_Angeles)** (\~2.0 days into the week). This page freezes at the Tuesday handoff (2026-10-06 11:00 America/Mexico\_City); a new page opens for the next week.

🗓️ **Week-to-date (\~2.0 days in): the chronic first-mile HPA monitor woke up.** **7 incident.io alert records** (1 High + 6 Low) — **all auto-resolved, 0 required human attention** — **0 incidents**, **0 monitor config changes**, and **0 Growth monitors in Alert/Warn right now**. All 7 **paged primary Alfred but auto-cancelled** on self-recovery: 6× the chronic first-mile HPA monitor [135119948](https://app.datadoghq.com/monitors/135119948) (Warn \~80% util, Low-urgency, several \~2–4 AM PT) + 1× svc-referral Apdex [27555488](https://app.datadoghq.com/monitors/27555488) (High, 1-min overnight blip). Datadog fire transitions \~**112 net** (201 events − 89 recoveries), running hot vs last week — SQS-backlog trio \~93, HPA first-mile 6, svc-links resolveshortlink/anomaly 8, OTGE CPU+HPA 4, svc-referral 1. Carried in from the closed week: **5 stale incident.io alerts** (4 High + 1 Low) still to clear, plus the svc-links transfer surface and the Activation funnel / first-cashout drop to investigate. **Prior week (Sep 22 → Sep 29, closed):** 4 incident.io records (3 acked Highs + 1 Low), 0 incidents, 183 Datadog fires. incident.io + Datadog + Jira healthy; vulnerabilities **50 open** (org-wide, volatile).

# Growth Team Ops Review — Weekly Handoff

**10/01/2026 Growth Team Ops Review** · On-call week **2026-09-29 11:00 → 2026-10-06 11:00** (America/Mexico\_City) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-10-01 10:01 AM PT** (week-to-date, \~2.0 days in; live, refreshed daily).

*This on-call week — primary: ****Alfred****; secondary: ****aiden.ramgoolam**** (shift 2026-09-29 → 2026-10-06; verified live via *`schedule_show`*). Next handoff 2026-10-06: primary ****aiden.ramgoolam****, secondary ****Edder Núñez****.*

*Verified live via *`schedule_show`* this run (incident.io connector healthy) — the rotation is confirmed unchanged from the Sep 29 handoff and no PTO is booked for the rotation this window.*

*Coverage check (Slack out-of-office, as of 2026-10-01 10:01 AM PT): could not be completed (no Slack profile-read tool available under either name) — verify availability manually. incident.io *`schedule_show`* shows no PTO booked for the rotation members (Alfred, aiden.ramgoolam, Edder Núñez) this window.*

## SLOs / SLAs (15 minutes)

- [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
- [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
- [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — week-to-date (\~2.0 days in):** **7 incident.io Growth alert records** (1 High + 6 Low), **all resolved**, and \~**112 net Datadog fire transitions** (201 events − 89 recoveries) so far (window opened 2026-09-29 11:00 America/Mexico\_City / 17:00 UTC). | **Prior full week (Sep 22 → Sep 29, closed):** 4 incident.io records (3 High + 1 Low) — 3 acked, 1 auto-resolved — 0 incidents; 183 Datadog fires across 17 monitors. | **Trend:** incident.io run-rate \~25/wk vs prior 4/wk → ↑, but **all 7 auto-resolved (0 required attention)** — the rise is the chronic first-mile HPA monitor 135119948 waking up Oct 1 (6 Low auto-cancelled pages), not new paging load (prior week's same 2-day slice was 1; verdict from run-rate). Datadog fire run-rate \~390/wk vs 183 prior → ↑ (SQS first-mile backlog running hot). **Human-attention: 0 · Auto-resolved: 7 · Escalation rate (alerts → incidents): 0/7 (0%). Still firing: 0 active / 5 stale** (incident.io, re-verified via `alert_stats` — the same 5 orphans carried from prior weeks; none created after Sep 10).

*Priority = monitor severity/routing (High/Low); Warn/Alert = the level a fire crossed — independent. A High-priority monitor can fire only at Warn.*

## Incidents (15 minutes)

### Production Incidents — Customer Impact

**No production incidents this week** (incident.io `incident_list`, team L2-PENG-Growth → 0 in-window). Live page; fills in daily.

### Operational Incidents — Deploys / Data Repairs / Infra

**No operational incidents this week** (incident.io → 0). **No monitor config changes** in the window (Datadog `monitor_audit_event`, `team:l2-peng-growth` → 0 since 2026-09-29 17:00 UTC).

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

**No alerts required human attention this week** — all 7 incident.io records this window auto-resolved (escalations cancelled on self-recovery; 0 acked by on-call).

### Auto-Resolved — Escalation Cancelled

**svc-referral Apdex **[27555488](https://app.datadoghq.com/monitors/27555488)** (High)**

**TL;DR:** svc-referral prod Apdex dipped below 0.9 for \~1 minute overnight (\~3:18 AM PT, Oct 1), paged primary Alfred at High, and self-recovered before any ack — no customer impact evident.

**What happened:** *Observed —* monitor [27555488](https://app.datadoghq.com/monitors/27555488) (`trace.aspnet_core.request.apdex.by.service{env:prod,service:svc-referral} < 0.9`, last\_5m) fired at **2026-10-01 10:18:08 UTC (\~3:18 AM PT)** and recovered 10:19:08 UTC (\~1 min). The incident.io High alert (01M3VFN3…) was created 10:20:10 UTC and resolved 10:21:10 UTC, paging Alfred via `@pagerduty-Referral` + `@webhook-incidentio-high` — escalation **cancelled** (no human ack). *Likely cause —* Cause not determined from available signals: a sub-minute Apdex dip at low overnight traffic, matching this monitor's known transient-blip pattern (ledger candidate 27555488); no deploy or incident correlated. A High page overnight for a self-resolving blip → tuning candidate (debounce / volume-guard), see recommendations.

**First-mile HPA sustained utilization **[135119948](https://app.datadoghq.com/monitors/135119948)** (Low) — fired 6×**

**TL;DR:** The chronic first-mile HPA-utilization monitor woke up Oct 1 and paged primary Alfred 6× at Low urgency (sustained \~80% of max replicas on production-eks-cluster), each auto-cancelling within minutes as autoscaling absorbed it — no customer impact.

**What happened:** *Observed —* monitor [135119948](https://app.datadoghq.com/monitors/135119948) (first-mile HPA `current_replicas / max_replicas > 90%` Alert / \~80% Warn, `cluster_flavor:prod`, `kube_cluster_name:production-eks-cluster`) crossed Warn 6× on 2026-10-01, each creating a Low incident.io alert routed to Alfred (`@pagerduty-growth-low-urgency` + `@webhook-incidentio-low`), each escalation **cancelled** on self-recovery (\~7–9 min): (1) 2026-10-01 01:51:08 UTC (\~6:51 PM PT Sep 30); (2) 2026-10-01 04:41:08 UTC (\~9:41 PM PT Sep 30); (3) 2026-10-01 09:08:08 UTC (\~2:08 AM PT); (4) 2026-10-01 09:31:08 UTC (\~2:31 AM PT); (5) 2026-10-01 09:52:08 UTC (\~2:52 AM PT); (6) 2026-10-01 10:51:08 UTC (\~3:51 AM PT). Utilization peaked \~80–83%; the \>90% Alert branch (which also lists `@pagerduty-Activation-Alerts` / `@webhook-incidentio-high`) did **not** trip. Monitor reads OK now. *Likely cause —* routine autoscaling headroom pressure on the first-mile calc processor: autoscaling scaled out and the condition cleared each time; no incident, no customer impact. This is the ledger's chronic #1 tuning candidate (`weeks_seen` 13), now with live evidence that it pages on-call (incl. overnight) for a self-resolving condition — see Tuning Recommendations.

### Recurring / Flappy Alerts — Monitor Tuning Candidates

| Alert | Times Fired (week-to-date) | Notes |
| --- | --- | --- |
| SQS backlog cluster — [137629294](https://app.datadoghq.com/monitors/137629294) first-mile / [137629364](https://app.datadoghq.com/monitors/137629364) deactivate / [137629650](https://app.datadoghq.com/monitors/137629650) user-activation | **\~93** (66 / 12 / 15), all Warn, each self-recovered \~2–3 min | Standing SQS oldest-age backlog flappers (`approximate_age_of_oldest_message`, no env scope / no sustain). Datadog-only — **0 pages**. **Running hot**: \~93 in 2 days vs 140 across all of last week (run-rate \~325/wk). Tuning candidate — see recommendations. |
| First-mile HPA sustained util — [135119948](https://app.datadoghq.com/monitors/135119948) (Warn) | **6** (all 2026-10-01; Low pages to on-call, each auto-cancelled) | Chronic #1 ledger candidate (`weeks_seen` 13), **0 fires on Sep 30 → 6 fires Oct 1**. \~80% replica util on production-eks-cluster; autoscaling absorbs. Paged Low (incl. \~2–4 AM PT). See Auto-Resolved + recommendations. |
| svc-links error rate — [180229880](https://app.datadoghq.com/monitors/180229880) (resolveshortlink, P1/Warn) | **6** (Sep 29 23:55 → Oct 1 02:23 UTC, each self-cleared \~30 min) | Warn branch (resolveshortlink) notifies Slack + agent only. The **Alert** branch (createshortlink), which pages `incidentio-high`, did **not** fire this week. Monitor OK now. |
| svc-links anomaly — [180230890](https://app.datadoghq.com/monitors/180230890) (spike in request errors, P2) | **2**: (1) 2026-09-30 00:08 UTC → rec 01:08; (2) 2026-09-30 15:08 UTC → rec 17:08 | gRPC error-count anomaly; Slack-only (non-paging). Fold into the svc-links cluster at the Oct 6 roll. |
| OTGE CPU throttling — [111957818](https://app.datadoghq.com/monitors/111957818) | **2**: Sep 30 08:49 → rec 08:58; Oct 1 08:45 → rec 08:58 UTC | Container CPU throttling on `svc-earnings-sqs-one-time-granted-earnings` (env:prod); autoscaling absorbs it. No handles — non-paging. |
| OTGE HPA sustained util — [111957822](https://app.datadoghq.com/monitors/111957822) (Warn) | **2**: Sep 30 09:15 → rec 09:23; Oct 1 09:21 → rec 09:28 UTC (\~80% max replicas, production-eks-cluster) | OTGE HPA replica utilization; autoscaling handles. No handles — non-paging. |
| svc-referral Apdex — [27555488](https://app.datadoghq.com/monitors/27555488) (High) | **1**: 2026-10-01 10:18 UTC (\~3:18 AM PT) → rec 10:19 (\~1 min) | High Apdex \< 0.9 overnight blip; paged High, auto-cancelled. Recurring transient night-page — see Auto-Resolved + recommendations. |

### 🔧 Monitor Tuning Recommendations (learned)

*Top standing candidates by expected impact, evidence refreshed to this week-to-date (*`weeks_seen`* held until the Oct 6 handoff roll):*

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — first-mile HPA sustained high utilization | Infra saturation autoscaling handles; a Warn transition pages the on-call (Low) for a self-resolving condition, incl. overnight | `weeks_seen` 13; **6 fires this wk (all Oct 1)**, each a Low page to Alfred, all auto-cancelled, several \~2–4 AM PT; 0→6 vs Sep 30; monitor OK now | **Add sustain / suppress the Warn-level page.** before: \~80% Warn → `@pagerduty-growth-low-urgency` + `@webhook-incidentio-low` (and a \>90 Alert branch to `@webhook-incidentio-high` + `@pagerduty-Activation-Alerts`). after: add a sustain ≥ 10–15 min (or drop the Warn-level on-call page — autoscaling absorbs \~80% util), and keep the \>90 Alert branch at Low (not High/Activation); keep OOM / pod-not-ready at High. Coverage: a real capacity pin still pages. | high | STRONGLY RECOMMEND |
| [27555488](https://app.datadoghq.com/monitors/27555488) — svc-referral Apdex \< 0.9 (env:prod) | Transient overnight Apdex dip paging High (auto-resolved-no-ack + night page; Apdex volatile at low overnight traffic) | `weeks_seen` 3; **1 fire this wk** — Oct 1 10:18 UTC (\~3:18 AM PT), High, \~1-min blip, paged High + auto-cancelled | **Debounce and/or add a volume guard (or route transient dips to Low).** before: `avg(last_5m) apdex{env:prod,service:svc-referral} < 0.9` → High (`@pagerduty-Referral` + `@webhook-incidentio-high`). after: require the breach sustained (`last_15m` or ≥ 2 eval windows) and/or add a minimum request-volume guard (**needs baseline**); or route sub-15-min dips → Slack/Low. Coverage: a sustained real Apdex degradation still pages High. | med | RECOMMEND |
| [137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650) — SQS backlog cluster | Flappy backlog, no env scope / no sustain (Datadog noise; 0 incident.io pages) | \~93 fires wk-to-date (66/12/15), **running hot** (\~2.3× last week's rate); `weeks_seen` 11 / 10 / 10; 0 pages | **Add scope + sustain; verify routing.** before: SQS oldest-age Alert on `last_5m`, no env scope, no sustain. after: add `env:prod` + a sustain ≥ 10–15 min; verify the prod routing branch resolves. Coverage: a sustained real backlog still alerts. | med | RECOMMEND |
| [180229880](https://app.datadoghq.com/monitors/180229880) — svc-links error rate (+ [180230890](https://app.datadoghq.com/monitors/180230890) anomaly) | Prod error/latency signal on the Sep-15 svc-links transfer surface (createshortlink paged High the prior week) | `weeks_seen` 1; this wk resolveshortlink Warn ×6 + anomaly 180230890 ×2 (Slack-only, **0 page**); monitor OK | **Do NOT tune → investigate + confirm ownership.** after: run the svc-links-internal runbook; confirm Growth is meant to own the 21-monitor svc-links surface and its on-call routing; only then consider a min-volume guard on the recurring resolveshortlink Warn. | high | RECOMMEND |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~55+ days (Aug 7 cliff); `weeks_seen` 5; 0 fires this wk (weekly model adapting); monitor quiet | **Do NOT tune → investigate.** after: investigate via the Activation runbook (`kem-tug-987`); rule out an Aug 7 \~15:00 UTC deploy / instrumentation change vs a demand regression; open a Jira fix. | high | STRONGLY RECOMMEND |

*Top candidates by expected impact; ****full history (36 rows) →*** [Monitor Tuning Ledger](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577/Growth+Team+Ops+Review+Monitor+Tuning+Ledger)*. Also tracked: the OOM routing fix *[*133647340*](https://app.datadoghq.com/monitors/133647340)* (validated ✓, held), the svc-verify hello-postman synthetic *[*89496579*](https://app.datadoghq.com/monitors/89496579)* (changed/deleted Sep 29, re-home pending), the OTGE CPU/HPA siblings *[*111957818*](https://app.datadoghq.com/monitors/111957818)* / *[*111957822*](https://app.datadoghq.com/monitors/111957822)* (non-paging), and the funnel-cashout cluster.*

### 🔴 Open Going Into Handoff

**Active — Datadog Alert/Warn now: 0.** No Growth monitor reads Alert/Warn (`search_datadog_monitors team:l2-peng-growth status:(alert OR warn)` → none; the first-mile HPA, svc-links and OTGE monitors that flapped today are all back to OK).

**Stale / lingering incident.io alerts: 5** (carried from prior weeks; re-verified this run via `alert_stats` — 4 High + 1 Low; most-recent firing alert created Sep 10, so no new stale this week). None is an active prod problem; each needs a manual clear:

- Funnel-cashout expirations low ([143509449](https://app.datadoghq.com/monitors/143509449)) — High, firing since 2026-09-10; **orphaned** (monitor deleted Sep 22 15:43 UTC) — clear manually.
- Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High \[P2\], since 2026-06-03; real code bug → Jira + clear.
- Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low \[P4\], since 2026-07-23; same bug.
- Activation mem-util ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks group since 2026-05-29; monitor is `env:prod`-scoped and reads OK — lingering orphan; clear it.
- Databricks "Promotions Metrics Processor Job Failed" — High, since 2025-12-17; no live Datadog monitor. Verify the job + clear.

**0 active paging issues; 5 stale incident.io alerts to clear** — carried into this week; not a clean slate until those are cleared.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** **50 open** via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) (org-wide, as of 2026-10-01 10:01 AM PT) — 33 CRITICAL / 17 HIGH by ticket summary prefix (33 + 17 = 50). Secrets-detection findings dominate the Critical set and SCA dependency CVEs dominate High. Severity is read from the ticket summary prefix (the Jira priority field is uniformly "Low"). **org-wide** scope (no Growth-owned ticket). *Count is volatile intraday (was 47 on Sep 30, 45 at the Sep 29 handoff).*

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

*Carried forward for the primary (Alfred); the new signal this week-to-date is the first-mile HPA monitor paging Low (incl. overnight) and a High svc-referral Apdex night page — both auto-resolved:*

* [ ] **Tune / gate the first-mile HPA monitor **[135119948](https://app.datadoghq.com/monitors/135119948) — it woke up Oct 1 and paged on-call 6× at Low (several \~2–4 AM PT), all auto-cancelled. Add a sustain ≥ 10–15 min or drop the Warn-level on-call page (autoscaling absorbs \~80% util); keep the \>90 Alert branch at Low (not High/Activation) and OOM / pod-not-ready at High.
* [ ] **Debounce svc-referral Apdex **[27555488](https://app.datadoghq.com/monitors/27555488) — fired High overnight (\~3:18 AM PT Oct 1) on a \~1-min blip and auto-cancelled. Require the breach sustained (last\_15m or ≥ 2 windows) and/or add a min-volume guard (needs baseline), or route sub-15-min dips to Low.
* [ ] **Investigate the svc-links error/latency surface** ([180229880](https://app.datadoghq.com/monitors/180229880) resolveshortlink Warn ×6 + [180230890](https://app.datadoghq.com/monitors/180230890) anomaly ×2, Slack-only this week) — run the svc-links-internal runbook and confirm Growth ownership / routing of the 21-monitor surface from the Sep-15 transfer. Investigate, do NOT tune.
* [ ] **Clear the 5 stale incident.io alerts** (4 High + 1 Low) — including the orphaned funnel-cashout alert ([143509449](https://app.datadoghq.com/monitors/143509449), monitor deleted) which can only be cleared manually; re-cover the real funnel-cashout-expiration drop.
* [ ] **Escalate the first-cashout volume drop** (\~55+ days below baseline) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); open a Jira fix. Investigate the Activation funnel-anomaly cluster ([143518919](https://app.datadoghq.com/monitors/143518919) / [143516414](https://app.datadoghq.com/monitors/143516414) / [112981198](https://app.datadoghq.com/monitors/112981198) / [112982614](https://app.datadoghq.com/monitors/112982614)) with it. Do NOT tune.
* [ ] **Tune the SQS backlog cluster** ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650), \~93 fires wk-to-date and running hot): add `env:prod` + a 10–15 min sustain; verify the prod routing branch resolves.
* [ ] **Confirm the svc-verify hello-postman synthetic deletion + re-home it** ([89496579](https://app.datadoghq.com/monitors/89496579)) — deleted by on-call Sep 29 to stop an hourly overnight renotify; confirm intended and re-create under `svc-verify`'s own team tag with a renotify limit. Close out the Activation OOM routing fix ([133647340](https://app.datadoghq.com/monitors/133647340), validated ✓).
* [ ] **Keep the incident.io connector authenticated** — healthy since the Sep 22 recovery; watch for another lapse.
* [ ] Review open vulnerability tickets — 50 open (33 Critical / 17 High), org-wide.

## 📝 Manual Notes (preserved across refreshes)

*Add notes here; they survive daily refreshes.*

---

*Generated by the Growth Team Ops Review agent. Window: 2026-09-29 11:00 → 2026-10-06 11:00 America/Mexico\_City (week-to-date; live, refreshed daily until it freezes at the Oct 6 handoff). Last refreshed: 2026-10-01 10:01 AM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities). No customer identifiers present this run. You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent.*
