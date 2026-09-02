🔄 **Live page** — refreshed daily during the on-call week (2026-09-01 → 2026-09-08). Last refreshed **2026-09-02 10:01 AM PT (America/Los_Angeles)** (\~1 day into the week). This page freezes at the Tuesday handoff (2026-09-08 11:00 America/Mexico_City); a new page opens for the next week.

🔴 **Carry-in from last week — two real, unresolved cashout-volume signals to watch.** (1) **First-cashout volume** — the Aug 7 \~15:00 UTC cliff persists (\~26 days); monitor [17131362](https://app.datadoghq.com/monitors/17131362) reads OK only because its anomaly model adapted (quiet ≠ recovered). (2) **Funnel-cashout expirations remain low** — `FunnelCashoutExpired` \~1–12/hr (overnight troughs \~1–2) vs \~20–79/hr earlier; monitor [143509449](https://app.datadoghq.com/monitors/143509449) is at the tightened `< 2` threshold and **fired again this week** (Wed \~3:03 AM PT, acked, \~31 min) — the low-expiration drop is not resolved. **Cause not determined from available signals** — investigate both via the Activation runbook / dashboard `kem-tug-987`; open a Jira fix. Also open: 4 stale incident.io orphans to clear (see Open Going Into Handoff).

# Growth Team Ops Review — Weekly Handoff

**09/02/2026 Growth Team Ops Review** · On-call week **2026-09-01 11:00 → 2026-09-08 11:00** (America/Mexico_City) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-09-02 10:01 AM PT** (week-to-date, \~1 day in; live, refreshed daily).

_This on-call week — primary: **aiden.ramgoolam**; secondary: **Edder Núñez** (shift Tue Sep 1 → Tue Sep 8; verified live via_ `schedule_show`_). Next handoff Sep 8: primary **Edder Núñez**, secondary **shashank**._

_Coverage check: could not be completed (no Slack profile-read tool available) — verify availability manually._

## SLOs / SLAs (15 minutes)

* [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
* [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
* [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — week-to-date (\~1 day in):** **7 records** (3 High, 4 Low) — 5 resolved, 2 still firing (HPA [135119948](https://app.datadoghq.com/monitors/135119948)). | **Prior full week (Aug 25 → Sep 1):** 15 records (10 High, 5 Low), all resolved. | **Trend: ↑** — 7 week-to-date vs **1** in the prior week's same first-day slice; run-rate \~49/wk vs prior 15/wk. Driven by one front-loaded Activation-pipeline burst on Wed morning PT (HPA scaling + SQS latencies), all self-resolved / acked; a burst rarely sustains, so the run-rate likely overstates. **Human-attention: 5** (all acked by aiden.ramgoolam) | **Auto-resolved: 2.** **Escalation rate (alerts → incidents): 0/7 (0%).** **Still firing: 2 active / 4 stale** (incident.io). _Datadog alert firehose this window \~88 events_ (vs 7 incident.io records — the gap is self-clearing SQS / HPA Warn cycles).

_Priority = monitor severity/routing (High/Low); Warn/Alert = the level a fire actually crossed — the two are independent. A High-priority monitor can fire only at Warn._

## Incidents (15 minutes)

### Production Incidents — Customer Impact

No production incidents this week (incident.io `incident_list` for the team = 0). Carry-overs still tracked (no live incident): the quick-reply dead-button frontend bug (INC-2824, [312932032](https://app.datadoghq.com/monitors/312932032), fix incomplete) and the Anthropic-quota fragility (INC-2795 class, [309355473](https://app.datadoghq.com/monitors/309355473), OK).

### Operational Incidents — Deploys / Data Repairs / Infra

No operational incidents this week (0 in incident.io for the team).

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

| Alert | Priority | Service | On-call | Agent Finding |
| --- | --- | --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | <custom data-type="status" data-id="id-0">High</custom> | job-user-setup-user-first-mile-calc-processor | aiden.ramgoolam | **TL;DR:** The Activation first-mile-calc processor's HPA scaled hard on Wed — utilization crossed Warn (\~81–83%) twice and Alert (91.7%) at \~10:01 AM PT; aiden acked all three, autoscaling is absorbing it, no customer impact; 2 still firing at refresh. **What happened:** Prod (`production-eks-cluster`, `cluster_flavor:prod` scope). Fired 3×: (1) 2026-09-02 04:53 UTC (\~9:53 PM PT Sep 1) Warn 82.667% (Low) — acked aiden \~04:58 UTC, resolved 05:02 UTC (\~9 min); (2) 2026-09-02 16:54 UTC (\~9:54 AM PT) Warn 80.667% (Low) — acked aiden \~16:57 UTC, still firing; (3) 2026-09-02 17:01 UTC (\~10:01 AM PT) Alert 91.667% (High) — acked aiden \~5 s later, still firing. Monitor currently reads **Alert** on Datadog. **Likely cause:** sustained autoscaling on the first-mile-calc queue processor during a morning load burst (co-timed with the SQS-latency fires below); the monitor pages High at `> 90` and Low at Warn, and autoscaling self-resolves it. Top tuning candidate (route HIGH → LOW). |
| [135119949](https://app.datadoghq.com/monitors/135119949) — Message processing duration too high (P90 > 10s) | <custom data-type="status" data-id="id-1">High</custom> | job-user-setup-user-first-mile-calc-processor | aiden.ramgoolam | **TL;DR:** SQS message-processing P90 on the same first-mile-calc processor briefly crossed 10 s at \~9:29 AM PT; aiden acked, self-resolved in \~1 min, no customer impact. **What happened:** (1) 2026-09-02 16:29 UTC (\~9:29 AM PT) `p90:trace.amazonsqs.process` > 10 s over last 10m — High page (@pagerduty-Activation-Alerts / incidentio-high), acked aiden \~11 s later, resolved 16:30 UTC (\~1 min). Query is service-scoped (no `env:` tag). **Likely cause:** the same morning Activation-queue load burst as the HPA scaling — a brief processing-latency spike that cleared as pods scaled out. First fire seen for this monitor in the tracked window; a High page for a \~1-min self-resolving blip → tuning candidate (add a sustain). |
| [143509449](https://app.datadoghq.com/monitors/143509449) — Funnel cashouts expired < 2 | <custom data-type="status" data-id="id-2">High</custom> | job-cashout-user-cashout-status-processor | aiden.ramgoolam | **TL;DR:** The funnel-cashout-expiration count dipped below the tightened `< 2` threshold at \~3:03 AM PT (overnight trough); aiden acked, cleared in \~31 min, no customer impact — but this is the same real low-expiration signal, not monitor noise. **What happened:** (1) 2026-09-02 10:03 UTC (\~3:03 AM PT) `sum(last_4h): FunnelCashoutExpired + ProcessingFunnelExpirationEvent < 2` (env:prod) — High page, acked aiden \~10:05 UTC, resolved 10:34 UTC (\~31 min). **Likely cause:** an overnight trough in funnel-cashout expirations (consistent with the \~1–2/hr overnight baseline) crossing the `< 2` bound — the sustained low-expiration drop persists. The applied 5 → 2 threshold cut the paging but did not remove the underlying drop. Route to the Activation runbook + a Jira fix (do NOT tune further); investigate the retrigger-funnel-cashout cronjob + throughput. |

### Auto-Resolved — Escalation Cancelled

* **TL;DR:** The Cashout Status processor's average SQS receive-duration crossed 140 s twice in \~16 min late morning PT ([142140455](https://app.datadoghq.com/monitors/142140455), Low); both auto-resolved with no human action in 4–5 min, no customer impact.

    **What happened:** `avg(last_5m): trace.amazonsqs.receive.duration{env:prod, service:job-cashout-user-cashout-status-processor} > 140`. (1) 2026-09-02 16:43 UTC (\~9:43 AM PT) Low — escalation cancelled (no ack), resolved 16:47 UTC (\~4 min); (2) 2026-09-02 16:59 UTC (\~9:59 AM PT) Low — escalation cancelled (no ack), resolved 17:04 UTC (\~5 min). **Likely cause:** the same late-morning Activation-queue load burst (co-timed with the HPA Alert and the msg-processing spike) — a brief receive-duration elevation on a `last_5m` average with no sustain, self-cleared. New monitor — flappy candidate (2× auto-resolved, zero ack; add a sustain / min-duration guard).



### Recurring / Flappy Alerts — Monitor Tuning Candidates

| Alert | Times Fired (this wk) | Notes |
| --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high util | 3× (2 Warn/Low + 1 Alert/High) | Chronic (ledger weeks_seen 9). Autoscaling-handled; a High/Alert page (91.7%) still required an ack for a self-resolving condition. Tuning candidate → route HIGH → LOW (keep OOM / pod-not-ready at High). |
| [142140455](https://app.datadoghq.com/monitors/142140455) — Processor avg duration > 140s | 2× (both auto-resolved, no ack) | **New** flappy candidate on `job-cashout-user-cashout-status-processor`. `last_5m` avg, no sustain → self-clears in 4–5 min. Add a sustain / min-duration guard (a page nobody acted on). |
| [135119949](https://app.datadoghq.com/monitors/135119949) — Msg processing P90 > 10s | 1× (watch) | **New** — High page for a \~1-min self-resolving blip on `job-user-setup-user-first-mile-calc-processor`. Watch for recurrence; if it repeats, add a sustain before it earns a routing change. |
| [143509449](https://app.datadoghq.com/monitors/143509449) — Funnel cashouts expired < 2 | 1× (real signal — not noise) | Not flappy: a real low-expiration drop. Already at the applied `< 2` threshold → route to a Jira code/throughput fix, do NOT tune further. |

_Config changes this window: none detected — no monitor edits observed; both prior applied changes (OOM_ `133647340` _prod-gating, funnel_ `143509449` `< 2`_) re-confirmed still live via config re-read._

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; a High/Alert page for a self-resolving condition, including outside working hours | Chronic (weeks_seen 9); fired 3× this week (2 Warn/Low + 1 Alert/High at 91.7%), all acked by aiden; monitor currently Alert | **Route HIGH → LOW / gate to critical.** before: util `> 90` Alert / \~80 Warn → `@webhook-incidentio-high`. after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | <custom data-type="status" data-id="id-3">strongly recommend</custom> |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~26 days (Aug 7 cliff); recent \~1–122/hr (troughs \~1–6) vs pre-cliff weekday \~110–198/hr; weeks_seen 5; no new fire (monitor quiet — model adapting) | **Do NOT tune → investigate.** before: monitor unchanged. after: investigate via the Activation runbook (`kem-tug-987`); rule out an Aug 7 \~15:00 UTC deploy/instrumentation change vs a demand regression; open a Jira fix. Coverage: monitor unchanged. | high | <custom data-type="status" data-id="id-4">strongly recommend</custom> |
| [143509449](https://app.datadoghq.com/monitors/143509449) — funnel-cashout expirations low | Real, sustained-low expiration drop that pages High — threshold change applied at the Aug 25 handoff | Threshold `< 5` → `< 2` (applied, re-confirmed live); fired 1× this week at `< 2` (noise held at \~1/wk, down from 10 pre-change); weeks_seen 3 | **Applied (threshold 5 → 2).** Cut paging \~90%, but the underlying drop persists (fired again this week). Still needed: investigate throughput + the retrigger-funnel-cashout cronjob; prefer a time-of-day / min-volume guard. Coverage: a real funnel-cashout outage still pages High. | high (observed diff) | <custom data-type="status" data-id="id-5">applied</custom> |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM (+ sibling [133647342](https://app.datadoghq.com/monitors/133647342) mem-util) | Activation dev-leak: a dev-eks OOM paged prod on-call High because the page handles were unconditional | Routing fixed 2026-08-28 (handles now inside the prod `is_match` block; re-confirmed live this run); weeks_seen 5; no post-fix dev-eks OOM yet to validate | **ACHIEVED — handles prod-gated.** Remaining: query still has no env scope (still enters Alert on dev, no page); optionally add `cluster_flavor:prod`; clear the stale mem-util 133647342 dev-eks orphan + scope out dev. Coverage: prod OOM still pages High. | high (observed diff + audit) | <custom data-type="status" data-id="id-6">applied</custom> |
| [137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650) — SQS backlog cluster | Flappy backlog, no env scope / no sustain (Datadog-only noise; 0 incident.io pages) | 137629294 currently in Alert (Datadog-only — its routing needs an `env` match the query doesn't set, so no page); each self-clears \~2–4 min; \~88-event firehose this window; weeks_seen 9 / 8 / 8 | **Add scope + sustain; verify routing.** before: SQS oldest-age `> 90–150 s` Alert, `last_5m`, no env scope, no sustain. after: add `env:prod` + a sustain ≥ 10–15 min; verify the prod routing branch actually resolves. Coverage: a sustained real backlog still alerts. | med | <custom data-type="status" data-id="id-7">recommend</custom> |

_Top 5 by expected impact; **full history (22 rows) →**_ [_Monitor Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577)_. New this week and added to the ledger as proposed candidates:_ `142140455` _(2× auto-resolved, no ack) and_ `135119949` _(1× High blip). Both applied changes (OOM prod-gating, funnel_ `< 2`_) re-confirmed still live._

### 🔴 Open Going Into Handoff

**Active — Datadog Alert/Warn now: 2 incident.io alerts (1 monitor).** HPA [135119948](https://app.datadoghq.com/monitors/135119948) (`job-user-setup-user-first-mile-calc-processor`, production-eks-cluster) reads **Alert**: 1 High (91.7%) + 1 Low/Warn (80.7%) firing, both acked by aiden.ramgoolam — autoscaling-handled, expected to self-resolve. _Also currently in Alert on Datadog but not paging: SQS backlog_ [_137629294_](https://app.datadoghq.com/monitors/137629294) _(first-mile-new-user-score queue) — Datadog-only, self-clearing; its routing block needs an_ `env` _match the query doesn't set, so it raises no incident.io page._

**Stale / lingering incident.io alerts (need a manual clear, not active prod work): 4** (carried in from prior weeks; all 4 are absent from the current Datadog Alert/Warn set, confirming stale):

* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High, since 2026-06-03; Datadog No Data. Code bug → Jira + clear.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low, since 2026-07-23; same bug.
* Activation mem-util ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks group since 2026-05-29; Datadog OK on prod. Dev-scope leak → scope out dev + clear.
* Databricks "Promotions Metrics Processor Job Failed" — High, since 2025-12-17; no live Datadog monitor. Verify job + clear.

**2 active prod alerts (HPA autoscaling, self-resolving) + 4 stale incident.io alert(s) to clear** — plus the carry-in cashout-volume signals above to keep watching.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** 16 open (<custom data-type="status" data-id="id-8">1 Critical</custom> / <custom data-type="status" data-id="id-9">15 High</custom>) via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) (up from 10 at the Sep 1 close; count is volatile intraday). The single Critical is SAST `EBBUD-3697` (OS-command injection, To Do). The 15 Highs: 3 SAST (`CXP-1998` file-path, In Review; `QAMRE-1920` / `QAMRE-1919` anti-forgery token, To Do) + 12 transitive SCA dependency bumps (`ddtrace`; `js-yaml` ×2; `fast-uri`; `brace-expansion`; `nanoid` ×4; `SSH.NET` ×3) across CXP / SV / QAMRE / MOBPLAT / ECD / ACC. Severity from the ticket summary prefix (Jira priority field uniformly "Low"). **org-wide** scope (no Growth-owned ticket).

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

- [ ] **Escalate the first-cashout volume drop** (\~26 days below baseline) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); check the Aug 7 \~15:00 UTC cliff (deploy vs demand); open a Jira fix. Do NOT tune the monitor.
- [ ] **Investigate the funnel-cashout-expiration drop** ([143509449](https://app.datadoghq.com/monitors/143509449)): fired again this week at the applied `< 2` threshold (Wed \~3:03 AM PT); check the retrigger-funnel-cashout cronjob + tie to the first-cashout decline; prefer a min-volume / time-of-day guard.
- [ ] **Verify the Activation OOM routing fix holds** ([133647340](https://app.datadoghq.com/monitors/133647340)): handles gated to prod (2026-08-28, re-confirmed). Confirm no dev-eks OOM pages prod this week; optionally add `cluster_flavor:prod`; clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342).
- [ ] **Tune HPA**[135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate to critical-only); keep OOM / pod-not-ready at HIGH. Fired 3× this week incl a High/Alert page (91.7%).
- [ ] **Add a sustain / min-duration guard to processor-avg-duration**[142140455](https://app.datadoghq.com/monitors/142140455) (new): fired 2× this week, both auto-resolved with no ack.
- [ ] **Watch msg-processing**[135119949](https://app.datadoghq.com/monitors/135119949) (new): High page for a \~1-min self-resolving blip; add a sustain if it recurs.
- [ ] **Add a sustain guard to the postman-internal latency pair** ([119674465](https://app.datadoghq.com/monitors/119674465) p90 / [119674469](https://app.datadoghq.com/monitors/119674469) avg): fired last week on brief `last_10m` crossings.
- [ ] **Triage the two Low cashout monitors:**[143557417](https://app.datadoghq.com/monitors/143557417) (add `env:prod` + min-hits floor); [143516414](https://app.datadoghq.com/monitors/143516414) GoodToGo (watch recurrence).
- [ ] **Ship the quick-reply routing fix** (INC-2824; [312932032](https://app.datadoghq.com/monitors/312932032)).
- [ ] **Fix the P5→High over-routing** on the cron ([313314019](https://app.datadoghq.com/monitors/313314019)) + svc-mark-tech ([301972958](https://app.datadoghq.com/monitors/301972958)); confirm Growth ownership of svc-mark-tech.
- [ ] **Verify OTGE readiness monitor routing** ([111957816](https://app.datadoghq.com/monitors/111957816)): no notification handles — add a page/Slack handle. Also investigate the OTGE grant-ratio anomaly ([111675017](https://app.datadoghq.com/monitors/111675017)).
- [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582)) and clear the 2 stale alerts once shipped.
- [ ] Tune the Activation SQS backlog cluster ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650)): add `env:prod` + a 10–15 min sustain; verify routing (137629294 currently Alert, non-paging).
- [ ] Verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (\~9 months).
- [ ] Review open vulnerability tickets — 16 open (1 Critical / 15 High), org-wide.

## 📝 Manual Notes (preserved across refreshes)

_Add notes here; they survive daily refreshes._

---

_Generated by the Growth Team Ops Review agent. Window: 2026-09-01 11:00 → 2026-09-08 11:00 America/Mexico_City (week-to-date, \~1 day in; live, refreshed daily until it freezes at the Sep 8 handoff). Last refreshed: 2026-09-02 10:01 AM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities) — all connectors healthy. Customer identifiers redacted where present (none required this run). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent._
