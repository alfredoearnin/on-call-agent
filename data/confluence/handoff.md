🔄 **Live page** — refreshed daily during the on-call week (2026-08-11 → 2026-08-18). Last refreshed **2026-08-16 08:00 AM PT (America/Los_Angeles)**. This page freezes at the Tuesday handoff (2026-08-18); a new page opens for the next week.

⚠️ **incident.io connector unavailable this run** (MCP status `needsAuth` — the outage now spans **Aug 5–16, \~12 days**). This report is built from **Datadog (read-only) + Jira** only: alerts are Datadog-derived, **ack vs auto-resolved is undeterminable**, and the on-call names + the 4 stale-alert set are **carried from the last incident.io read (Aug 4), unverified**.

🔴 **Two unresolved real signals going into the back half of the week.** **(1) The first-cashout volume drop is still unresolved** — the First Cashout Volume anomaly ([17131362](https://app.datadoghq.com/monitors/17131362)) fired Aug 7 on a genuine drop; hourly volume fell in a single hour at **Aug 7 \~15:00 UTC** (\~116/hr → \~21/hr) and has stayed depressed (\~5–45/hr) for **\~9 days**. A second weekend now confirms it: a like-for-like **Sun Aug 16 \~15/hr vs the pre-drop Sun Aug 2 \~97/hr (\~84% below)**, flat against the in-drop Sun Aug 9 (\~15/hr) — after five weekdays already ruled out weekday seasonality, seasonality is decisively out. The monitor is quiet only because its weekly anomaly model has adapted to the sustained low (it now under-reports) — quiet ≠ recovered. The single-hour cliff looks as consistent with an instrumentation/deploy change as with an organic demand drop; **cause not determined from available signals**. Next weekday datapoint: Mon Aug 17. **(2) The quick-reply frontend bug is now recurring** — RUM monitor [312932032](https://app.datadoghq.com/monitors/312932032) (INC-2824) fired for real **5×** this week (Fri Aug 14 once, then **4× Saturday evening**), each a member hitting a dead-button no-op. **Escalate both:** investigate first-cashout via the Activation runbook / dashboard `kem-tug-987` and check for an Aug 7 \~15:00 UTC deploy; ship the frontend chip-routing fix (INC-2824). Both are code/product fixes, not monitor tuning.

# Growth Team Ops Review — Weekly Handoff

**08/16/2026 Growth Team Ops Review** · On-call week **2026-08-11 → 2026-08-18** (Tuesday → Tuesday, America/Los_Angeles) · Sources: incident.io + Datadog (read-only) — incident.io unavailable this run, so alerts are Datadog-derived · Last refreshed: **2026-08-16 08:00 AM PT** (\~5.3 days / \~128 h into the week).

On-call: the week-to-week handoff occurred Tue Aug 11 10:00 PT; the new primary/secondary could not be verified (incident.io connector down, \~12 days), and the rotation would normally have advanced for this week. Last verified (Aug 4): Primary **Ankur Shivani**, Secondary **Edder Núñez**.

## SLOs / SLAs (15 minutes)

* [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
* [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
* [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume this week (week-to-date, \~5.3 days / \~128 h in):** **8 page-worthy alerts** — on Thursday, HPA [135119948](https://app.datadoghq.com/monitors/135119948) (High) ×2 self-resolving Warn and a dev-eks OOM [133647340](https://app.datadoghq.com/monitors/133647340) (High) that paged prod; then the P3 quick-reply RUM monitor [312932032](https://app.datadoghq.com/monitors/312932032) firing **5×** on a real recurring frontend bug (Fri Aug 14 ×1, Sat Aug 15 ×4). 2 `[TEST]` notifications excluded. Mix: 3 infra High + 5 P3 RUM (all route high-urgency). | **Prior full week:** 9 (8 High, 1 Low) | **Trend: run-rate \~10/wk vs prior 9/wk → \~flat (slightly up)** (by same-slice, 8 this week vs \~8–9 in the prior week's same \~128-h slice → flat). _Composition shifted:_ infra self-resolving noise is **down** (3 this week vs \~7 in the prior slice), offset by the new recurring quick-reply frontend bug (×5). **Human-attention:** n/a · **Auto-resolved:** 8 (incident.io unavailable — ack undeterminable; all self-recovered in ≤ \~15 min). **Escalation rate (alerts → incidents):** 0/8 (0%) Datadog-native — incident.io unavailable, though the 5 quick-reply fires are linked to incident.io **INC-2824**. **Still firing: 0 active / 4 stale** (incident.io, carried/unverified). Total alert-event firehose: **320 events** week-to-date (SQS backlog / p99 / RUM noise beyond the real episodes; 0 incidents), run-rate \~419/wk vs 427 prior full week.

_Priority = monitor severity (High/Low); Warn/Alert = trigger level — a High-priority monitor can fire only at Warn._

## Incidents (15 minutes)

### Production Incidents — Customer Impact

**TL;DR:** The conversational-onboarding "quick reply routing nowhere" frontend bug (INC-2824, monitor [312932032](https://app.datadoghq.com/monitors/312932032)) is **now recurring** — after its first real fire Fri Aug 14 it fired **4 more times Saturday evening** (5 total this week). Each is a member tapping a quick-reply chip that dead-ends in a no-op; minor UX only (no financial or data impact), self-clearing in \~15 min each.

**What happened:** _Observed_ — the P3 RUM monitor 312932032 transitioned Triggered→Recovered five times on real production RUM errors (count > 0 over the last 15m): **Aug 14 13:15→13:30 UTC**, then **Aug 15 16:12→16:27, 21:06→21:21, 22:06→22:21, 23:01→23:16 UTC** (\~15 min each). The Aug 11 firings on this monitor and its P1 sibling [312930741](https://app.datadoghq.com/monitors/312930741) were manual `[TEST]` notifications; the Fri/Sat events are genuine member-facing occurrences. Datadog-native incident search returned 0 for the team, and incident.io — which holds INC-2824 — is unavailable, so a formal incident severity/status cannot be confirmed this run. _Likely cause_ — per the monitor's own definition, a quick-reply chip recognized by the frontend has no routing handler, so the tap falls through to a no-op (a frontend chip-routing bug, not deploy skew); consistent with the monitor's stated hypothesis but not independently confirmed. The Saturday-evening cluster suggests the bug reproduces under normal member traffic, not a one-off. → Tracked as a frontend Jira fix (see Action Items); the fix is now more urgent given the recurrence. No customer PII was exposed.

### Operational Incidents — Deploys / Data Repairs / Infra

Data unavailable — check incident.io manually (connector returned Unauthorized / `needsAuth`). Datadog-native incident search returned **0 incidents** for the team this week.

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

No alert could be confirmed as human-acknowledged this week — incident.io is unavailable (\~12 days), so ack state is undeterminable. All eight page-worthy alerts this week self-resolved and are detailed under Auto-Resolved below.

### Auto-Resolved — Escalation Cancelled

**TL;DR:** The first-mile-calc HPA autoscaling monitor ([135119948](https://app.datadoghq.com/monitors/135119948), High) briefly crossed **Warn** twice on Thursday (Aug 13) on `production-eks-cluster` and self-recovered within \~10 min each — no incident, no customer impact.

**What happened:** _Observed_ — monitor 135119948 transitioned to **Warn** at **Aug 13 04:47:08 UTC** (\~81.7% HPA utilization; recovered 04:56 UTC, \~9 min) and again at **Aug 13 16:27:08 UTC** (\~82.3%; recovered 16:37 UTC, \~10 min) on `production-eks-cluster`. It is a High-priority monitor (routes `@pagerduty-Activation-Alerts` + `@webhook-incidentio-high`) but fired only at the Warn trigger level (> \~80%; Alert is > 90%), so it never reached the paging Alert threshold. incident.io is down, so whether a human acked cannot be confirmed; classified Auto-Resolved (self-recovered, no incident). No new HPA fire since Thursday. _Likely cause_ — the first-mile-calc autoscaler briefly approached its max-replica ceiling during short load bumps and cleared when load fell (infra saturation that autoscaling handles). Env is unambiguously prod (query scope `cluster_flavor:prod`, cluster `production-eks-cluster`) — no prod-vs-dev mismatch. This is the noise the tuning recommendation below (route HIGH → LOW) targets.

**TL;DR:** The Activation OOM monitor ([133647340](https://app.datadoghq.com/monitors/133647340), High) fired Thursday (Aug 13) for a **dev-eks-cluster** OOM but **paged prod on-call** — a dev-scope routing leak, not a prod problem — and self-recovered in \~9 min.

**What happened:** _Observed_ — 133647340 Triggered at **Aug 13 16:29:40 UTC** on group `kube_cluster_name:dev-eks-cluster` (OOM-killed / running ratio ≥ 33%) and Recovered at 16:38:40 UTC (\~9 min); none new since. **Prod-vs-dev:** the event is on `dev-eks-cluster`, yet the monitor's High handles (`@pagerduty-Activation-Alerts` + `@webhook-incidentio-high`) sit _outside_ its `{{#is_match}}` blocks (the prod block is empty), so a dev-cluster OOM pages prod on-call. This is the **second week running** it has done so (also Aug 6) — the exact routing bug the tuning recommendation below targets (gate the High page to prod, mirror sibling 133647342). incident.io is down, so ack can't be confirmed; classified Auto-Resolved. _Likely cause_ — a transient dev-cluster memory spike; no prod impact.

**TL;DR:** The P3 quick-reply RUM monitor ([312932032](https://app.datadoghq.com/monitors/312932032), conversational-onboarding) fired for real **5×** this week (Fri Aug 14 + 4× Sat Aug 15 evening) on the dead-button no-op (INC-2824); each self-cleared in \~15 min.

**What happened:** _Observed_ — five Triggered→Recovered cycles: Aug 14 13:15→13:30, and Aug 15 16:12→16:27 / 21:06→21:21 / 22:06→22:21 / 23:01→23:16 UTC (\~15 min each); see Production Incidents above for detail. It is a P3 monitor that also routes `@webhook-incidentio-high`; ack can't be confirmed (incident.io down). _Likely cause_ — the known frontend chip-routing bug; the Saturday-evening cluster shows it reproduces under normal traffic. This is a **code bug, not monitor noise** → frontend Jira fix, do not tune.

The remaining alert events this week were **2** `[TEST]` **notifications** for the conversational-onboarding quick-reply monitors ([312930741](https://app.datadoghq.com/monitors/312930741) P1, [312932032](https://app.datadoghq.com/monitors/312932032) P3), manually test-fired Aug 11 21:23–21:30 UTC — not real firings.

### Recurring / Flappy Alerts — Monitor Tuning Candidates

| Alert | Times Fired | Notes |
| --- | --- | --- |
| [312932032](https://app.datadoghq.com/monitors/312932032) — quick-reply taps routing nowhere (RUM) | 5 real (Fri Aug 14 ×1 + Sat Aug 15 ×4; \~15 min each) | **REAL frontend bug (INC-2824), NOT monitor noise → frontend Jira fix; do not tune.** Now recurring under member traffic. Coverage monitor (created Aug 11), so no ledger row. |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | 2 Warn (Thu Aug 13 04:47 + 16:27 UTC; self-recovered ≤ 10 min each) | Infra autoscaling saturation on production-eks-cluster; a High monitor firing at Warn. Route HIGH → LOW (see recommendation). Prior full wk: ×5. |
| [133647340](https://app.datadoghq.com/monitors/133647340) — Activation OOM | 1 dev-eks fire (Thu Aug 13 16:29 UTC, \~9 min; PAGED prod) | Dev-scope leak: a dev-eks OOM pages prod on-call (High handles unconditional). 2nd wk running (also Aug 6). Gate the High page to prod (mirror 133647342). |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real signal (monitor quiet); flapped 14× Aug 7–9 | Real drop, NOT monitor noise → investigate / Jira; do not tune. Persists \~9 days; weekend-over-weekend confirmed a 2nd weekend (\~84% below the pre-drop Sun Aug 2). |
| [137629294](https://app.datadoghq.com/monitors/137629294) — first-mile SQS backlog | \~206 events (week-to-date) | Chronic Datadog-only noise, 0 pages; add env:prod + sustain; verify prod routing. |
| [137629364](https://app.datadoghq.com/monitors/137629364) — deactivated-user SQS backlog | 49 events (week-to-date) | Chronic Datadog-only noise; add env:prod + sustain. |
| [137629650](https://app.datadoghq.com/monitors/137629650) — user-activation SQS backlog | \~27 events (week-to-date) | Overnight backlog; add a sustain window. |
| [259552001](https://app.datadoghq.com/monitors/259552001) — conv-onboarding p99 latency | 20 events (week-to-date) | P5 Slack-only; add sustain / verify baseline. |

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~9 days (Aug 7 → now); \~80–85% below baseline across 5 weekdays AND both weekends (Sun Aug 16 \~15/hr vs pre-drop Sun Aug 2 \~97/hr; Sat Aug 15 \~16/hr vs pre-drop Sat Aug 1 \~102/hr); weeks_seen 2; monitor now quiet (model adapting); routes low-urgency | **Do NOT tune → investigate.** before: monitor unchanged (correctly catching a real drop). after: investigate via Activation runbook (dashboard kem-tug-987); rule out a product/code regression vs an upstream metric/instrumentation gap at the Aug 7 \~15:00 UTC cliff; open a Jira fix. Coverage: monitor unchanged — keeps catching real drops. | high | <custom data-type="status" data-id="id-0">strongly recommend</custom> |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; a Warn pages like a critical page | 2 self-resolving Warn pages this wk (Thu Aug 13, ≤10 min each) + 5 last wk; weeks_seen 6; 0 incidents; auto-resolved (ack n/a — incident.io down) | **Route HIGH → LOW / gate to critical.** before: util > 90 Alert / \~80 Warn → @webhook-incidentio-high + @pagerduty-Activation-Alerts. after: route the sustained-utilization branch → @webhook-incidentio-low (or scope the page handle to critical only); keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | <custom data-type="status" data-id="id-1">strongly recommend</custom> |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM + [133647342](https://app.datadoghq.com/monitors/133647342) mem-util | Activation dev-leak: dev OOM pages prod (handles unconditional) + stale dev-eks mem-util orphan | OOM paged prod from dev-eks **again Thu Aug 13** (2nd wk running: Aug 6 + Aug 13; weeks_seen 2); mem-util stale \~11 wks, prod OK (weeks_seen 3+); both configs unchanged this run | **Gate to prod / clear orphan.** 133647340 — move the High handles inside the prod is_match block (mirror 133647342); route the dev branch to a dev Slack. 133647342 — scope out dev + clear the orphan. Coverage: prod-cluster OOM / memory still page High. | high | <custom data-type="status" data-id="id-2">strongly recommend</custom> |
| [143507582](https://app.datadoghq.com/monitors/143507582) — duplicate funnel cashout | Recurring REAL failure (code bug), NOT noise + 2 stale alerts | 0 new fires; 2 alerts firing since Jun 3 (High) / Jul 23 (Low); Datadog No Data; weeks_seen 3+ | **Do NOT tune → Jira code fix.** after: open/track a Jira fix for the duplicate funnel-cashout bug (runbook SRE/3082453072); resolve the 2 stale alerts once shipped. Coverage: monitor unchanged, keeps catching duplicates. (Monitor SQL uses a `userid` placeholder — no customer value.) | high | <custom data-type="status" data-id="id-3">strongly recommend</custom> |
| [137629294](https://app.datadoghq.com/monitors/137629294) (+ [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650)) — Activation SQS backlog | Flappy backlog, no env scope / no sustain (0 pages) | Chronic; \~206 / 49 / \~27 events week-to-date; 0 incident.io pages; weeks_seen 6 / 5 / 5 | **Add scope + sustain; verify routing.** before: SQS oldest-age > 90s (> 150s for user-activation), last_5m, no sustain. after: add env:prod + a 10–15 min sustain (self-clears in \~2–4 min); verify the prod routing branch actually resolves. Coverage: a sustained real backlog still pages High. | med | <custom data-type="status" data-id="id-4">recommend</custom> |

_Full 18-row history →_ [_Monitor Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577)_. Feedback loop (this run): all 20 diffable monitor configs were re-read and are unchanged vs their recorded before-state — no recommendation has been applied (≈23 consecutive runs, no validation win)._

🆕 **New monitor coverage is doing its job.** The two RUM monitors created Aug 11 for the svc-conversational-onboarding quick-reply routing bug (INC-2824) — [312930741](https://app.datadoghq.com/monitors/312930741) (P1) and [312932032](https://app.datadoghq.com/monitors/312932032) (P3) — are what surfaced this week's recurrence: 312932032 has now caught **5 real member-facing fires** (Fri Aug 14 ×1 + Sat Aug 15 ×4); 312930741 remains OK (only test-fired). This is added detection for a **frontend code bug**, so the fix belongs in a Jira/frontend change, not a tuning change (no ledger row, mirroring how the LLM-quota coverage add was tracked).

### 🔴 Open Going Into Handoff

**Active prod Alert/Warn now:** none (0).

**Stale / lingering incident.io alerts (need a manual clear, not active prod work): 4** (carried from Aug 4, unverified — connector down):

* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High, firing since 2026-06-03; Datadog **No Data**. Code bug → Jira + clear.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low, firing since 2026-07-23; same bug.
* Activation processor sustained memory utilization ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks-cluster group firing since 2026-05-29; Datadog **OK on prod**. Dev-scope leak → scope out dev + clear.
* Databricks "Promotions Metrics Processor Job Failed" — High, firing since 2025-12-17; no live Datadog monitor. Verify job + clear.

**Not a clean start:** no active prod issues, but two unresolved real signals remain — the first-cashout volume drop (now \~9 days, weekend-over-weekend confirmed \~84% below baseline; monitor quiet) and the quick-reply frontend bug (now recurring — 5 real member-facing fires this week) — plus 4 stale incident.io alerts to clear.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** 14 open (<custom data-type="status" data-id="id-5">3 Critical</custom> / <custom data-type="status" data-id="id-6">11 High</custom>) via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) — **org-wide** scope (no Growth-owned ticket in the set; the closest is `ACT-2563`, a Datadog.Trace bump in svc-notification-preferences). **Unchanged in total and composition vs Aug 15** (14; 3 Critical / 11 High); the count is volatile intraday. The **3 Criticals are unchanged** — `ECD-11625` / `ECD-11626` / `ECD-11627` (\[VM,SAST\] Critical: unsanitized dynamic input in OS command, in `internal/github`, `internal/codereview`, `internal/agent` of activehours/pr-explorer; all still To Do). The 11 High are all transitive SCA dependency bumps: `brace-expansion` (×3: WEBPLAT-1484, QAMRE-1897, MOBPLAT-4568), `google.golang.org/grpc` (×4: ECD-11455, EBBUD-3394/3395/3397 — the three EBBUD now _In Review_), `js-yaml` (QAMRE-1898), `ws` (QAMRE-1896), `Datadog.Trace` (ACT-2563), and `jackson-databind` (KMONO-49).

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

- [ ] **Escalate the first-cashout volume drop** (real, \~80–85% below baseline Aug 7 → now, \~9 days, confirmed across weekdays Mon–Fri and both weekends — Sun Aug 16 \~15/hr vs pre-drop Sun Aug 2 \~97/hr) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); rule out a product/code regression vs an instrumentation gap around the Aug 7 \~15:00 UTC cliff; open a Jira code/product fix. Do NOT tune the monitor.
- [ ] **Ship the svc-conversational-onboarding quick-reply routing fix** (INC-2824; dead-button no-op) — a **frontend code fix**, now **recurring under member traffic** (5 real fires this week: Fri Aug 14 + 4× Sat Aug 15), tracked by monitors [312930741](https://app.datadoghq.com/monitors/312930741) / [312932032](https://app.datadoghq.com/monitors/312932032). Higher priority given the recurrence.
- [ ] Tune HPA [135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate the page to critical-only); keep OOM / pod-not-ready at HIGH. (Fired 2 Warn this week, self-resolved ≤ 10 min each.)
- [ ] Fix Activation OOM routing [133647340](https://app.datadoghq.com/monitors/133647340): move the High handles inside the prod is_match block (mirror 133647342) so a dev-eks OOM stops paging prod. (Paged prod from dev-eks again Thu Aug 13 — 2nd week running.)
- [ ] Clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342) + scope out dev.
- [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582); runbook SRE/3082453072) and clear the 2 stale alerts once shipped.
- [ ] Tune the Activation SQS backlog cluster ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650)): add env:prod + a 10–15 min sustain; verify the prod routing branch actually pages.
- [ ] Verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (firing \~8 months); fix its auto-resolution.
- [ ] Re-authenticate the incident.io connector (down Aug 5–16, \~12 days) — ack/auto-resolve classification, firing-set reconciliation, and on-call verification are blocked.
- [ ] Review open vulnerability tickets — 14 open (3 Critical / 11 High), org-wide; triage the 3 unchanged Critical SAST OS-command-injection findings (ECD-11625 / ECD-11626 / ECD-11627).

## 📝 Manual Notes (preserved across refreshes)

_Add notes here; they survive daily refreshes._

---

_Generated by the Growth Team Ops Review agent. Window: 2026-08-11 00:00 → 2026-08-18 00:00 America/Los_Angeles (week-to-date, \~5.3 days / \~128 h in; live, refreshed daily). Last refreshed: 2026-08-16 08:00 AM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities); incident.io unavailable this run (\~12 days) — alerts are Datadog-derived, and on-call + the 4 stale alerts are carried from the Aug 4 read. Customer identifiers redacted where present (the duplicate-cashout monitor SQL uses a_ `userid` _placeholder, not customer data). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent._
