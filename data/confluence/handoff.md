🔄 **Live page** — refreshed daily during the on-call week (2026-08-18 → 2026-08-25). Last refreshed **2026-08-20 7:35 PM PT (America/Los_Angeles)** (\~2.8 days / \~68 h into the week). This page freezes at the Tuesday handoff (2026-08-25); a new page opens for the next week.

🔴 **Carry-in from last week — the first-cashout volume drop is still unresolved (now \~13 days).** Re-grounded earlier today (Aug 1 → Aug 20, hourly): the single-hour cliff at **Aug 7 \~15:00 UTC** (\~116/hr → \~21/hr) still holds, and the last 24 h totaled \~557 first cashouts (\~23/hr) vs the pre-cliff Mon Aug 3 \~2,800/day (\~117/hr) — still **\~80% below baseline**, across weekdays and both weekends, so seasonality is out. Monitor [17131362](https://app.datadoghq.com/monitors/17131362) is quiet only because its weekly-seasonality anomaly model has adapted to the new low (quiet ≠ recovered). **Cause not determined from available signals.** → Top priority this week: investigate via the Activation runbook / dashboard `kem-tug-987`, check the Aug 7 \~15:00 UTC cliff for a deploy/instrumentation change, and open a Jira fix.

# Growth Team Ops Review — Weekly Handoff

**08/20/2026 Growth Team Ops Review** · On-call week **2026-08-18 → 2026-08-25** (Tuesday → Tuesday, America/Los_Angeles) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-08-20 7:35 PM PT** (\~2.8 days into the week).

_This on-call week — primary: **shashank**; secondary: **Alfred** (shift Tue Aug 18 → Tue Aug 25; verified live via_ `schedule_show`_). Next handoff Aug 25: primary **Alfred**, secondary **aiden.ramgoolam**._

_Coverage check: could not be completed (this automation's Slack integration does not expose member out-of-office status) — verify availability manually._

## SLOs / SLAs (15 minutes)

* [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
* [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
* [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — week-to-date (\~2.8 days / \~68 h in):** **6 incident.io High alert records** (all resolved), 0 Low, across **7 page-worthy episodes** — 2× HPA sustained-utilization Warn ([135119948](https://app.datadoghq.com/monitors/135119948), prod), 1× quick-reply routing-nowhere ([312932032](https://app.datadoghq.com/monitors/312932032)), 1× OTGE containers-not-ready ([111957816](https://app.datadoghq.com/monitors/111957816), prod, un-paged), and **3× a NEW cron-failure monitor** ([313314019](https://app.datadoghq.com/monitors/313314019), cronjob-mark-tech-crons, prod). | **Prior full week (Aug 11–18):** 15 incident.io High records / 12 episodes, all resolved. | **Trend:** run-rate **\~15/wk** (incident.io records: 6 ÷ \~2.8 days × 7) vs prior 15 → ≈ flat; **\~17/wk** (page-worthy episodes: 7) vs prior 12 → ↑ — the episode rise is driven by the new P5 cron-fail monitor over-routed to High (3 fires) plus a 2nd HPA flap; \~2.8 days in, treat as an early projection. **Human-attention: 2** (both cron-fail, acked by shashank \~2:18 & \~3:08 AM PT) · **Auto-resolved: 4** (escalations cancelled, no ack). **Escalation rate (alerts → incidents): 0/6 (0%).** **Still firing: 0 active / 4 stale** — no Growth monitor is in Datadog Alert/Warn at the 7:35 PM PT snapshot (the Activation SQS-backlog flappers that spiked midday have self-recovered and remain OK); the 4 stale are lingering incident.io alerts (see Open Going Into Handoff). Alert-event firehose: **224 events** (first-mile-calc 180, deactivated-user 24, cronjob-mark-tech-crons 8, user-activation 8, conversational-onboarding 2, OTGE 2).

_Priority = monitor severity (High/Low); Warn/Alert = trigger level — a High-priority monitor can fire only at Warn. Note this week: monitor 313314019 is Datadog priority P5 but its prod branch routes to incident.io High, so a low-severity cron alert paged the on-call at High._

## Incidents (15 minutes)

### Production Incidents — Customer Impact

**No new production incidents this week** (incident.io `incident_list` for the team = 0; Datadog-native incident search = 0). Two items carry over for tracking: the **quick-reply dead-button** frontend bug (INC-2824, monitor [312932032](https://app.datadoghq.com/monitors/312932032)), which fired once this week (Aug 19, auto-resolved) — fix still incomplete — and the **Anthropic-quota fragility** (INC-2795 class, monitor [309355473](https://app.datadoghq.com/monitors/309355473)), which reads OK with no recurrence this window. Both routed to code/product fixes (see Action Items).

### Operational Incidents — Deploys / Data Repairs / Infra

No operational incidents this week (0 in incident.io for the team; 0 in Datadog-native incident search).

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

| Alert | Priority | Service | On-call | Agent Finding |
| --- | --- | --- | --- | --- |
| [313314019](https://app.datadoghq.com/monitors/313314019) — cronjob-mark-tech-crons "Last cron run unsuccessful" | <custom data-type="status" data-id="id-0">High</custom> _(Datadog P5)_ | cronjob-mark-tech-crons (prod) | shashank | **TL;DR:** A brand-new P5 mark-tech cron-failure monitor — mis-routed to incident.io High — paged primary on-call shashank twice overnight (\~2:18 & \~3:08 AM PT Thu Aug 20); he acked both (\~13 s and \~1m46s) and each self-resolved in minutes. Single failed cron runs, no customer impact. **What happened:** _Observed_ — monitor 313314019 (`sum(last_5m):sum:kubernetes_state.job.failed{kube_app_name:cronjob-mark-tech-crons} by {kube_cluster_name,env} ≥ 1`) fired at **Aug 20 09:17 UTC (02:17 AM PT)** and **10:07 UTC (03:07 AM PT)** on `env:prod` / `production-eks-cluster`; each created a High incident.io alert and paged the Growth escalation path. shashank acked the first at 09:18:34 UTC (\~13 s latency; resolved \~4 min) and the second at 10:10:08 UTC (\~1m46s; resolved \~11 min). The monitor is **Datadog priority P5** but its prod branch routes `@webhook-incidentio-high`, so a low-severity single-run cron failure pages on-call at High — overnight in PT. (A 3rd fire at 00:47 AM PT auto-cancelled before ack — see Auto-Resolved.) _Likely cause_ — transient single cron-run failures cleared by the next scheduled run (the query trips on any one failed run in 5 min); no incident, no customer impact. → Tuning candidate below (fix the P5→High routing / add a consecutive-failure guard); separately verify whether the cron is genuinely failing. |

### Auto-Resolved — Escalation Cancelled

**TL;DR:** The Activation first-mile-calc HPA monitor ([135119948](https://app.datadoghq.com/monitors/135119948), prod) briefly crossed its Warn threshold twice (Aug 19 00:47 UTC and Aug 20 02:13 UTC); each paged incident.io + PagerDuty but self-resolved in \~6–8 min with no human action and no customer impact.

**What happened:** _Observed_ — \[Warn on `horizontalpodautoscaler:job-user-setup-user-first-mile-calc-processor-hpa, kube_cluster_name:production-eks-cluster`\] at **Aug 19 00:47:08 UTC** (\~80.3%) → Recovered 00:55:08 (\~8 min), and again **Aug 20 02:13:08 UTC** (\~80.9%) → Recovered 02:19:08 (\~6 min); threshold > 90 Alert / \~80 Warn, routed `@pagerduty-Activation-Alerts` + `@webhook-incidentio-high` (two High alert records), both escalations **cancelled** (auto-resolved, no human ack). Env unambiguously **prod** (`production-eks-cluster`; query `cluster_flavor:prod`). _Likely cause_ — routine autoscaling saturation the HPA absorbed and self-cleared in minutes; no incident. → Tuning candidate: route the sustained-utilization branch HIGH → LOW (below).

**TL;DR:** The conversational-onboarding quick-reply dead-button bug ([312932032](https://app.datadoghq.com/monitors/312932032), INC-2824) fired once this week — members tapping a specific chip still hit a no-op; the RUM error monitor paged incident.io and auto-resolved in \~15 min, but the underlying frontend routing bug is not fixed.

**What happened:** _Observed_ — the RUM error monitor Triggered **Aug 19 14:45:52 UTC** (`env:production`, `service:conversational-onboarding`, "Quick reply tap fell through to a no-op"), created a High incident.io alert, the escalation was **cancelled** (auto-resolved, no human ack), and it resolved **15:00:52 UTC** (\~15 min; the monitor fires when ≥ 5 such RUM errors occur in an hour). Same defect as INC-2824; it fired 7× last week and recurred Aug 19 → **fix still incomplete**. _Likely cause_ — chip routing logic in the frontend: the action is known to the client but its handler routes nowhere (per the monitor's own description). **NOT monitor noise** → route to a frontend Jira fix, do not tune. (Payload carries no customer identifiers — RUM error count only.)

**TL;DR:** The 3rd fire of the new cron-failure monitor ([313314019](https://app.datadoghq.com/monitors/313314019)) at \~00:47 AM PT auto-cancelled before anyone acked — same P5→High routing issue as the two acked fires above.

**What happened:** _Observed_ — 313314019 Triggered **Aug 20 07:47 UTC (00:47 AM PT)** on `env:prod`, created a High incident.io alert, the escalation was **cancelled** (auto-resolved, no human ack), and it resolved **08:06 UTC** (\~18 min). Together with the two acked fires this is 3 fires in \~2.5 h overnight PT from one brand-new monitor. _Likely cause_ — a transient cron-run failure the next run cleared. → Same tuning candidate below.

**TL;DR:** The OTGE processor containers-not-ready monitor ([111957816](https://app.datadoghq.com/monitors/111957816), svc-earnings-sqs-one-time-granted-earnings, prod) fired \~49 min on Aug 18 and self-recovered — but it raised **no** incident.io page because the monitor has **no notification handles** (a routing/coverage gap, not noise).

**What happened:** _Observed_ — 111957816 Triggered **Aug 18 17:59:36 UTC** (≥ 85% of containers unavailable for 30 min — CrashloopBackoff / ErrImagePull / ImagePullBackoff) on `env:prod` and Recovered **18:48:36 UTC** (\~49 min); it is OK now. incident.io recorded **0 alerts / 0 escalations** for the fire, and the monitor definition contains no `@`-handles at all — so a real sustained prod container-readiness failure here would page nobody. _Likely cause_ — a transient deploy rollout / image-pull blip that k8s cleared (self-recovered within the hour); low actual impact this time. Env unambiguously **prod** (query scope `env:prod`). → Verify/add routing (tuning candidate below).

### Recurring / Flappy Alerts — Monitor Tuning Candidates

_This week's fires plus standing candidates carried from the_ [_Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577) _(\~2.8 days into the week)._

| Alert | Times Fired (this wk) | Notes |
| --- | --- | --- |
| [313314019](https://app.datadoghq.com/monitors/313314019) — cronjob-mark-tech-crons cron-run failure (NEW) | 3 (all Thu Aug 20, \~00:47 / 02:17 / 03:07 AM PT) | Datadog P5 but prod branch routes `@webhook-incidentio-high` → paged on-call High 3× overnight PT (2 acked by shashank, 1 auto-cancelled); each self-resolved in minutes. Fix P5→High routing / add a consecutive-failure guard; separately check if the cron is really failing. |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | 2 Warn (Aug 19 + Aug 20; 2 last wk) | Infra autoscaling saturation; a High monitor firing at Warn, auto-resolved un-acked. Route HIGH → LOW. |
| [312932032](https://app.datadoghq.com/monitors/312932032) — quick-reply routing nowhere (RUM) | 1 (Aug 19; 7 last wk) | REAL frontend bug (INC-2824), NOT noise → frontend Jira fix; do not tune. Fix still incomplete. |
| [111957816](https://app.datadoghq.com/monitors/111957816) — OTGE containers not ready | 1 (Aug 18, \~49 min, prod; un-paged) | Prod container-readiness fire with **no notification routing** → coverage gap; verify/add routing. |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real signal (monitor quiet) | Real drop, NOT monitor noise → investigate / Jira; do not tune. \~13 days, \~80% below baseline. Top carry-in. |
| [133647340](https://app.datadoghq.com/monitors/133647340) — Activation OOM | 0 this wk (2 last wk) | Dev-eks OOM pages prod (handles unconditional). Gate the High page to prod (mirror 133647342). |
| [137629294](https://app.datadoghq.com/monitors/137629294) (first-mile-calc) / [137629364](https://app.datadoghq.com/monitors/137629364) (deactivate-user) / [137629650](https://app.datadoghq.com/monitors/137629650) — Activation SQS backlog | Datadog-only flapping — all OK at the 7:35 PM PT snapshot (self-recovered midday); chronic all-day flap (137629294 first-mile-calc oldest-msg-age oscillating around the 60 s Warn / 90 s Alert thresholds; 137629364 also flapped earlier, one episode reaching Alert); 0 incident.io pages | Chronic Datadog-only noise, 0 incident.io pages (no `env:` scope in query; prod handles behind `{{#is_match env.name prod}}` which isn't a query group). Add `env:prod` + a 10–15 min sustain; verify routing. |

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~13 days (Aug 7 15:00 UTC cliff → Aug 20); \~80% below baseline; weeks_seen 3; monitor quiet (model adapting) | **Do NOT tune → investigate.** before: monitor unchanged. after: investigate via Activation runbook (`kem-tug-987`); rule out an instrumentation/deploy change at the Aug 7 \~15:00 UTC cliff vs a demand regression; open a Jira fix. Coverage: monitor unchanged — keeps catching real drops. | high | <custom data-type="status" data-id="id-1">strongly recommend</custom> |
| [313314019](https://app.datadoghq.com/monitors/313314019) — cronjob-mark-tech-crons cron-run failure (NEW) | P5 auto-baseline cron monitor over-routed to incident.io High → pages on-call overnight on single self-healing failures | 3 fires Thu Aug 20 (\~00:47 / 02:17 / 03:07 AM PT); 2 acked by shashank / 1 auto-cancelled; self-resolve \~4–18 min; 0 incidents; weeks_seen 1; monitor created Aug 13 (config unchanged since) | **Fix the P5→High routing (and/or debounce).** before: Datadog P5; prod branch `{{#is_match env.name prod}}` → `@webhook-incidentio-high`; query trips on any 1 failed run in `last_5m`. after: route the prod branch → `@webhook-incidentio-low` or a Growth Slack (a P5 cron retry-failure should not page on-call at 2–3 AM), AND/OR require ≥ 2 consecutive failed runs before paging. Coverage: a genuinely stuck cron (repeated consecutive failures) still surfaces — at Low/Slack, or escalate to High only when sustained. | high | <custom data-type="status" data-id="id-2">recommend</custom> |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM + [133647342](https://app.datadoghq.com/monitors/133647342) mem-util | Activation dev-leak: dev OOM pages prod + stale dev-eks orphan | OOM handles still unconditional (dev-eks pages prod), 3 wks running; 0 fires this wk; mem-util stale \~12 wks; weeks_seen 3; configs unchanged (re-verified today) | **Gate to prod / clear orphan.** 133647340 — move High handles inside the prod `is_match` block (mirror 133647342); route dev to a dev Slack. 133647342 — scope out dev + clear the orphan. Coverage: prod OOM / memory still page High. | high | <custom data-type="status" data-id="id-3">strongly recommend</custom> |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; a Warn pages like a critical page | 2 self-resolving Warn this wk (Aug 19 \~8 min + Aug 20 \~6 min, both auto-resolved un-acked) + 2 last wk + 5 prior; weeks_seen 7; 0 incidents; config unchanged (re-verified today) | **Route HIGH → LOW / gate to critical.** before: util > 90 Alert / \~80 Warn → `@webhook-incidentio-high` + `@pagerduty-Activation-Alerts`. after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | <custom data-type="status" data-id="id-4">strongly recommend</custom> |
| [143507582](https://app.datadoghq.com/monitors/143507582) — duplicate funnel cashout | Recurring REAL failure (code bug), NOT noise + 2 stale alerts | 0 new fires; 2 alerts firing since Jun 3 / Jul 23 (verified still-firing); Datadog No Data; weeks_seen 3+; config unchanged (re-verified today) | **Do NOT tune → Jira code fix.** after: open/track a Jira fix (runbook SRE/3082453072); resolve the 2 stale alerts once shipped. Coverage: monitor unchanged. (SQL uses a `userid` placeholder — no customer value.) | high | <custom data-type="status" data-id="id-5">strongly recommend</custom> |

_Full history (now 20 rows, incl. OTGE 111957816 routing gap and the postman / notification-preferences latency debounce candidates) →_ [_Monitor Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577)_. Feedback loop: as of this refresh all diffable monitor configs remain unchanged vs their recorded before-state (no recommendation applied, \~29 runs). Re-verified live this run: HPA 135119948, OOM 133647340, mem-util 133647342, dup-funnel 143507582, first-cashout 17131362, LLM-quota 309355473, quick-reply 312932032, cron 313314019, OTGE 111957816 — no validation win, no regression. The Tuning Ledger (20 rows) is held unchanged this refresh — the two SQS-backlog monitors that spiked to Warn/Alert midday have self-recovered to OK; they are already tracked ledger candidates (rows for 137629294/364/650) and this is their known chronic Datadog-only flapping, so no new candidate and no weeks_seen change (weeks_seen rolls only at the Tuesday handoff)._

### 🔴 Open Going Into Handoff

**Active Datadog Alert/Warn now: 0.** No Growth-team monitor reads Alert or Warn as of the 7:35 PM PT snapshot (verified live via `status:(alert OR warn)`). The two Activation SQS Message-Backlog flappers — [137629364](https://app.datadoghq.com/monitors/137629364) (deactivate-user) and [137629294](https://app.datadoghq.com/monitors/137629294) (first-mile-calc) — that spiked to Warn/Alert around midday are **OK now** and have stayed OK, but they keep flapping in Datadog (the alert-event firehose grew to 224 with first-mile-calc at 180 in-window). These are chronic all-day flappers (oldest-message age oscillating around the 60 s Warn / 90 s Alert thresholds) that raise **0 incident.io pages**; a tuning candidate (add `env:prod` + a 10–15 min sustain), not an active prod issue right now.

**Stale / lingering incident.io alerts (need a manual clear, not active prod work): 4** (verified still-firing):

* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High, since 2026-06-03; Datadog No Data. Code bug → Jira + clear.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low, since 2026-07-23; same bug.
* Activation mem-util ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks group since 2026-05-29; Datadog OK on prod. Dev-scope leak → scope out dev + clear.
* Databricks "Promotions Metrics Processor Job Failed" — High, since 2025-12-17; no live Datadog monitor. Verify job + clear.

**Not a clean handoff:** no active prod Alert/Warn at this snapshot, but **4 stale incident.io alerts** need a manual clear, the first-cashout volume drop carries in (top priority), and a new cron-fail monitor is paging on-call overnight (tuning). The Activation SQS-backlog flappers are quiet right now but flap all day with 0 incident.io pages — still a tuning candidate.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** 11 open (<custom data-type="status" data-id="id-6">3 Critical</custom> / <custom data-type="status" data-id="id-7">8 High</custom>) via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) — **org-wide** scope (no Growth-owned ticket; closest is `ACT-2563`, a Datadog.Trace bump). The 3 Criticals are SCA dependency findings: `WEBPLAT-1569` (handlebars), `WEBPLAT-1570` (shell-quote), `WEBPLAT-1571` (@xhmikosr/decompress) — all To Do. The 8 High are transitive SCA bumps (`brace-expansion` ×2 — WEBPLAT-1484 / MOBPLAT-4568; `grpc` EBBUD-3394, In Review; `Datadog.Trace` ACT-2563; `jackson-core` KMONO-51, `jackson-databind` KMONO-49) plus two SAST findings (anti-forgery/CSRF `QAMRE-1842` and unsanitized file-path `CXP-1998`, both In Progress). Count is org-wide and volatile intraday (was 14 (3C/11H) on Aug 19; 11 (3C/8H) across all Aug 20 refreshes).

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

- [ ] **Escalate the first-cashout volume drop** (real, \~80% below baseline, \~13 days) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); check the Aug 7 \~15:00 UTC cliff for a deploy/instrumentation change; open a Jira code/product fix. Do NOT tune the monitor.
- [ ] **Fix the new cron-fail monitor routing** ([313314019](https://app.datadoghq.com/monitors/313314019)): it is Datadog P5 but its prod branch routes `@webhook-incidentio-high` and paged on-call 3× overnight PT (shashank acked 2). Route the prod branch → `@webhook-incidentio-low` / a Growth Slack and/or require ≥ 2 consecutive failed runs; separately verify whether the mark-tech cron is genuinely failing.
- [ ] **Ship the quick-reply routing fix** (INC-2824; monitor [312932032](https://app.datadoghq.com/monitors/312932032) fired again Aug 19 after last week's 7 fires — fix incomplete).
- [ ] **Add durable Anthropic-quota protection** for svc-conversational-onboarding (INC-2795 class; monitor [309355473](https://app.datadoghq.com/monitors/309355473)).
- [ ] **Verify OTGE monitor routing** ([111957816](https://app.datadoghq.com/monitors/111957816)): it fired \~49 min in prod with no notification handles — add a page/Slack handle so sustained readiness failures notify on-call.
- [ ] Fix Activation OOM routing [133647340](https://app.datadoghq.com/monitors/133647340): move the High handles inside the prod is_match block (mirror 133647342).
- [ ] Tune HPA [135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate to critical-only); keep OOM / pod-not-ready at HIGH.
- [ ] Clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342) + scope out dev.
- [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582)) and clear the 2 stale alerts once shipped.
- [ ] Tune the Activation SQS backlog cluster ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650)): add env:prod + a 10–15 min sustain; verify routing.
- [ ] Verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (\~8 months).
- [ ] Review open vulnerability tickets — 11 open (3 Critical / 8 High), org-wide; move the 3 SCA Criticals (WEBPLAT-1569 / 1570 / 1571, To Do) and triage the SAST findings (QAMRE-1842 anti-forgery, CXP-1998 file-path).

## 📝 Manual Notes (preserved across refreshes)

_Add notes here; they survive daily refreshes._

---

_Generated by the Growth Team Ops Review agent. Window: 2026-08-18 00:00 → 2026-08-25 00:00 America/Los_Angeles (week-to-date, \~2.8 days in; live, refreshed daily until it freezes at the Aug 25 handoff). Last refreshed: 2026-08-20 7:35 PM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities) — all connectors healthy. Customer identifiers redacted where present (none required this run). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent._
