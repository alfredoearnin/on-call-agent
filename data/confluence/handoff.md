🔄 **Live page** — refreshed daily during the on-call week (2026-09-22 → 2026-09-29). Last refreshed **2026-09-23 10:05 AM PT (America/Los\_Angeles)** (day 2, \~1 day into the week). This page freezes at the Tuesday handoff (2026-09-29 11:00 America/Mexico\_City); a new page opens for the next week.

🌟 **On-call week, day 2 (\~1 day in).** **0 incident.io Growth alert records** and **0 incidents** since the Sep 22 handoff. Datadog logged **21 monitor transitions**, all from the standing flapper cluster (first-mile / deactivate-user / user-activation SQS backlog + one OTGE CPU-throttle), each self-recovered in minutes with **0 incident.io pages**; **0 monitors read Alert/Warn now**. Stale incident.io alerts are **down 6 → 5**: the Sep-14 funnel-cashout orphan ([143509449](https://app.datadoghq.com/monitors/143509449)) resolved Sep 22 19:43 UTC; 5 remain to clear. incident.io is authenticated and healthy this run (it was down Sep 16–22, recovered Sep 22); Datadog + Jira healthy.

# Growth Team Ops Review — Weekly Handoff

**09/23/2026 Growth Team Ops Review** · On-call week **2026-09-22 11:00 → 2026-09-29 11:00** (America/Mexico\_City) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-09-23 10:05 AM PT** (week-to-date, day 2; live, refreshed daily).

*This on-call week — primary: ****Ankur Shivani****; secondary: ****Alfred**** (shift Tue 2026-09-22 → Tue 2026-09-29; verified live via *`schedule_show`*). Next handoff 2026-09-29: primary ****Alfred****, secondary ****aiden.ramgoolam****.*

*Verified live via *`schedule_show`* this run (incident.io connector healthy) — rotation confirmed for both the current week and the Sep 29 handoff.*

*Coverage check (Slack out-of-office, as of 2026-09-23 10:05 AM PT): could not be completed (no Slack profile-read tool available under either name) — verify availability manually. incident.io *`schedule_show`* shows no PTO booked for the rotation members (Ankur Shivani, Alfred, aiden.ramgoolam) this window.*

## SLOs / SLAs (15 minutes)

- [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
- [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
- [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — week-to-date (day 2, \~1 day in):** **0 incident.io Growth alert records** (nothing has paged). Datadog: **21 monitor transitions** across 4 standing flappers — first-mile SQS [137629294](https://app.datadoghq.com/monitors/137629294) ×10, deactivate-user SQS [137629364](https://app.datadoghq.com/monitors/137629364) ×7, user-activation SQS [137629650](https://app.datadoghq.com/monitors/137629650) ×3, OTGE CPU-throttle [111957818](https://app.datadoghq.com/monitors/111957818) ×1 — all self-recovered in minutes, 0 pages. | **Prior full week (Sep 15 → Sep 22, closed):** 2 incident.io records (1 High + 1 Low), both auto-resolved, 0 incidents; \~130 Datadog transitions (\~95% SQS flapper). | **Trend:** incident.io run-rate \~0/wk vs prior 2 → ↓ (nothing paging); Datadog-noise run-rate \~150/wk vs \~130 → roughly flat (standing flapper). **Human-attention: 0 · Auto-resolved: 0 · Escalation rate (alerts → incidents): 0/0. Still firing: 0 active / 5 stale** (incident.io, re-verified this run — down from 6; the Sep-14 funnel-cashout orphan resolved Sep 22 19:43 UTC).

*Priority = monitor severity/routing (High/Low); Warn/Alert = the level a fire crossed — independent. A High-priority monitor can fire only at Warn.*

## Incidents (15 minutes)

### Production Incidents — Customer Impact

**No production incidents opened this week** (incident.io `incident_list`, team L2-PENG-Growth → 0 in-window). One older Growth incident remains in post-incident documentation only: **INC-2632** (Sev3, cashout-eligibility controls; reported 2026-05-26) — **resolved 2026-06-09**, now in the Sev3 optional analysis write-up; no active response.

### Operational Incidents — Deploys / Data Repairs / Infra

**No operational incidents this week** (incident.io → 0). **No monitor config changes** since the Sep 22 handoff (Datadog `monitor_audit_event` → 0; the funnel monitor [143509449](https://app.datadoghq.com/monitors/143509449) was deleted Sep 22 15:43 UTC, in the prior week).

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

No alerts required human attention this week — 0 incident.io Growth records since the Sep 22 handoff, 0 acked.

### Auto-Resolved — Escalation Cancelled

No alerts auto-resolved this week (0 incident.io records so far). The 21 Datadog transitions this week are monitor-only flapping — none created an incident.io alert or page.

### Recurring / Flappy Alerts — Monitor Tuning Candidates

| Alert | Times Fired (this week) | Notes |
| --- | --- | --- |
| First Mile Calc SQS backlog — [137629294](https://app.datadoghq.com/monitors/137629294) | 10 (Warn) | Standing `last_5m` oldest-age flapper (SQS `first-mile-new-user-score`); each self-cleared \~1–3 min; 0 incident.io pages. Tuning: add `env:prod` + a 10–15 min sustain. |
| Deactivated-User SQS backlog — [137629364](https://app.datadoghq.com/monitors/137629364) | 7 (4 Warn + 3 Alert \> 90 s) | Same SQS cluster (`deactivate-user`); crossed the Alert threshold 3× overnight but self-cleared in minutes; 0 pages. |
| User-Activation SQS backlog — [137629650](https://app.datadoghq.com/monitors/137629650) | 3 (2 Warn + 1 Alert \> 150 s) | Same SQS cluster (`prod_statusactivationattempt`); self-cleared \~1 min; 0 pages. |
| OTGE CPU throttling — [111957818](https://app.datadoghq.com/monitors/111957818) | 1 (Alert) | svc-earnings OTGE processor, `env:prod`, CPU CFS throttled \> 1 (last\_10m); self-recovered \~1 min; Service-Advisor monitor with no notification handles → 0 page. Infra saturation autoscaling/limits handles. |

*Every Datadog fire this week is the standing SQS-backlog + OTGE flapper cluster (0 incident.io pages). Full standing-candidate history → the *[Monitor Tuning Ledger](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577/Growth+Team+Ops+Review+Monitor+Tuning+Ledger)*.*

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; pages for a self-resolving condition, incl. off-hours | Chronic (weeks\_seen 12); 0 fires so far this week; monitor OK | **Route HIGH → LOW / gate to critical.** before: util `> 90` Alert → `@webhook-incidentio-high`. after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | STRONGLY RECOMMEND |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~47 days (Aug 7 cliff); weeks\_seen 5; monitor quiet | **Do NOT tune → investigate.** after: investigate via the Activation runbook (`kem-tug-987`); rule out an Aug 7 \~15:00 UTC deploy / instrumentation change vs a demand regression; open a Jira fix. | high | STRONGLY RECOMMEND |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM (+ sibling [133647342](https://app.datadoghq.com/monitors/133647342) mem-util) | Activation dev-leak: a dev-eks OOM used to page prod on-call High | **Validated last week:** a dev-eks OOM fired Sep 22 and did NOT page prod (handles prod-gated). weeks\_seen 6 | **ACHIEVED / validated.** Minor remaining: add `cluster_flavor:prod` so it stops entering Alert on dev; clear the stale mem-util 133647342 dev-eks orphan (query is env:prod-scoped, reads OK). Coverage: prod OOM still pages High. | high (observed diff + fire) | VALIDATED ✓ |
| [137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650) — SQS backlog cluster | Flappy backlog, no env scope / no sustain (Datadog noise; 0 incident.io pages) | Fired 10 / 7 / 3 in day 1 this week (already \~20; run-rate well above last week's 70 / 34 / 20); weeks\_seen 10 / 9 / 9; 0 pages | **Add scope + sustain; verify routing.** before: SQS oldest-age Alert on `last_5m`, no env scope, no sustain. after: add `env:prod` + a sustain ≥ 10–15 min; verify the prod routing branch resolves. Coverage: a sustained real backlog still alerts. | med | RECOMMEND |
| [143509449](https://app.datadoghq.com/monitors/143509449) — funnel-cashout expirations low | Real sustained-low drop; monitor **DELETED by Cashout-infra Sep 22** — removing alerting on a real drop (coverage loss, not a noise fix) | Fired 8× last week then deleted Sep 22 15:43 UTC; weeks\_seen 6; of its 2 orphaned incident.io alerts, the Sep-14 one resolved Sep 22 19:43 UTC, the Sep-10 one still firing | **Superseded by deletion — no monitor tuning to apply.** Clear the 1 remaining orphaned incident.io alert (Sep-10); confirm the deletion was intentional; the underlying funnel-cashout-expiration drop (tied to first-cashout) still needs an Activation investigation now its monitor is gone. | high (observed delete) | RESOLVED (DELETED) |

*Top 5 by expected impact; ****full history (30 rows) →*** [Monitor Tuning Ledger](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577/Growth+Team+Ops+Review+Monitor+Tuning+Ledger)*. Carried into the new week; weeks\_seen holds until the next Tue handoff (2026-09-29).*

### 🔴 Open Going Into the Week

**Active — Datadog Alert/Warn now: 0.** No Growth monitor reads Alert/Warn (`search_datadog_monitors team:l2-peng-growth status:(alert OR warn)` → none). The SQS/OTGE flapper crossings above all self-recovered.

**Stale / lingering incident.io alerts: 5** (re-verified this run via `alert_list` — the complete firing set; down from 6). None is an active prod problem; each needs a manual clear:

- Funnel-cashout expirations low ([143509449](https://app.datadoghq.com/monitors/143509449)) — High, firing since 2026-09-10 03:24 UTC. **Orphaned — the monitor was deleted Sep 22 15:43 UTC**, so it can no longer auto-resolve; clear manually. (Its Sep-14 sibling resolved Sep 22 19:43 UTC.)
- Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High \[P2\], since 2026-06-03; Datadog No Data. Real code bug → Jira + clear.
- Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low \[P4\], since 2026-07-23; same bug.
- Activation mem-util ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks group since 2026-05-29; Datadog monitor now `env:prod`-scoped and reads OK — the dev-eks alert is a lingering orphan; clear it.
- Databricks "Promotions Metrics Processor Job Failed" — High, since 2025-12-17; no live Datadog monitor. Verify the job + clear.

**0 active paging issues; 5 stale incident.io alerts to clear** (re-verified) — not a clean handoff until those are cleared. The 143509449 alert is orphaned by the monitor deletion and can only be cleared manually.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** **36 open** via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) (org-wide, as of 2026-09-23 10:05 AM PT) — 33 CRITICAL / 2 HIGH by ticket summary prefix, plus 1 security ticket with no severity prefix (CORS misconfig `WEBPLAT-1489`, In Review). The 33 Criticals: 18 secrets-detection findings, `io.netty:netty-handler` (9), Next.js (3), `org.bouncycastle:bcprov-jdk18on` (2), `System.Text.Encodings.Web` (1). 2 High: `org.springframework:spring-core` (KMONO-62) and log-leakage SAST (SV-4848). Severity from the ticket summary prefix (Jira priority field uniformly "Low"). Secrets tickets carry generic titles (no values). **org-wide** scope (no Growth-owned ticket). **Up +6 vs Sep 22 (30)** — driven by +8 new secrets-detection Criticals; the netty-codec-http High (KMONO-59) and the IAM-review ticket (ACC-6258) dropped off. *Count is volatile intraday.*

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

* [ ] **Clear the remaining orphaned funnel-cashout incident.io alert** ([143509449](https://app.datadoghq.com/monitors/143509449), firing since Sep 10) — the Datadog monitor was deleted Sep 22 15:43 UTC so it can no longer auto-resolve (its Sep-14 sibling already resolved Sep 22 19:43 UTC). Confirm the deletion was intentional; the real funnel-cashout-expiration drop now has no monitor — re-cover or fold into the Activation investigation.
* [ ] **Keep the incident.io connector authenticated** — it recovered Sep 22 after 6 down runs (Sep 16–22); the whole prior on-call week ran without alert enrichment. Watch for another needs-auth lapse.
* [ ] **Triage the svc-referral prod Apdex breach** from last week ([27555488](https://app.datadoghq.com/monitors/27555488)) — fired Sun Sep 20 10:44 UTC (\~3:44 AM PT), paged primary Nabi, escalation cancelled on a \~2-min self-resolve. Check APM traces/logs and any Sep 20 deploy; if it recurs, require ≥ 2 consecutive windows before paging.
* [ ] **Escalate the first-cashout volume drop** (\~47 days below baseline) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); check the Aug 7 \~15:00 UTC cliff (deploy vs demand); open a Jira fix. Do NOT tune the monitor.
* [ ] **Route the Activation funnel-anomaly cluster to one investigation** (registration-completion [143518919](https://app.datadoghq.com/monitors/143518919); good-to-go [143516414](https://app.datadoghq.com/monitors/143516414); funnel-promotion [136473965](https://app.datadoghq.com/monitors/136473965); OTGE anomaly [112981198](https://app.datadoghq.com/monitors/112981198)) — anomalies echoing the funnel-cashout / first-cashout drop. Investigate, do NOT tune.
* [ ] **Confirm the **`svc-links-internal`** ownership transfer is intended** (21 prod monitors moved into `team:l2-peng-growth` on Sep 15; SLO burn-rate [181530102](https://app.datadoghq.com/monitors/181530102) fired once Sep 17). Verify Growth on-call routing / coverage.
* [ ] **Tune the SQS backlog cluster** ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650), \~20 fires in day 1 this week): add `env:prod` + a 10–15 min sustain; verify the prod routing branch resolves.
* [ ] **Tune HPA **[135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate to critical-only); keep OOM / pod-not-ready at HIGH. Chronic (weeks\_seen 12).
* [ ] **Close out the Activation OOM routing fix** ([133647340](https://app.datadoghq.com/monitors/133647340), validated last week): optionally add `cluster_flavor:prod`; clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342).
* [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582)) and clear its 2 stale alerts (High + Low) once shipped; verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (\~9 months).
* [ ] Review open vulnerability tickets — 36 open (33 Critical / 2 High + 1 unlabeled), org-wide; 18 secrets-detection + 9 netty-handler + 3 Next.js + 2 bouncycastle Criticals lead (+6 vs Sep 22).

## 📝 Manual Notes (preserved across refreshes)

*Add notes here; they survive daily refreshes.*

---

*Generated by the Growth Team Ops Review agent. Window: 2026-09-22 11:00 → 2026-09-29 11:00 America/Mexico\_City (week-to-date; live, refreshed daily until it freezes at the Sep 29 handoff). Last refreshed: 2026-09-23 10:05 AM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities). Customer identifiers redacted where present (none required this run). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent.*
