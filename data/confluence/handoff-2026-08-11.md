🔒 **Frozen — final state at week close (2026-08-18).** This on-call week has ended; see the next week's page (2026-08-18 → 2026-08-25). Final refresh completed **2026-08-18 12:35 PM PT (America/Los_Angeles)** — later than the Tuesday handoff because both the incident.io and Atlassian (Confluence/Jira) connectors were down at the 08:12 AM PT handoff run; this refresh reconciles the full week against the now-restored connectors.

✅ **Connectors restored — week reconciled against incident.io.** incident.io is back after a 13-day outage (Aug 5–18). The full closing week now reconciles cleanly: **15 High-priority incident.io alert records, all resolved**, and every spot-checked page was **human-acknowledged by Nabi (primary on-call)** within \~20–55s — so this was an actively-handled week, not silent auto-resolves. The 4 stale orphans are verified still-firing. Two **coverage wins** held up: the LLM-quota monitor [309355473](https://app.datadoghq.com/monitors/309355473) caught a fresh recurrence of the INC-2795 Anthropic-quota condition (Sun Aug 16 → Mon Aug 17, \~8h, chat served on the spare model), and the quick-reply RUM monitor [312932032](https://app.datadoghq.com/monitors/312932032) caught the recurring INC-2824 dead-button no-op 7×.

🔴 **One unresolved real signal carried into the new week: the first-cashout volume drop.** The First Cashout Volume anomaly ([17131362](https://app.datadoghq.com/monitors/17131362)) fired Aug 7 on a genuine drop; hourly volume fell in a single hour at **Aug 7 \~15:00 UTC** (\~116/hr → \~21/hr) and has stayed depressed since. Re-grounded at close (Aug 1 → Aug 18, hourly): **Mon Aug 17 averaged \~20/hr vs the pre-cliff Mon Aug 3 \~115/hr (\~82% below)**, and Aug 18 morning remains low — the drop now persists **\~11 days** across five weekdays and two weekends, so seasonality is decisively out. The monitor is quiet only because its weekly anomaly model has adapted to the sustained low (it now under-reports) — quiet ≠ recovered. The sharp single-hour cliff is as consistent with an instrumentation/deploy change as with an organic demand drop; **cause not determined from available signals**. → Escalate: investigate via the Activation runbook / dashboard `kem-tug-987`, check for an Aug 7 \~15:00 UTC deploy, and open a Jira fix. This is a code/product investigation, not monitor tuning.

# Growth Team Ops Review — Weekly Handoff

**08/18/2026 Growth Team Ops Review** · On-call week **2026-08-11 → 2026-08-18** (Tuesday → Tuesday, America/Los_Angeles) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-08-18 12:35 PM PT** (final — week complete, 7 days).

On-call (closing week): Primary **Nabi** — confirmed from incident.io escalation acks this week (every spot-checked page was acked by Nabi). The handoff occurred Tue Aug 18 10:00 PT; the new week's primary is **shashank**, secondary **Alfred** (next primary Alfred, Aug 25).

## SLOs / SLAs (15 minutes)

* [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
* [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
* [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — closing week (full 7 days):** **12 page-worthy episodes** (5 High / 7 Low by monitor severity) = **15 incident.io High-priority alert records** (the difference is the LLM-quota sustained event, counted as 1 episode but 4 re-trigger alerts), **all resolved**. Breakdown: HPA [135119948](https://app.datadoghq.com/monitors/135119948) ×2 Warn (Thu), Activation OOM [133647340](https://app.datadoghq.com/monitors/133647340) ×2 (Thu + Mon, dev-eks paging prod), quick-reply RUM [312932032](https://app.datadoghq.com/monitors/312932032) ×7 (INC-2824), LLM-quota [309355473](https://app.datadoghq.com/monitors/309355473) ×1 sustained (INC-2795 class). 2 `[TEST]` notifications excluded. | **Prior full week (Aug 4–11):** 9 (8 High / 1 Low). | **Trend (full-vs-full): 12 vs 9 → ↑ (\~+33%)**, but _composition shifted_: infra self-resolving noise **down** (4: 2 HPA + 2 OOM, vs 6 prior), real member-facing app issues **up** (7 quick-reply + 1 LLM-quota). **Human-attention: 15** (spot-checked escalations all acked by Nabi within \~20–55s; incident.io stats show 0 expired/cancelled). **Auto-resolved without ack: 0.** **On-call burden: 12 of 15 pages out-of-hours (8 late-evening + 4 overnight).** **Escalation rate (alerts → NEW incidents): 0/15 (0%)** — the quick-reply and LLM-quota fires map to **pre-existing** INC-2824 / INC-2795 (both now closed), not new incidents. **Still firing: 0 active / 4 stale** (incident.io, reconciled). Total alert-event firehose: **361 events** for the week (SQS backlog / p99 / RUM noise beyond the real episodes; 0 incidents).

_Priority = monitor severity (High/Low); Warn/Alert = trigger level — a High-priority monitor can fire only at Warn. The 7 quick-reply fires are a P3 (Low-severity) Datadog monitor that nonetheless routes to_ `@webhook-incidentio-high`_, so they appear as High in incident.io._

## Incidents (15 minutes)

### Production Incidents — Customer Impact

**TL;DR:** The conversational-onboarding "quick reply routing nowhere" dead-button bug (INC-2824) kept recurring this week — the RUM monitor [312932032](https://app.datadoghq.com/monitors/312932032) caught it **7×** (Fri Aug 14, 4× Sat Aug 15, 2× Mon Aug 17); members tapping a quick-reply chip hit a no-op, minor UX only (no financial/data impact), each self-clearing in \~15 min and acked by on-call.

**What happened:** _Observed_ — INC-2824 (Sev3) was reported Aug 7 (impact from Aug 6 17:35 UTC) and marked resolved Aug 10 after the team reverted a backend deploy; its documented root cause was a backend copy change ("Let's Go" → "Yes, Let's Go") that no longer matched the frontend's exact-text predicate, dead-ending sign-up (an \~11% funnel drop; 1-hour sign-up rate 26% → \~18% at the time). **After that resolution, monitor 312932032 continued firing 7× this week** on the RUM error "Quick reply tap fell through to a no-op" — the alert's own text notes the tapped action is recognized by the frontend but its handler routes nowhere. _Likely cause_ — a residual/related frontend chip-routing no-op that the INC-2824 backend revert did not fully fix; the recurrence under normal member traffic shows it is not a one-off. → Frontend Jira fix still needed (see Action Items); do not tune the monitor. No customer PII exposed (RUM error is a count, no identifiers).

**TL;DR:** Conversational-onboarding hit its Anthropic Claude workspace quota again (INC-2795 class) Sun Aug 16 → Mon Aug 17 (\~8h); the LLM-quota monitor [309355473](https://app.datadoghq.com/monitors/309355473) caught it and chat was served on the spare model — members kept flowing, no new incident declared.

**What happened:** _Observed_ — INC-2795 (Sev3, the original Anthropic workspace-usage-limit exhaustion on svc-conversational-onboarding) was **closed Aug 4**. Monitor 309355473 (added late July as coverage for exactly this failure) then fired on a **fresh recurrence** of the quota condition Sun Aug 16 \~19:43 UTC, re-triggering \~every 2h until recovering Mon Aug 17 \~03:30 UTC (\~7h47m); incident.io recorded \~4 High alert records for the sustained event, all resolved and acked. No new incident was declared (chat degraded gracefully to the spare model). _Likely cause_ — the same workspace-quota fragility behind INC-2795 (call-amplifying features raise LLM calls per turn); recovery was likely a human spend-cap raise. → Coverage win (the gap that let INC-2795 run undetected is now caught), but the underlying quota fragility persists — track a durable fix (quota headroom / circuit-breaking) in Activation.

### Operational Incidents — Deploys / Data Repairs / Infra

No operational incidents this week. incident.io `incident_list` (team L2-PENG-Growth, Aug 11 → Aug 18) returned **0 incidents**, and Datadog-native incident search returned 0 for the team.

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

| Alert | Priority | Service | On-call | Agent Finding |
| --- | --- | --- | --- | --- |
| [312932032](https://app.datadoghq.com/monitors/312932032) — quick-reply taps routing nowhere (RUM) | <custom data-type="status" data-id="id-0">High</custom> | conversational-onboarding | Nabi | **TL;DR:** Fired 7× on the INC-2824 dead-button no-op (Fri Aug 14 + 4× Sat Aug 15 + 2× Mon Aug 17); Nabi acked (\~40–55s), each self-cleared in \~15 min; minor UX only. **What happened:** _Observed_ — Triggered→acked→resolved cycles on RUM error "Quick reply tap fell through to a no-op"; spot-checked escalations (Fri Aug 14 13:17 UTC, Mon Aug 17 21:34 UTC) were `user_acked` by Nabi then resolved via `all_responded`. Routes P3 monitor → `@webhook-incidentio-high`. _Likely cause_ — residual frontend chip-routing bug (see Incidents). Code bug, not noise → frontend Jira fix. |
| [133647340](https://app.datadoghq.com/monitors/133647340) — Activation OOM | <custom data-type="status" data-id="id-1">High</custom> | job-user-user-activation-processor | Nabi | **TL;DR:** Fired 2× on `dev-eks-cluster` OOM (Thu Aug 13 16:29 UTC + Mon Aug 17 03:10 UTC) but **paged prod on-call** — a dev-scope routing leak, not a prod problem; Nabi acked (\~20s overnight), each self-recovered in \~9 min. **What happened:** _Observed_ — Triggered on group `kube_cluster_name:dev-eks-cluster`; the Mon Aug 17 03:11 UTC escalation was `user_acked` by Nabi in \~21s (overnight page). **Prod-vs-dev:** the event is on dev-eks, but the monitor's High handles sit outside its `{{#is_match}}` blocks (prod block empty), so a dev OOM pages prod. **2nd week running** (also Aug 6). _Likely cause_ — transient dev-cluster memory spike; no prod impact. → Gate the High page to prod (see tuning). |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | <custom data-type="status" data-id="id-2">High</custom> | first-mile-calc (prod) | Nabi | **TL;DR:** Crossed **Warn** twice on `production-eks-cluster` Thu Aug 13 (04:47 UTC \~81.7%, 16:27 UTC \~82.3%), self-recovered ≤ 10 min each — no incident, no customer impact. **What happened:** _Observed_ — High-priority monitor firing only at the Warn trigger level (> \~80%; Alert is > 90%), so it never reached the paging Alert threshold; part of the actively-acked set. Env unambiguously prod (query `cluster_flavor:prod`). _Likely cause_ — the autoscaler briefly approached its replica ceiling during load bumps and cleared (infra saturation autoscaling handles). → Route HIGH → LOW (see tuning). |
| [309355473](https://app.datadoghq.com/monitors/309355473) — LLM workspace-quota exhausted | <custom data-type="status" data-id="id-3">High</custom> | svc-conversational-onboarding | Nabi | **TL;DR:** Fired on a real Anthropic-quota recurrence (INC-2795 class) Sun Aug 16 \~19:43 → Mon Aug 17 \~03:30 UTC (\~8h); chat served on the spare model, members kept flowing, no new incident. **What happened:** _Observed_ — sustained fire with \~2-hourly re-triggers (\~4 High alert records, all resolved/acked). _Likely cause_ — workspace-quota exhaustion (same fragility as INC-2795); recovery likely a human spend-cap raise. → Coverage win; track a durable quota fix (not a tuning change). |

### Auto-Resolved — Escalation Cancelled

**None this week.** With incident.io restored, all 15 page-worthy escalations reached `resolved` with 0 expired/cancelled, and every spot-checked page was human-acknowledged by the on-call (Nabi) — so there were no silent auto-resolves. (The 2 `[TEST]` notifications on the quick-reply monitors Aug 11 21:23–21:30 UTC were manual test fires, not real alerts.)

### Recurring / Flappy Alerts — Monitor Tuning Candidates

| Alert | Times Fired | Notes |
| --- | --- | --- |
| [312932032](https://app.datadoghq.com/monitors/312932032) — quick-reply taps routing nowhere (RUM) | 7 real (Fri Aug 14 ×1 + Sat Aug 15 ×4 + Mon Aug 17 ×2; \~15 min each) | **REAL frontend bug (INC-2824), NOT monitor noise → frontend Jira fix; do not tune.** Still firing after the INC-2824 revert (Aug 10) → residual chip-routing no-op. Coverage monitor (created Aug 11), so no ledger row. |
| [133647340](https://app.datadoghq.com/monitors/133647340) — Activation OOM | 2 dev-eks fires (Thu Aug 13 + Mon Aug 17; \~9 min each; PAGED prod) | Dev-scope leak: a dev-eks OOM pages prod on-call (High handles unconditional). 2nd wk running. Gate the High page to prod (mirror 133647342). |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | 2 Warn (Thu Aug 13; self-recovered ≤ 10 min each) | Infra autoscaling saturation on production-eks-cluster; a High monitor firing at Warn. Route HIGH → LOW (see recommendation). Prior full wk: ×5. |
| [309355473](https://app.datadoghq.com/monitors/309355473) — LLM workspace-quota | 1 sustained (\~8h Sun Aug 16 → Mon Aug 17; \~4 alert records) | **REAL recurrence (INC-2795 class), NOT noise → durable quota fix, do not tune.** Coverage monitor working as intended. No ledger row (coverage add). |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real signal (monitor now quiet); flapped 14× Aug 7–9 | Real drop, NOT monitor noise → investigate / Jira; do not tune. Persists \~11 days; Mon Aug 17 \~20/hr vs pre-cliff Mon Aug 3 \~115/hr (\~82% below). |
| [137629294](https://app.datadoghq.com/monitors/137629294) — first-mile SQS backlog | \~238 events (week) | Chronic Datadog-only noise, 0 pages; add env:prod + sustain; verify prod routing. |
| [137629364](https://app.datadoghq.com/monitors/137629364) — deactivated-user SQS backlog | 49 events (week) | Chronic Datadog-only noise; add env:prod + sustain. |
| [137629650](https://app.datadoghq.com/monitors/137629650) — user-activation SQS backlog | 31 events (week) | Overnight backlog; add a sustain window. |
| [259552001](https://app.datadoghq.com/monitors/259552001) — conv-onboarding p99 latency | 27 events (week) | P5 Slack-only; add sustain / verify baseline. |

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~11 days (Aug 7 15:00 UTC cliff → Aug 18); \~82% below baseline (Mon Aug 17 \~20/hr vs pre-cliff Mon Aug 3 \~115/hr) across 5 weekdays + 2 weekends; weeks_seen 3; monitor quiet (model adapting); routes low-urgency | **Do NOT tune → investigate.** before: monitor unchanged (correctly caught a real drop). after: investigate via Activation runbook (dashboard `kem-tug-987`); rule out a product/code regression vs an instrumentation/deploy change at the Aug 7 \~15:00 UTC cliff; open a Jira fix. Coverage: monitor unchanged — keeps catching real drops. | high | <custom data-type="status" data-id="id-4">strongly recommend</custom> |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM + [133647342](https://app.datadoghq.com/monitors/133647342) mem-util | Activation dev-leak: dev OOM pages prod (handles unconditional) + stale dev-eks mem-util orphan | OOM paged prod from dev-eks **2× this wk** (Thu Aug 13 + Mon Aug 17; both acked by Nabi); 3 consecutive weeks paging prod from dev; mem-util stale \~11 wks, prod OK; weeks_seen 3; configs unchanged | **Gate to prod / clear orphan.** 133647340 — move the High handles inside the prod `is_match` block (mirror 133647342); route the dev branch to a dev Slack. 133647342 — scope out dev + clear the orphan. Coverage: prod-cluster OOM / memory still page High. | high | <custom data-type="status" data-id="id-5">strongly recommend</custom> |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; a Warn pages like a critical page | 2 self-resolving Warn pages this wk (Thu Aug 13, ≤10 min each, acked by Nabi) + 5 prior wk; weeks_seen 7; 0 incidents | **Route HIGH → LOW / gate to critical.** before: util > 90 Alert / \~80 Warn → `@webhook-incidentio-high` + `@pagerduty-Activation-Alerts`. after: route the sustained-utilization branch → `@webhook-incidentio-low` (or scope the page handle to critical only); keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | <custom data-type="status" data-id="id-6">strongly recommend</custom> |
| [143507582](https://app.datadoghq.com/monitors/143507582) — duplicate funnel cashout | Recurring REAL failure (code bug), NOT noise + 2 stale alerts | 0 new fires; 2 alerts firing since Jun 3 (High) / Jul 23 (Low), both verified still-firing; Datadog No Data; weeks_seen 3+ | **Do NOT tune → Jira code fix.** after: open/track a Jira fix for the duplicate funnel-cashout bug (runbook SRE/3082453072); resolve the 2 stale alerts once shipped. Coverage: monitor unchanged, keeps catching duplicates. (Monitor SQL uses a `userid` placeholder — no customer value.) | high | <custom data-type="status" data-id="id-7">strongly recommend</custom> |
| [137629294](https://app.datadoghq.com/monitors/137629294) (+ [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650)) — Activation SQS backlog | Flappy backlog, no env scope / no sustain (0 pages) | Chronic; \~238 / 49 / 31 events this wk; 0 incident.io pages; weeks_seen 7 / 6 / 6 | **Add scope + sustain; verify routing.** before: SQS oldest-age > 90s (> 150s for user-activation), last_5m, no sustain. after: add `env:prod` + a 10–15 min sustain (self-clears in \~2–4 min); verify the prod routing branch actually resolves. Coverage: a sustained real backlog still pages High. | med | <custom data-type="status" data-id="id-8">recommend</custom> |

_Full 19-row history →_ [_Monitor Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577)_. Feedback loop (this run): all 20 diffable monitor configs were re-read and are unchanged vs their recorded before-state — no recommendation has been applied (≈24 runs, no validation win). With incident.io restored, acks were captured for the first time in 13 days (all spot-checked pages acked by Nabi)._

🆕 **New monitor coverage is doing its job.** The two RUM monitors created Aug 11 for the svc-conversational-onboarding quick-reply routing bug (INC-2824) — [312930741](https://app.datadoghq.com/monitors/312930741) (P1) and [312932032](https://app.datadoghq.com/monitors/312932032) (P3) — surfaced this week's recurrence (312932032 caught 7 real member-facing fires; 312930741 remains OK/test-only). Together with the LLM-quota monitor [309355473](https://app.datadoghq.com/monitors/309355473) catching the INC-2795 recurrence, both recent coverage adds are paying off. These are added detection for code/quota problems, so fixes belong in Jira/product changes, not tuning (no ledger row).

### 🔴 Open Going Into Handoff

**Active prod Alert/Warn now:** none (0). Datadog `status:(alert OR warn)` for the team returned no data at close.

**Stale / lingering incident.io alerts (need a manual clear, not active prod work): 4** (verified still-firing via restored incident.io):

* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High, firing since 2026-06-03; Datadog **No Data**. Code bug → Jira + clear.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low, firing since 2026-07-23; same bug.
* Activation processor sustained memory utilization ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks-cluster group firing since 2026-05-29; Datadog **OK on prod**. Dev-scope leak → scope out dev + clear.
* Databricks "Promotions Metrics Processor Job Failed" — High, firing since 2025-12-17; no live Datadog monitor. Verify job + clear.

**Not a fully clean handoff:** no active prod issues, but one unresolved real signal carries into the new week — the first-cashout volume drop (\~11 days, \~82% below baseline; monitor quiet) — plus 4 stale incident.io alerts to clear. The quick-reply frontend bug (7 real fires) also remains open pending the frontend fix.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** 13 open (<custom data-type="status" data-id="id-9">3 Critical</custom> / <custom data-type="status" data-id="id-10">10 High</custom>) via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) — **org-wide** scope (no Growth-owned ticket in the set; the closest is `ACT-2563`, a Datadog.Trace bump). **Down 1 vs Aug 16** (was 14; a `jackson-databind` High dropped out). The **3 Criticals** are unchanged findings but have progressed To Do → **In Review**: `ECD-11625` / `ECD-11626` / `ECD-11627` (\[VM,SAST\] Critical: unsanitized dynamic input in OS command, in `internal/github`, `internal/codereview`, `internal/agent` of activehours/pr-explorer). The 10 High are transitive SCA dependency bumps: `brace-expansion` (×3: WEBPLAT-1484, QAMRE-1897, MOBPLAT-4568), `google.golang.org/grpc` (×4: ECD-11455, EBBUD-3394/3395/3397 — the three EBBUD now _In Review_), `js-yaml` (QAMRE-1898), `ws` (QAMRE-1896), and `Datadog.Trace` (ACT-2563).

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

- [ ] **Escalate the first-cashout volume drop** (real, \~82% below baseline Aug 7 → now, \~11 days, confirmed across weekdays + both weekends) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); rule out a product/code regression vs an instrumentation gap around the Aug 7 \~15:00 UTC cliff; open a Jira code/product fix. Do NOT tune the monitor.
- [ ] **Ship the svc-conversational-onboarding quick-reply routing fix** (INC-2824; dead-button no-op) — a **frontend code fix**; monitor [312932032](https://app.datadoghq.com/monitors/312932032) is still catching it 7× this week _after_ the Aug 10 backend revert, so the fix is incomplete.
- [ ] **Add durable Anthropic-quota protection for svc-conversational-onboarding** (INC-2795 class) — headroom/spend-cap alerting + circuit-breaking; the LLM-quota monitor [309355473](https://app.datadoghq.com/monitors/309355473) caught a fresh \~8h recurrence Aug 16–17.
- [ ] Fix Activation OOM routing [133647340](https://app.datadoghq.com/monitors/133647340): move the High handles inside the prod is_match block (mirror 133647342) so a dev-eks OOM stops paging prod. (Paged prod from dev-eks 2× this week — 3rd week running.)
- [ ] Tune HPA [135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate the page to critical-only); keep OOM / pod-not-ready at HIGH.
- [ ] Clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342) + scope out dev.
- [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582); runbook SRE/3082453072) and clear the 2 stale alerts once shipped.
- [ ] Tune the Activation SQS backlog cluster ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650)): add env:prod + a 10–15 min sustain; verify the prod routing branch actually pages.
- [ ] Verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (firing \~8 months); fix its auto-resolution.
- [ ] Review open vulnerability tickets — 13 open (3 Critical / 10 High), org-wide; keep the 3 SAST OS-command-injection Criticals (ECD-11625 / 11626 / 11627, now In Review) moving.

## 📝 Manual Notes (preserved across refreshes)

_Add notes here; they survive daily refreshes._

---

_Generated by the Growth Team Ops Review agent. Window: 2026-08-11 00:00 → 2026-08-18 00:00 America/Los_Angeles (full 7-day week; frozen at handoff). Last refreshed: 2026-08-18 12:35 PM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities) — both connectors restored this run and the full week was reconciled (15 High alerts all resolved and human-acked by Nabi; 4 stale verified; on-call corrected; vuln 13). Customer identifiers redacted where present (the duplicate-cashout monitor SQL uses a_ `userid` _placeholder, not customer data). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent._
