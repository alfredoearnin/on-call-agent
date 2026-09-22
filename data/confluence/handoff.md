🔄 **Live page** — refreshed daily during the on-call week (2026-09-22 → 2026-09-29). Last refreshed **2026-09-22 10:04 AM PT (America/Los\_Angeles)** (just opened at the Tue 11:00 America/Mexico\_City handoff, \~0.1 h in). This page freezes at the Tuesday handoff (2026-09-29 11:00 America/Mexico\_City); a new page opens for the next week.

⚠️ **incident.io connector unavailable at week-open (needs auth) — unchanged since Sep 16 (now 6 daily runs in a row).** Alert enrichment, the human-attention / auto-resolved split, escalation rate, the incident list, on-call re-verification, and the stale-alert recheck cannot run. Alert data is **Datadog-only**; on-call names and the 6 stale alerts are **carried forward from the last verified state (2026-09-15)**. Datadog and Jira are healthy. See Action Items to re-authenticate the connector.

🌟 **New on-call week opened at the Tue Sep 22 11:00 America/Mexico\_City handoff.** 0 Growth alert transitions so far and 0 monitors reading Alert/Warn. The prior week (2026-09-15 → 2026-09-22) closed with 9 Growth monitors fired / 130 Datadog transitions (\~95% the standing SQS flapper), all self-recovered, 0 firing at close, and a **validated** Activation OOM routing fix (a dev-eks OOM did not page prod). incident.io was down all of last week, so a comparable alert-record count is unavailable.

# Growth Team Ops Review — Weekly Handoff

**09/22/2026 Growth Team Ops Review** · On-call week **2026-09-22 11:00 → 2026-09-29 11:00** (America/Mexico\_City) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-09-22 10:04 AM PT** (week-to-date, \~0.1 h in; live, refreshed daily).

*This on-call week — primary: ****Ankur Shivani****; secondary: ****Alfred**** (shift Tue 2026-09-22 → Tue 2026-09-29). Next handoff 2026-09-29: primary ****Alfred****, secondary ****aiden.ramgoolam****.*

*Last verified (2026-09-15) via* `schedule_show`*; not re-verified this run — incident.io connector unavailable (needs auth). Rotation carried forward from last known, not invented — re-verify at the next successful incident.io run.*

*Coverage check (Slack out-of-office, as of 2026-09-22 10:04 AM PT): could not be completed (no Slack profile-read tool available under either name) — verify availability manually.*

## SLOs / SLAs (15 minutes)

- [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
- [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
- [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — week-to-date (\~0.1 h in; Datadog-only — incident.io down):** **0 Growth alert transitions** since the Sep 22 handoff; **0 monitors read Alert/Warn now**. | **Prior full week (Sep 15 → Sep 22, just closed):** 9 Growth monitors fired, 130 Datadog Warn/Alert transitions (102 Warn + 28 Alert), all self-recovered, 0 firing at close; \~95% the standing SQS flapper cluster. | **Trend: too early to call** (\~0.1 h into the week). **Human-attention: n/a · Auto-resolved: n/a · Escalation rate: n/a** (all require incident.io, which is down). **Still firing: 0 active** (Datadog) **/ 6 stale carried, not re-verified** (incident.io down).

*Priority = monitor severity/routing (High/Low); Warn/Alert = the level a fire crossed — independent. A High-priority monitor can fire only at Warn.*

## Incidents (15 minutes)

### Production Incidents — Customer Impact

**Data unavailable — check incident.io manually (connector returned Unauthorized / needs auth).** No production incidents observable in Datadog at week-open. Two carry-over items remain tracked but not re-verified: the quick-reply dead-button frontend bug (INC-2824, [312932032](https://app.datadoghq.com/monitors/312932032)) and the Anthropic-quota fragility (INC-2795 class, [309355473](https://app.datadoghq.com/monitors/309355473)).

### Operational Incidents — Deploys / Data Repairs / Infra

Data unavailable — check incident.io manually (connector returned Unauthorized / needs auth). No monitor config changes at week-open (last change was the Sep 15 svc-links-internal transfer, in the prior week).

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

No alerts have required human attention yet this week. *(Acknowledgement is an incident.io determination and the connector is down — the human-attention split cannot be computed this run; Datadog shows 0 fires so far.)*

### Auto-Resolved — Escalation Cancelled

No alerts auto-resolved yet this week. *(Auto-resolution is an incident.io determination — connector down; Datadog shows 0 fires so far.)*

### Recurring / Flappy Alerts — Monitor Tuning Candidates

No recurring / flappy alerts yet this week. Standing candidates from prior weeks (the SQS backlog cluster [137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650), HPA [135119948](https://app.datadoghq.com/monitors/135119948), and others) are tracked in the [Monitor Tuning Ledger](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577/Growth+Team+Ops+Review+Monitor+Tuning+Ledger) and carried below.

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; pages for a self-resolving condition, incl. off-hours | Chronic (weeks\_seen 12); 0 fires last week; monitor OK | **Route HIGH → LOW / gate to critical.** before: util `> 90` Alert → `@webhook-incidentio-high`. after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | STRONGLY RECOMMEND |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~46 days (Aug 7 cliff); weeks\_seen 5; monitor quiet (model adapting) | **Do NOT tune → investigate.** before: monitor unchanged. after: investigate via the Activation runbook (`kem-tug-987`); rule out an Aug 7 \~15:00 UTC deploy / instrumentation change vs a demand regression; open a Jira fix. Coverage: monitor unchanged. | high | STRONGLY RECOMMEND |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM (+ sibling [133647342](https://app.datadoghq.com/monitors/133647342) mem-util) | Activation dev-leak: a dev-eks OOM used to page prod on-call High because the page handles were unconditional | **Validated last week:** a dev-eks OOM fired Sep 22 13:38 UTC and hit the dev branch (no channel) — did NOT page prod. Handles confirmed prod-gated. weeks\_seen 6 | **ACHIEVED / validated.** Remaining (minor): the query still has no env scope so it still enters Alert on dev; optionally add `cluster_flavor:prod`; clear the stale mem-util 133647342 dev-eks orphan. Coverage: prod OOM still pages High. | high (observed diff + fire) | VALIDATED ✓ |
| [137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650) — SQS backlog cluster | Flappy backlog, no env scope / no sustain (Datadog noise; historically 0 incident.io pages) | Fired 70 / 34 / 20 last week (all self-recovered in minutes); weeks\_seen 10 / 9 / 9 | **Add scope + sustain; verify routing.** before: SQS oldest-age Alert on `last_5m`, no env scope, no sustain. after: add `env:prod` + a sustain ≥ 10–15 min; verify the prod routing branch resolves. Coverage: a sustained real backlog still alerts. | med | RECOMMEND |
| [143509449](https://app.datadoghq.com/monitors/143509449) — funnel-cashout expirations low | Real, sustained-low expiration drop — actively firing (8× last week); Cashout-infra-owned (`team:l3-cash-cashoutinfra`), incidentio-low | Fired 8× last week (latest Sep 22 08:24 UTC), threshold `< 2` (applied, was `< 5`); weeks\_seen 6; drop persists; out of the `team:l2-peng-growth` scope | **Applied (threshold 5 → 2); do NOT tune further.** Confirm the incidentio-low re-route + the ownership move to Cashout-infra were intentional. Still needed: investigate throughput + the retrigger-funnel-cashout cronjob. Coverage: a real funnel-cashout outage still pages CashoutService. | high (observed diff) | APPLIED |

*Top 5 by expected impact; ****full history (30 rows) →*** [Monitor Tuning Ledger](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577/Growth+Team+Ops+Review+Monitor+Tuning+Ledger)*. Carried into the new week; weeks\_seen holds until the next Tue handoff (2026-09-29). Last week validated the Activation OOM routing fix (133647340).*

### 🔴 Open Going Into the Week

**Active — Datadog Alert/Warn now: 0.** No Growth monitor reads Alert/Warn at week-open (`search_datadog_monitors team:l2-peng-growth status:(alert OR warn)` → none).

**Stale / lingering incident.io alerts: not re-verified this run (incident.io connector down).** The **6** below are carried forward from the last verified check (Sep 15) and still need a manual clear — re-confirm once incident.io is back. Note: [143509449](https://app.datadoghq.com/monitors/143509449) fired 8× in Datadog last week, so its 2 alerts may be **active, not stale**:

- Funnel-cashout expirations low ([143509449](https://app.datadoghq.com/monitors/143509449)) — High, since 2026-09-14 01:24 UTC (may be active).
- Funnel-cashout expirations low ([143509449](https://app.datadoghq.com/monitors/143509449)) — High, since 2026-09-10 03:24 UTC (may be active).
- Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High, since 2026-06-03; Datadog No Data. Code bug → Jira + clear.
- Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low, since 2026-07-23; same bug.
- Activation mem-util ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks group since 2026-05-29; Datadog OK on prod. Dev-scope leak → scope out dev + clear.
- Databricks "Promotions Metrics Processor Job Failed" — High, since 2025-12-17; no live Datadog monitor. Verify job + clear.

**0 active paging issues at week-open;** 6 stale incident.io alerts carried in as of Sep 15 to clear (not re-verified) — not a clean handoff until those are cleared.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** **30 open** via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) (org-wide, as of 2026-09-22 10:04 AM PT) — 26 CRITICAL / 2 HIGH by ticket summary prefix, plus 2 security tickets with no severity prefix (CORS `WEBPLAT-1489`, In Review; IAM config review `ACC-6258`, Blocked). The 26 Criticals: `io.netty:netty-handler` (10), Next.js (3), `org.bouncycastle:bcprov-jdk18on` (2), `System.Text.Encodings.Web` (1), and 10 secrets-detection findings. 2 High: `netty-codec-http` (KMONO-59) and log-leakage SAST (SV-4848). Severity from the ticket summary prefix (Jira priority uniformly "Low"). Secrets tickets carry generic titles (no values). **org-wide** scope (no Growth-owned ticket). *Count is volatile intraday.*

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

* [ ] **Re-authenticate the incident.io connector** — needs-auth for 6 daily runs in a row (Sep 16–22); alert enrichment, the escalation / human-attention split, the incident list, on-call re-verification, and the stale-alert recheck are all degraded (Datadog-only). Top priority for the new week.
* [ ] **Escalate the first-cashout volume drop** (\~46 days below baseline) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); check the Aug 7 \~15:00 UTC cliff (deploy vs demand); open a Jira fix. Do NOT tune the monitor.
* [ ] **Investigate the funnel-cashout-expiration drop** ([143509449](https://app.datadoghq.com/monitors/143509449), fired 8× last week, Cashout-infra-owned, incidentio-low) — check the retrigger-funnel-cashout cronjob, tie to the first-cashout decline, confirm the ownership move + incidentio-low re-route were intentional, and clear/re-verify its 2 carried incident.io alerts once the connector is back.
* [ ] **Route the Activation funnel-anomaly cluster to one investigation** (registration-completion [143518919](https://app.datadoghq.com/monitors/143518919); good-to-go [143516414](https://app.datadoghq.com/monitors/143516414); funnel-promotion [136473965](https://app.datadoghq.com/monitors/136473965); OTGE anomaly [112981198](https://app.datadoghq.com/monitors/112981198)) — robust weekly anomalies echoing the funnel / first-cashout drop. Investigate, do NOT tune.
* [ ] **Confirm the **`svc-links-internal`** ownership transfer is intended** (21 prod monitors moved into `team:l2-peng-growth` on Sep 15; SLO burn-rate [181530102](https://app.datadoghq.com/monitors/181530102) fired once Sep 17). Verify Growth on-call routing / coverage and investigate the gRPC latency spike.
* [ ] **Triage the svc-referral prod Apdex breach** ([27555488](https://app.datadoghq.com/monitors/27555488)) — fired Sep 20 (\~2 min, self-recovered), routes a pager; confirm whether it paged / was acked (once incident.io is back), and watch for recurrence.
* [ ] **Tune the SQS backlog cluster** ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650), fired 70 / 34 / 20 last week): add `env:prod` + a 10–15 min sustain; verify the prod routing branch resolves.
* [ ] **Tune HPA **[135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate to critical-only); keep OOM / pod-not-ready at HIGH. Chronic (weeks\_seen 12).
* [ ] **Close out the Activation OOM routing fix** ([133647340](https://app.datadoghq.com/monitors/133647340), validated last week): optionally add `cluster_flavor:prod` so it stops entering Alert on dev; clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342).
* [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582)) and clear the 2 stale alerts once shipped; verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (\~9 months).
* [ ] Review open vulnerability tickets — 30 open (26 Critical / 2 High + 2 unlabeled), org-wide; 10 secrets-detection + 10 netty-handler + 3 Next.js + 2 bouncycastle Criticals lead.

## 📝 Manual Notes (preserved across refreshes)

*Add notes here; they survive daily refreshes.*

---

*Generated by the Growth Team Ops Review agent. Window: 2026-09-22 11:00 → 2026-09-29 11:00 America/Mexico\_City (week-to-date; live, refreshed daily until it freezes at the Sep 29 handoff). Last refreshed: 2026-09-22 10:04 AM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities). ****incident.io connector was unavailable this run (needs auth)**** — alert / incident / on-call / stale sections are Datadog-only or carried-forward and flagged inline; Datadog and Jira were healthy. Customer identifiers redacted where present (none required this run). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent.*
