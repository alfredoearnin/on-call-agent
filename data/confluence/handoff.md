🔄 **Live page** — refreshed daily during the on-call week (2026-08-18 → 2026-08-25). Last refreshed **2026-08-19 8:00 AM PT (America/Los_Angeles)** (\~1.3 days / \~32 h into the week). This page freezes at the Tuesday handoff (2026-08-25); a new page opens for the next week.

🔴 **Carry-in from last week — the first-cashout volume drop is still unresolved (now \~12 days).** Re-grounded again today (Aug 1 → Aug 19, hourly): the single-hour cliff at **Aug 7 \~15:00 UTC** (\~116/hr → \~21/hr) still holds, and the last 24 h totaled \~500 first cashouts (\~21/hr) vs the pre-cliff Mon Aug 3 \~2,800/day (\~117/hr) — still **\~82% below baseline**, across weekdays and both weekends, so seasonality is out. Monitor [17131362](https://app.datadoghq.com/monitors/17131362) is quiet only because its weekly-seasonality anomaly model has adapted to the new low (quiet ≠ recovered). **Cause not determined from available signals.** → Top priority this week: investigate via the Activation runbook / dashboard `kem-tug-987`, check the Aug 7 \~15:00 UTC cliff for a deploy/instrumentation change, and open a Jira fix.

# Growth Team Ops Review — Weekly Handoff

**08/19/2026 Growth Team Ops Review** · On-call week **2026-08-18 → 2026-08-25** (Tuesday → Tuesday, America/Los_Angeles) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-08-19 8:00 AM PT** (\~1.3 days into the week).

On-call (this week, from incident.io schedules): Primary **shashank**, Secondary **Alfred** (shift Tue Aug 18 10:00 → Tue Aug 25 10:00 PT). Next primary: **Alfred** (Aug 25). Last week's primary was **Nabi**.

## SLOs / SLAs (15 minutes)

* [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
* [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
* [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — week-to-date (\~1.3 days / \~32 h in):** **3 page-worthy episodes** — OTGE containers-not-ready ([111957816](https://app.datadoghq.com/monitors/111957816), prod, \~49 min Aug 18, un-paged), an HPA sustained-utilization Warn ([135119948](https://app.datadoghq.com/monitors/135119948), prod, \~8 min Aug 19, auto-resolved), and a quick-reply routing-nowhere re-fire ([312932032](https://app.datadoghq.com/monitors/312932032), conversational-onboarding, \~15 min Aug 19, auto-resolved). incident.io recorded **2 High alert records** (both resolved); the OTGE fire raised **no** incident.io page (routing gap). | **Prior full week (Aug 11–18):** 12 episodes = 15 incident.io High records, all resolved. | **Trend: provisional** — on page-worthy episodes the run-rate is \~16/wk (3 ÷ \~1.3 days × 7) vs prior 12 → slightly ↑; on incident.io alert records it is \~11/wk (2 ÷ \~1.3 × 7) vs prior 15 → flat-to-down. Only \~1.3 days and 2–3 events in, so treat as an early small-sample projection, not a verdict. **Human-attention: 0** · **Auto-resolved: 2** (both escalations cancelled, no human ack). **Escalation rate (alerts → incidents): 0/2 (0%).** **Still firing: 0 active / 4 stale** (incident.io). Alert-event firehose: **79 events** (first-mile-calc 62, deactivated-user 10, activation 4, OTGE 2, conversational-onboarding 1).

_Priority = monitor severity (High/Low); Warn/Alert = trigger level — a High-priority monitor can fire only at Warn._

## Incidents (15 minutes)

### Production Incidents — Customer Impact

**No new production incidents this week** (incident.io `incident_list` for the team = 0; Datadog-native incident search = 0). Two items carry over for tracking: the **quick-reply dead-button** frontend bug (INC-2824, monitor [312932032](https://app.datadoghq.com/monitors/312932032)), which **re-fired again this morning (Aug 19)** — fix still incomplete — and the **Anthropic-quota fragility** (INC-2795 class, monitor [309355473](https://app.datadoghq.com/monitors/309355473)), which reads OK with no recurrence this window. Both routed to code/product fixes (see Action Items).

### Operational Incidents — Deploys / Data Repairs / Infra

No operational incidents this week (0 in incident.io for the team; 0 in Datadog-native incident search).

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

No alerts required human attention this week. Both incident.io alerts (the HPA Warn and the quick-reply re-fire) auto-resolved with their escalations **cancelled before any human ack** (`escalation_stats`: 2 pages this window, both cancelled; 0 acked).

### Auto-Resolved — Escalation Cancelled

**TL;DR:** The Activation first-mile-calc HPA monitor ([135119948](https://app.datadoghq.com/monitors/135119948), prod) briefly crossed its Warn threshold on Aug 19 00:47 UTC (Aug 18 \~5:47 PM PT); it paged incident.io + PagerDuty but self-resolved in \~8 min with no human action and no customer impact.

**What happened:** _Observed_ — \[Warn on `horizontalpodautoscaler:job-user-setup-user-first-mile-calc-processor-hpa, kube_cluster_name:production-eks-cluster`\] at **Aug 19 00:47:08 UTC** (utilization \~80%; threshold > 90 Alert / \~80 Warn), routed `@pagerduty-Activation-Alerts` + `@webhook-incidentio-high` (one High alert record), the escalation was **cancelled** (auto-resolved, no human ack), and it Recovered **00:55:08 UTC** (\~8 min). Env unambiguously **prod** (`production-eks-cluster`; query `cluster_flavor:prod`). _Likely cause_ — routine autoscaling saturation that the HPA absorbed and self-cleared in minutes; no incident. → Tuning candidate: route the sustained-utilization branch HIGH → LOW (below).

**TL;DR:** The conversational-onboarding quick-reply dead-button bug ([312932032](https://app.datadoghq.com/monitors/312932032), INC-2824) re-fired this morning — members tapping a specific chip still hit a no-op; the RUM error monitor paged incident.io and auto-resolved in \~15 min, but the underlying frontend routing bug is not fixed.

**What happened:** _Observed_ — the RUM error monitor Triggered **Aug 19 14:45:52 UTC** (`env:production`, `service:conversational-onboarding`, "Quick reply tap fell through to a no-op"), created a High incident.io alert record, the escalation was **cancelled** (auto-resolved, no human ack), and it resolved **15:02:26 UTC** (\~15 min; the monitor is `last(15m) > 0`, so it clears once the RUM error count returns to 0). This is the same defect behind INC-2824; it fired 7× last week after the Aug 10 backend revert and has now recurred Aug 19 → **fix still incomplete**. _Likely cause_ — chip routing logic in the frontend: the action is known to the client but its handler routes nowhere (per the monitor's own description). **NOT monitor noise** → route to a frontend Jira fix, do not tune. (Payload carries no customer identifiers — RUM error count only.)

**TL;DR:** The OTGE processor containers-not-ready monitor ([111957816](https://app.datadoghq.com/monitors/111957816), svc-earnings-sqs-one-time-granted-earnings, prod) fired \~49 min on Aug 18 and self-recovered — but it raised **no** incident.io page because the monitor has **no notification handles** (a routing/coverage gap, not noise).

**What happened:** _Observed_ — 111957816 Triggered **Aug 18 17:59:36 UTC** (≥ 85% of containers unavailable for 30 min — CrashloopBackoff / ErrImagePull / ImagePullBackoff) on `env:prod` and Recovered **18:48:36 UTC** (\~49 min); it is OK now. incident.io recorded **0 alerts / 0 escalations** for the fire, and the monitor definition contains no `@`-handles at all — so a real sustained prod container-readiness failure here would page nobody. _Likely cause_ — a transient deploy rollout / image-pull blip that k8s cleared (self-recovered within the hour); low actual impact this time. Env unambiguously **prod** (query scope `env:prod`). → Verify/add routing (tuning candidate below).

### Recurring / Flappy Alerts — Monitor Tuning Candidates

_Standing candidates carried from the closing week and the_ [_Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577)_; this week's counts accrue as the week progresses (\~1.3 days in)._

| Alert | Times Fired (this wk) | Notes |
| --- | --- | --- |
| [312932032](https://app.datadoghq.com/monitors/312932032) — quick-reply routing nowhere (RUM) | 1 (Aug 19; 7 last wk) | REAL frontend bug (INC-2824), NOT noise → frontend Jira fix; do not tune. Re-fired Aug 19 → fix incomplete. |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | 1 Warn (Aug 19; 2 last wk) | Infra autoscaling saturation; a High monitor firing at Warn, auto-resolved un-acked. Route HIGH → LOW. |
| [111957816](https://app.datadoghq.com/monitors/111957816) — OTGE containers not ready (NEW) | 1 (Aug 18, \~49 min, prod; un-paged) | Prod container-readiness fire with **no notification routing** → coverage gap; verify/add routing. |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real signal (monitor quiet) | Real drop, NOT monitor noise → investigate / Jira; do not tune. \~12 days, \~82% below baseline. Top carry-in. |
| [133647340](https://app.datadoghq.com/monitors/133647340) — Activation OOM | 0 so far (2 last wk) | Dev-eks OOM pages prod (handles unconditional). Gate the High page to prod (mirror 133647342). |
| [137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650) — Activation SQS backlog | 0 page-worthy so far | Chronic Datadog-only noise, 0 pages; add env:prod + sustain; verify routing. |

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~12 days (Aug 7 15:00 UTC cliff → Aug 19); \~82% below baseline; weeks_seen 3; monitor quiet (model adapting) | **Do NOT tune → investigate.** before: monitor unchanged. after: investigate via Activation runbook (`kem-tug-987`); rule out an instrumentation/deploy change at the Aug 7 \~15:00 UTC cliff vs a demand regression; open a Jira fix. Coverage: monitor unchanged — keeps catching real drops. | high | <custom data-type="status" data-id="id-0">strongly recommend</custom> |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM + [133647342](https://app.datadoghq.com/monitors/133647342) mem-util | Activation dev-leak: dev OOM pages prod + stale dev-eks orphan | OOM handles still unconditional (dev-eks pages prod), 3 wks running; 0 fires this wk; mem-util stale \~12 wks; weeks_seen 3; configs unchanged | **Gate to prod / clear orphan.** 133647340 — move High handles inside the prod `is_match` block (mirror 133647342); route dev to a dev Slack. 133647342 — scope out dev + clear the orphan. Coverage: prod OOM / memory still page High. | high | <custom data-type="status" data-id="id-1">strongly recommend</custom> |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; a Warn pages like a critical page | 1 self-resolving Warn this wk (\~8 min Aug 19, auto-resolved un-acked) + 2 last wk + 5 prior; weeks_seen 7; 0 incidents; config unchanged | **Route HIGH → LOW / gate to critical.** before: util > 90 Alert / \~80 Warn → `@webhook-incidentio-high` + `@pagerduty-Activation-Alerts`. after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | <custom data-type="status" data-id="id-2">strongly recommend</custom> |
| [143507582](https://app.datadoghq.com/monitors/143507582) — duplicate funnel cashout | Recurring REAL failure (code bug), NOT noise + 2 stale alerts | 0 new fires; 2 alerts firing since Jun 3 / Jul 23 (verified still-firing); Datadog No Data; weeks_seen 3+ | **Do NOT tune → Jira code fix.** after: open/track a Jira fix (runbook SRE/3082453072); resolve the 2 stale alerts once shipped. Coverage: monitor unchanged. (SQL uses a `userid` placeholder — no customer value.) | high | <custom data-type="status" data-id="id-3">strongly recommend</custom> |
| [111957816](https://app.datadoghq.com/monitors/111957816) — OTGE containers not ready (NEW) | Coverage gap: prod readiness monitor with no notification routing | Fired \~49 min (Aug 18, prod) but 0 incident.io pages; monitor message has no `@`-handles; weeks_seen 1 | **Add routing (verify first).** before: `min(last_30m):(waiting/running)*100 ≥ 85`, `env:prod`, **no notification handles**. after: add an appropriate page/Slack handle (e.g. `@webhook-incidentio-high` for prod, or Slack for a soft signal) so a sustained prod readiness failure notifies on-call; confirm whether the OTGE processor should page. Coverage: today it silently self-recovers — a real sustained outage would go unnoticed. | med | <custom data-type="status" data-id="id-4">proposed</custom> |

_Full 19-row history →_ [_Monitor Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577)_. Feedback loop: as of this refresh all diffable monitor configs remain unchanged vs their recorded before-state (no recommendation applied, \~25 runs); the top infra candidates (HPA 135119948, OOM 133647340, mem-util 133647342, OTGE 111957816) plus the app monitors (17131362, 309355473, 312932032) were re-verified this run and are unchanged — no validation win, no regression. The Tuning Ledger was rolled at the Aug 18 handoff (weeks_seen incremented) and is held at that version today (a normal mid-week daily run with no new tuning candidate, applied change, or streak change); the next roll is the Aug 25 handoff._

### 🔴 Open Going Into Handoff

**Active prod Alert/Warn now:** none (0). Datadog `status:(alert OR warn)` for the team returned no data; the HPA Warn and the quick-reply re-fire both already recovered.

**Stale / lingering incident.io alerts (need a manual clear, not active prod work): 4** (verified still-firing):

* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High, since 2026-06-03; Datadog No Data. Code bug → Jira + clear.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low, since 2026-07-23; same bug.
* Activation mem-util ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks group since 2026-05-29; Datadog OK on prod. Dev-scope leak → scope out dev + clear.
* Databricks "Promotions Metrics Processor Job Failed" — High, since 2025-12-17; no live Datadog monitor. Verify job + clear.

**No active prod issues**, but this is not a fully clean start: the first-cashout drop carries in (top priority) and **4 stale incident.io alerts** need a manual clear.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** 14 open (<custom data-type="status" data-id="id-5">3 Critical</custom> / <custom data-type="status" data-id="id-6">11 High</custom>) via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) — **org-wide** scope (no Growth-owned ticket; closest is `ACT-2563`, a Datadog.Trace bump). The 3 Criticals are SAST OS-command-injection findings in activehours/pr-explorer (`ECD-11625` / `ECD-11626` / `ECD-11627`, In Review). The 11 High are 10 transitive SCA dependency bumps (`brace-expansion` ×3, `google.golang.org/grpc` ×4, `js-yaml`, `ws`, `Datadog.Trace`) plus a new SAST anti-forgery/CSRF finding (`QAMRE-1842`, DataLoaderController.cs, In Progress) — up 1 from 13 yesterday. Count is volatile intraday.

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

- [ ] **Escalate the first-cashout volume drop** (real, \~82% below baseline, \~12 days) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); check the Aug 7 \~15:00 UTC cliff for a deploy/instrumentation change; open a Jira code/product fix. Do NOT tune the monitor.
- [ ] **Ship the quick-reply routing fix** (INC-2824; monitor [312932032](https://app.datadoghq.com/monitors/312932032) re-fired again Aug 19 after last week's 7 fires — fix incomplete).
- [ ] **Add durable Anthropic-quota protection** for svc-conversational-onboarding (INC-2795 class; monitor [309355473](https://app.datadoghq.com/monitors/309355473)).
- [ ] **Verify OTGE monitor routing** ([111957816](https://app.datadoghq.com/monitors/111957816)): it fired \~49 min in prod with no notification handles — add a page/Slack handle so sustained readiness failures notify on-call.
- [ ] Fix Activation OOM routing [133647340](https://app.datadoghq.com/monitors/133647340): move the High handles inside the prod is_match block (mirror 133647342).
- [ ] Tune HPA [135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate to critical-only); keep OOM / pod-not-ready at HIGH.
- [ ] Clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342) + scope out dev.
- [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582)) and clear the 2 stale alerts once shipped.
- [ ] Tune the Activation SQS backlog cluster ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650)): add env:prod + a 10–15 min sustain; verify routing.
- [ ] Verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (\~8 months).
- [ ] Review open vulnerability tickets — 14 open (3 Critical / 11 High), org-wide; keep the 3 SAST Criticals (ECD-11625 / 11626 / 11627, In Review) moving, and triage the new anti-forgery finding (QAMRE-1842).

## 📝 Manual Notes (preserved across refreshes)

_Add notes here; they survive daily refreshes._

---

_Generated by the Growth Team Ops Review agent. Window: 2026-08-18 00:00 → 2026-08-25 00:00 America/Los_Angeles (week-to-date, \~1.3 days in; live, refreshed daily until it freezes at the Aug 25 handoff). Last refreshed: 2026-08-19 8:00 AM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities) — all connectors healthy. Customer identifiers redacted where present (none required this run). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent._
