🔄 **Live page** — refreshed daily during the on-call week (2026-09-22 → 2026-09-29). Last refreshed **2026-09-22 11:44 AM PT (America/Los\_Angeles)** (\~1.7 h into the week). This page freezes at the Tuesday handoff (2026-09-29 11:00 America/Mexico\_City); a new page opens for the next week.

✅ **incident.io connector recovered this run** — back after 6 consecutive down runs (needs-auth, Sep 16–22, incl. the Sep 22 handoff open). Alert enrichment, the human-attention / auto-resolved split, escalation rate, the incident list, on-call verification, and the stale-alert recheck are all restored. The rotation and the 6 stale alerts below are now **verified live** (no longer carried-forward). Datadog + Jira remain healthy.

🌟 **New on-call week, \~1.7 h in.** 0 incident.io Growth alert records and 0 incidents since the Sep 22 handoff; 1 Datadog Warn transition (the standing SQS flapper [137629294](https://app.datadoghq.com/monitors/137629294) at 17:18 UTC, self-recovered) and 0 monitors read Alert/Warn now. The prior week (2026-09-15 → 2026-09-22) closed with **2 incident.io records** (1 High + 1 Low, both auto-resolved), 0 incidents, and 130 Datadog transitions (\~95% the SQS flapper); it also validated the Activation OOM routing fix and saw funnel monitor [143509449](https://app.datadoghq.com/monitors/143509449) deleted by Cashout-infra.

# Growth Team Ops Review — Weekly Handoff

**09/22/2026 Growth Team Ops Review** · On-call week **2026-09-22 11:00 → 2026-09-29 11:00** (America/Mexico\_City) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-09-22 11:44 AM PT** (week-to-date, \~1.7 h in; live, refreshed daily).

*This on-call week — primary: **Ankur Shivani**; secondary: **Alfred** (shift Tue 2026-09-22 → Tue 2026-09-29; verified live via *`schedule_show`*). Next handoff 2026-09-29: primary **Alfred**, secondary **aiden.ramgoolam**.*

*Verified live via *`schedule_show`* this run — the incident.io connector recovered after 6 down runs (Sep 16–22), so the rotation is now confirmed (previously carried-forward).*

*Coverage check (Slack out-of-office, as of 2026-09-22 11:44 AM PT): could not be completed (no Slack profile-read tool available under either name) — verify availability manually. incident.io *`schedule_show`* showed no PTO booked for the four rotation members this window.*

## SLOs / SLAs (15 minutes)

- [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
- [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
- [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — week-to-date (\~1.7 h in):** **0 incident.io Growth alert records**; 1 Datadog Warn transition (SQS flapper [137629294](https://app.datadoghq.com/monitors/137629294), self-recovered); 0 monitors read Alert/Warn now. | **Prior full week (Sep 15 → Sep 22, just closed):** 2 incident.io records (1 High + 1 Low), both auto-resolved, 0 incidents; 130 Datadog transitions (\~95% SQS flapper). | **Trend: too early to call** (\~1.7 h into the week). **Human-attention: 0 · Auto-resolved: 0 · Escalation rate: 0/0**. **Still firing: 0 active / 6 stale** (incident.io, re-verified this run).

*Priority = monitor severity/routing (High/Low); Warn/Alert = the level a fire crossed — independent. A High-priority monitor can fire only at Warn.*

## Incidents (15 minutes)

### Production Incidents — Customer Impact

**No production incidents this week** (incident.io `incident_list`, team L2-PENG-Growth → 0). Carry-over items still tracked (no new activity): the quick-reply dead-button frontend bug (INC-2824, [312932032](https://app.datadoghq.com/monitors/312932032)) and the Anthropic-quota fragility (INC-2795 class, [309355473](https://app.datadoghq.com/monitors/309355473)).

### Operational Incidents — Deploys / Data Repairs / Infra

**No operational incidents this week** (incident.io → 0). No monitor config changes since the Sep 22 handoff (funnel monitor [143509449](https://app.datadoghq.com/monitors/143509449) was deleted Sep 22 15:43 UTC, in the prior week).

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

No alerts have required human attention yet this week — 0 incident.io Growth records since the Sep 22 handoff, 0 acked.

### Auto-Resolved — Escalation Cancelled

No alerts auto-resolved yet this week (0 incident.io records so far).

### Recurring / Flappy Alerts — Monitor Tuning Candidates

One Datadog transition so far this week: the standing SQS backlog flapper [137629294](https://app.datadoghq.com/monitors/137629294) (First Mile Calculations) fired 1 Warn at Sep 22 17:18 UTC and self-recovered — the usual `last_5m` oldest-age noise (no incident.io page). Standing candidates (HPA [135119948](https://app.datadoghq.com/monitors/135119948), the SQS cluster, the svc-notification-preferences latency pair, etc.) are tracked in the [Monitor Tuning Ledger](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577/Growth+Team+Ops+Review+Monitor+Tuning+Ledger) and below.

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; pages for a self-resolving condition, incl. off-hours | Chronic (weeks\_seen 12); 0 fires so far this week; monitor OK | **Route HIGH → LOW / gate to critical.** before: util `> 90` Alert → `@webhook-incidentio-high`. after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | STRONGLY RECOMMEND |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~46 days (Aug 7 cliff); weeks\_seen 5; monitor quiet | **Do NOT tune → investigate.** after: investigate via the Activation runbook (`kem-tug-987`); rule out an Aug 7 \~15:00 UTC deploy / instrumentation change vs a demand regression; open a Jira fix. | high | STRONGLY RECOMMEND |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM (+ sibling [133647342](https://app.datadoghq.com/monitors/133647342) mem-util) | Activation dev-leak: a dev-eks OOM used to page prod on-call High | **Validated last week:** a dev-eks OOM fired Sep 22 and did NOT page prod (handles prod-gated). weeks\_seen 6 | **ACHIEVED / validated.** Minor remaining: add `cluster_flavor:prod` so it stops entering Alert on dev; clear the stale mem-util 133647342 dev-eks orphan (query is env:prod-scoped, reads OK). Coverage: prod OOM still pages High. | high (observed diff + fire) | VALIDATED ✓ |
| [137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650) — SQS backlog cluster | Flappy backlog, no env scope / no sustain (Datadog noise; 0 incident.io pages) | Fired 70 / 34 / 20 last week; 1 warn so far this week; weeks\_seen 10 / 9 / 9 | **Add scope + sustain; verify routing.** before: SQS oldest-age Alert on `last_5m`, no env scope, no sustain. after: add `env:prod` + a sustain ≥ 10–15 min; verify the prod routing branch resolves. Coverage: a sustained real backlog still alerts. | med | RECOMMEND |
| [143509449](https://app.datadoghq.com/monitors/143509449) — funnel-cashout expirations low | Real sustained-low drop; monitor **DELETED by Cashout-infra Sep 22** — removing alerting on a real drop (coverage loss, not a noise fix) | Fired 8× last week then deleted Sep 22 15:43 UTC; weeks\_seen 6; its 2 incident.io alerts now orphaned | **Superseded by deletion — no monitor tuning to apply.** Clear the 2 orphaned incident.io alerts; confirm the deletion was intentional; the underlying funnel-cashout-expiration drop (tied to first-cashout) still needs an Activation investigation now its monitor is gone. | high (observed delete) | RESOLVED (DELETED) |

*Top 5 by expected impact; **full history (30 rows) →*** [Monitor Tuning Ledger](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577/Growth+Team+Ops+Review+Monitor+Tuning+Ledger)*. Carried into the new week; weeks\_seen holds until the next Tue handoff (2026-09-29). Last week validated the Activation OOM routing fix (133647340) and saw the funnel monitor 143509449 deleted by Cashout-infra.*

### 🔴 Open Going Into the Week

**Active — Datadog Alert/Warn now: 0.** No Growth monitor reads Alert/Warn (`search_datadog_monitors team:l2-peng-growth status:(alert OR warn)` → none). The one SQS flapper Warn (17:18 UTC) already self-recovered.

**Stale / lingering incident.io alerts: 6 (re-verified via incident.io this run — all still firing).** None are an active prod problem; each needs a manual clear:

- Funnel-cashout expirations low ([143509449](https://app.datadoghq.com/monitors/143509449)) — High, since 2026-09-14 01:24 UTC. **Orphaned — the monitor was deleted Sep 22 15:43 UTC**, so it can no longer auto-resolve; clear manually.
- Funnel-cashout expirations low ([143509449](https://app.datadoghq.com/monitors/143509449)) — High, since 2026-09-10 03:24 UTC. Same deleted monitor — orphaned; clear manually.
- Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High \[P2\], since 2026-06-03; Datadog No Data. Code bug → Jira + clear.
- Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low \[P4\], since 2026-07-23; same bug.
- Activation mem-util ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks group since 2026-05-29; Datadog monitor now `env:prod`-scoped and reads OK — the dev-eks alert is a lingering orphan; clear it.
- Databricks "Promotions Metrics Processor Job Failed" — High, since 2025-12-17; no live Datadog monitor. Verify the job + clear.

**0 active paging issues; 6 stale incident.io alerts to clear** (re-verified) — not a clean handoff until those are cleared. The two 143509449 alerts are orphaned by the monitor deletion and can only be cleared manually.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** **30 open** via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) (org-wide, as of 2026-09-22 11:44 AM PT) — 26 CRITICAL / 2 HIGH by ticket summary prefix, plus 2 security tickets with no severity prefix (CORS misconfig `WEBPLAT-1489`, In Review; IAM config review `ACC-6258`, In Progress). The 26 Criticals: `io.netty:netty-handler` (10), Next.js (3), `org.bouncycastle:bcprov-jdk18on` (2), `System.Text.Encodings.Web` (1), and 10 secrets-detection findings. 2 High: `netty-codec-http` (KMONO-59) and log-leakage SAST (SV-4848). Severity from the ticket summary prefix (Jira priority field uniformly "Low"). Secrets tickets carry generic titles (no values). **org-wide** scope (no Growth-owned ticket). *Count is volatile intraday.*

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

* [ ] **Clear the 2 orphaned funnel-cashout incident.io alerts** ([143509449](https://app.datadoghq.com/monitors/143509449), firing since Sep 10 + Sep 14) — the Datadog monitor was deleted Sep 22 15:43 UTC so they can no longer auto-resolve. Confirm the deletion was intentional; the real funnel-cashout-expiration drop now has no monitor — re-cover or fold into the Activation investigation.
* [ ] **Keep the incident.io connector authenticated** — it recovered this run after 6 down runs (Sep 16–22); the whole prior on-call week ran without alert enrichment. Watch for another needs-auth lapse.
* [ ] **Triage the svc-referral prod Apdex breach** from last week ([27555488](https://app.datadoghq.com/monitors/27555488)) — fired Sun Sep 20 10:44 UTC (\~3:44 AM PT), paged primary Nabi, escalation cancelled on \~2-min self-resolve. Check APM traces/logs and any Sep 20 deploy; if it recurs, require ≥ 2 consecutive windows before paging.
* [ ] **Escalate the first-cashout volume drop** (\~46 days below baseline) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); check the Aug 7 \~15:00 UTC cliff (deploy vs demand); open a Jira fix. Do NOT tune the monitor.
* [ ] **Route the Activation funnel-anomaly cluster to one investigation** (registration-completion [143518919](https://app.datadoghq.com/monitors/143518919); good-to-go [143516414](https://app.datadoghq.com/monitors/143516414); funnel-promotion [136473965](https://app.datadoghq.com/monitors/136473965); OTGE anomaly [112981198](https://app.datadoghq.com/monitors/112981198)) — anomalies echoing the funnel-cashout / first-cashout drop. Investigate, do NOT tune.
* [ ] **Confirm the **`svc-links-internal`** ownership transfer is intended** (21 prod monitors moved into `team:l2-peng-growth` on Sep 15; SLO burn-rate [181530102](https://app.datadoghq.com/monitors/181530102) fired once Sep 17). Verify Growth on-call routing / coverage.
* [ ] **Tune the SQS backlog cluster** ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650), fired 70 / 34 / 20 last week): add `env:prod` + a 10–15 min sustain; verify the prod routing branch resolves.
* [ ] **Tune HPA **[135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate to critical-only); keep OOM / pod-not-ready at HIGH. Chronic (weeks\_seen 12).
* [ ] **Close out the Activation OOM routing fix** ([133647340](https://app.datadoghq.com/monitors/133647340), validated last week): optionally add `cluster_flavor:prod`; clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342).
* [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582)) and clear the 2 stale alerts once shipped; verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (\~9 months).
* [ ] Review open vulnerability tickets — 30 open (26 Critical / 2 High + 2 unlabeled), org-wide; 10 secrets-detection + 10 netty-handler + 3 Next.js + 2 bouncycastle Criticals lead.

## 📝 Manual Notes (preserved across refreshes)

*Add notes here; they survive daily refreshes.*

---

*Generated by the Growth Team Ops Review agent. Window: 2026-09-22 11:00 → 2026-09-29 11:00 America/Mexico\_City (week-to-date; live, refreshed daily until it freezes at the Sep 29 handoff). Last refreshed: 2026-09-22 11:44 AM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities). incident.io recovered this run after 6 down runs (Sep 16–22); rotation + stale set re-verified. Customer identifiers redacted where present (none required this run). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent.*
