🔄 **Live page** — refreshed daily during the on-call week (2026-08-25 → 2026-09-01). Last refreshed **2026-08-28 10:04 AM PT (America/Los_Angeles)** (\~72 h / \~3.0 days into the week). This page freezes at the Tuesday handoff (2026-09-01 11:00 America/Mexico_City); a new page opens for the next week.

🔴 **Carry-in — two real, unresolved cashout-volume signals (both re-grounded today).** (1) **First-cashout volume** — the Aug 7 \~15:00 UTC cliff persists (\~21 days). A Thu-evening surge to \~102–122/hr (Aug 28 \~00:00–04:00 UTC) was the highest hourly count since the cliff, but Fri hours fell back to \~7–66/hr and overnight troughs remain \~1–20/hr — still short of pre-cliff weekday \~110–198/hr. Monitor [17131362](https://app.datadoghq.com/monitors/17131362) reads OK only because its anomaly model adapted (quiet ≠ recovered). (2) **Funnel-cashout expirations remain low** — `FunnelCashoutExpired` \~1–13/hr (vs \~20–79/hr earlier); monitor [143509449](https://app.datadoghq.com/monitors/143509449) threshold was tightened `< 5` → `< 2` at the Aug 25 handoff (confirmed live again today) and has **not** fired this week — but that does **not** resolve the underlying drop. **Cause not determined from available signals.** → Investigate both via the Activation runbook / dashboard `kem-tug-987`; open a Jira fix. Possibly related: the OTGE grant-ratio anomaly [111675017](https://app.datadoghq.com/monitors/111675017) is firing now (see Open Going Into Handoff).

# Growth Team Ops Review — Weekly Handoff

**08/28/2026 Growth Team Ops Review** · On-call week **2026-08-25 11:00 → 2026-09-01 11:00** (America/Mexico_City) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-08-28 10:04 AM PT** (\~72 h into the week; live, refreshed daily).

_This on-call week — primary: **Alfred**; secondary: **aiden.ramgoolam** (shift Tue Aug 25 → Tue Sep 1; verified live via_ `schedule_show`_). Next handoff Sep 1: primary **aiden.ramgoolam**, secondary **Edder Núñez**._

_Coverage check: could not be completed (no Slack profile-read tool available) — verify availability manually._

## SLOs / SLAs (15 minutes)

* [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
* [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
* [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — week-to-date (\~72 h / \~3.0 days in):** **4 incident.io High alert records**, all resolved, 0 Low — from two monitors: the first-mile-calc HPA [135119948](https://app.datadoghq.com/monitors/135119948) (×3, all at Warn on prod) and the Activation OOM [133647340](https://app.datadoghq.com/monitors/133647340) (×1, at Alert on dev-eks — it paged prod on-call, but its routing was fixed later that evening; see below). | **Prior full week (Aug 18–25):** 22 High. | **Trend: run-rate \~9/wk vs prior 22/wk → ↓** (week-to-date is partial; verdict from run-rate; corroborated by 4 week-to-date vs 11 in the prior week's same \~3.0-day slice — both point down). **Human-attention: 4** (all acked by Alfred). **Auto-resolved: 0.** **Escalation rate (alerts → incidents): 0/4 (0%).** **Still firing: 1 active / 4 stale** (1 active = the OTGE grant-ratio anomaly [111675017](https://app.datadoghq.com/monitors/111675017) reading Alert on prod, Slack-routed, no page; 4 stale = incident.io orphans carried from prior weeks).

_Priority = monitor severity/routing (High/Low); Warn/Alert = the level a fire actually crossed — the two are independent. This week shows both: the High-priority HPA crossed only Warn (\~81% vs its > 90% Alert bound), while the High-priority OOM crossed Alert (OOM ratio ≥ 33%)._

## Incidents (15 minutes)

### Production Incidents — Customer Impact

No production incidents this week (incident.io `incident_list` for the team = 0). Carry-overs still tracked (no live incident): the quick-reply dead-button frontend bug (INC-2824, [312932032](https://app.datadoghq.com/monitors/312932032), fix incomplete) and the Anthropic-quota fragility (INC-2795 class, [309355473](https://app.datadoghq.com/monitors/309355473), OK).

### Operational Incidents — Deploys / Data Repairs / Infra

No operational incidents this week (0 in incident.io for the team).

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

| Alert | Priority | Service | On-call | Agent Finding |
| --- | --- | --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | <custom data-type="status" data-id="id-0">High</custom> | job-user-setup-user-first-mile-calc-processor | Alfred | **TL;DR:** The first-mile-calc HPA crossed its Warn level (\~81% of max replicas) three times this week on production-eks-cluster — Wed \~9:53 AM PT, Wed \~8:23 PM PT, and Thu \~4:23 PM PT; Alfred acked all three and each self-resolved in \~9–14 min, no customer impact. **What happened:** _Observed_ — High-priority monitor 135119948 (routes `@pagerduty-Activation-Alerts` + `@webhook-incidentio-high` inside its prod block) fired at **Warn** three times on **prod** (cluster `production-eks-cluster`, env from query scope `cluster_flavor:prod`; Alert bound is > 90%): (1) 2026-08-26 16:53 UTC (\~9:53 AM PT Wed, working hours) — \~80.7%, acked by Alfred \~30 s, resolved 17:07 UTC (\~14 min); (2) 2026-08-27 03:23 UTC (\~8:23 PM PT Wed, late evening) — \~80.7%, acked by Alfred \~10 s, resolved 03:32 UTC (\~9 min); (3) 2026-08-27 23:23 UTC (\~4:23 PM PT Thu, working hours) — 81.333%, acked by Alfred \~21 s, resolved 23:32 UTC (\~9 min). No incident promoted; monitor now OK. _Likely cause_ — brief autoscaling headroom pressure that scaling absorbed, consistent with the chronic HPA-saturation pattern on this job. Three self-resolving Warn pages (one late-evening) reinforce the HIGH → LOW routing recommendation below. |
| [133647340](https://app.datadoghq.com/monitors/133647340) — OOM: too many containers terminated | <custom data-type="status" data-id="id-1">High</custom> | job-user-user-activation-processor | Alfred | **TL;DR:** The Activation OOM monitor fired at Alert on the **dev** cluster (dev-eks-cluster) Thu \~1:52 PM PT and — because its High page handles were unconditional at the time — **paged prod on-call**; Alfred acked in \~14 s and it self-resolved in \~9 min, no prod or customer impact. Its routing was then **fixed \~5:29 PM PT Thu** (handles moved inside the prod block), so future dev-eks OOMs will not page prod. **What happened:** _Observed_ — High-priority monitor 133647340 (OOM-killed / running container ratio ≥ 33%, no env scope in the query) crossed **Alert**: (1) 2026-08-27 20:52 UTC (\~1:52 PM PT Thu, working hours) on the **dev** cluster `dev-eks-cluster` — acked by Alfred \~14 s (escalation 01M12FY4…), resolved 21:01 UTC (\~9 min). At that time the `@pagerduty-Activation-Alerts` + `@webhook-incidentio-high` handles sat outside the cluster conditionals (the prod `is_match` block was empty), so a dev-cluster OOM paged prod on-call High. A monitor-config change at **2026-08-28 00:29 UTC** (confirmed via Datadog monitor-audit event; modified by Jesus Hernandez) moved those handles **inside** the prod `is_match` block — the strongly-recommended fix landing (now <custom data-type="status" data-id="id-2">applied</custom>; see Tuning Recommendations). Datadog reads OK; no incident. _Likely cause_ — a dev-cluster OOM-kill (memory pressure / a dev deploy), not a prod problem. Prod not affected. |

### Auto-Resolved — Escalation Cancelled

No alerts auto-resolved this week — all four alerts were acked by Alfred, none auto-cancelled.

### Recurring / Flappy Alerts — Monitor Tuning Candidates

| Alert | Times Fired | Notes |
| --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | 3 this week (all Warn, prod, acked Alfred — 2 working-hours + 1 late-evening \~8:23 PM PT Wed) | Recurring across weeks (weeks_seen 8); autoscaling absorbs it, yet a Warn pages like a critical page → route HIGH → LOW (see Tuning Recommendations). |
| [133647340](https://app.datadoghq.com/monitors/133647340) — Activation OOM (dev-eks) | 1 this week (Alert, dev-eks-cluster, Thu \~1:52 PM PT; paged prod on-call, acked Alfred) | The dev-leak fired again in-week (also paged prod Sun + Tue of the closing week Aug 18–25). **Routing fixed 2026-08-28 00:29 UTC** — page handles now gated inside the prod `is_match` block, so a dev-eks OOM no longer pages prod (now <custom data-type="status" data-id="id-3">applied</custom>; outcome watch). |
| [137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) — Activation SQS backlog cluster | Dozens this week (Datadog-only; 0 incident.io pages) | Flapped repeatedly through Fri business hours — the team's Datadog `source:alert` firehose (211 transition events in the window) is dominated by these; each Warn (> 60 s) / Trigger (> 90 s) self-clears within minutes and pages nobody. → add `env:prod` + a 10–15 min sustain (see Tuning Recommendations). |
| [111675017](https://app.datadoghq.com/monitors/111675017) — OTGE "acting strange" anomaly | Firing now (Alert since 2026-08-28 13:20 UTC; Slack-routed) | New this run — prod anomaly (grant ratio > 5σ below predicted, last 2 h); routes `@slack-alerts-activation` only (no page). Possibly a downstream echo of the Activation volume drop; investigate (see Open Going Into Handoff). |

_Other standing candidates (0 fires this week) — the P5-over-routed cron_ [_313314019_](https://app.datadoghq.com/monitors/313314019) _/ svc-mark-tech_ [_301972958_](https://app.datadoghq.com/monitors/301972958)_, the unrouted OTGE readiness monitor_ [_111957816_](https://app.datadoghq.com/monitors/111957816)_, and the latency-blip monitors — are tracked in the_ [_Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577)_._

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM (+ sibling [133647342](https://app.datadoghq.com/monitors/133647342) mem-util) | Activation dev-leak: a dev-eks OOM paged prod on-call High because the page handles were unconditional | **Config change DETECTED this run.** Fired again Thu Aug 27 \~1:52 PM PT on dev-eks (paged prod, acked Alfred \~14 s); then at **2026-08-28 00:29 UTC** the handles were moved into the prod `is_match` block (Datadog audit event, by Jesus Hernandez). weeks_seen 4; 133647342 mem-util still a stale dev-eks orphan | **ACHIEVED — handles now prod-gated (before:** `@pagerduty-Activation-Alerts` **+** `@webhook-incidentio-high` **outside all conditionals → after: inside the prod** `is_match` **block).** Remaining: the query still has no env scope, so the monitor still enters Alert on dev (no page now); optionally add `cluster_flavor:prod`. Also clear the stale mem-util 133647342 dev-eks orphan + scope out dev. Coverage: prod OOM still pages High. | high (observed diff + audit event) | <custom data-type="status" data-id="id-4">applied</custom> |
| [143509449](https://app.datadoghq.com/monitors/143509449) — funnel-cashout expirations low | Real, sustained-low expiration drop that paged High overnight — a threshold change was applied at the Aug 25 handoff | 10 fires the prior full week (Aug 18–25; 9 acked / 1 auto-cancel); `FunnelCashoutExpired` \~1–13/hr (re-grounded today); config `< 5` → `< 2` confirmed live again today; **0 fires this week** (\~3.0 days in — outcome watch continues); weeks_seen 2 | **Applied (threshold 5 → 2).** Reduces overnight paging but does not resolve the underlying drop. Still needed: investigate the throughput drop + retrigger cronjob; if benign low-volume, a min-volume / time-of-day guard is cleaner than a bare threshold. Coverage: a real funnel-cashout outage still pages. **Watching whether the new threshold holds the pages down across the full week.** | high (observed diff) | <custom data-type="status" data-id="id-5">applied</custom> |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~21 days (Aug 7 cliff); Thu-eve surge to \~102–122/hr then back to \~7–66/hr, troughs \~1–20/hr, vs pre-cliff weekday \~110–198/hr (re-grounded today); weeks_seen 4; monitor quiet (model adapting) | **Do NOT tune → investigate.** before: monitor unchanged. after: investigate via the Activation runbook (`kem-tug-987`); rule out an Aug 7 \~15:00 UTC deploy/instrumentation change vs a demand regression; open a Jira fix. Coverage: monitor unchanged. | high | <custom data-type="status" data-id="id-6">strongly recommend</custom> |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; a Warn pages like a critical page — including outside working hours | Chronic (weeks_seen 8); fired **3× this wk** (all Warn \~80.7–81.3%, prod, acked Alfred — 2 working-hours + 1 late-evening \~8:23 PM PT Wed); config unchanged (re-verified today) | **Route HIGH → LOW / gate to critical.** before: util `> 90` Alert / \~80 Warn → `@webhook-incidentio-high`. after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | <custom data-type="status" data-id="id-7">strongly recommend</custom> |
| [137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650) — SQS backlog cluster | Flappy backlog, no env scope / no sustain (Datadog-only noise; 0 incident.io pages) | Flapped heavily this week — the 211 team `source:alert` events are dominated by these; each Warn/Trigger self-clears in \~2–4 min; 0 pages; weeks_seen 8 / 7 / 7 | **Add scope + sustain; verify routing.** before: SQS oldest-age > 90 s Alert, `last_5m`, no env scope, no sustain. after: add `env:prod` + a sustain ≥ 10–15 min (self-clears in \~2–4 min); verify the prod routing branch actually resolves (0 pages across all Alert crossings suggests it does not). Coverage: a sustained real backlog still alerts. | med | <custom data-type="status" data-id="id-8">recommend</custom> |

_Top 5 by expected impact; **full history (21 rows) →**_ [_Monitor Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577)_. Feedback loop (today): all 11 diffable monitors re-read. **Two applied changes now on the books:** funnel-expirations 143509449 remains at the applied threshold_ `< 2` _(confirmed live; 0 fires this week, outcome watch continues), and — new this run — the Activation OOM 133647340 page routing was fixed at 2026-08-28 00:29 UTC (handles moved inside the prod_ `is_match` _block; confirmed via Datadog audit event), so a dev-eks OOM will no longer page prod on-call (outcome watch begins). The remaining 9 configs match their recorded before-state — no regression. The Ledger is updated this run to record the OOM applied change;_ `weeks_seen` _next rolls at the Sep 1 handoff, when this week's HPA (×3) and OOM (×1) fires fold in._

### 🔴 Open Going Into Handoff

**Active Datadog Alert/Warn now: 1.** [111675017](https://app.datadoghq.com/monitors/111675017) — "One Time Granted Earnings is acting strange!" — reads **Alert** (Triggered 2026-08-28 13:20 UTC / \~6:20 AM PT), `env:prod`, routes `@slack-alerts-activation` (Slack-only, no page, no incident). The OTGE grant ratio is > 5σ below its predicted value over the last 2 h — a real active prod anomaly (advisory). It may be a downstream echo of the broader Activation volume drop (first-cashout / funnel-expirations); **cause not determined from available signals.** Separately, the first-mile SQS backlog monitor [137629294](https://app.datadoghq.com/monitors/137629294) is flapping today (Warn/OK every few minutes; OK at the snapshot), non-paging — tracked under Tuning.

**Stale / lingering incident.io alerts (need a manual clear, not active prod work): 4** (carried from prior weeks, verified still-firing today):

* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High, since 2026-06-03; Datadog No Data. Code bug → Jira + clear.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low, since 2026-07-23; same bug.
* Activation mem-util ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks group since 2026-05-29; Datadog OK on prod. Dev-scope leak → scope out dev + clear.
* Databricks "Promotions Metrics Processor Job Failed" — High, since 2025-12-17; no live Datadog monitor. Verify job + clear.

**1 active prod anomaly (OTGE, Slack-routed) + 4 stale incident.io alert(s) to clear** — plus the real carry-in work: the first-cashout + funnel-expiration drops, the quick-reply frontend bug, and the P5→High over-routing on the cron / svc-mark-tech monitors. (The dev-eks OOM leak that paged prod is now routing-fixed — verify over the coming week.)

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** 17 open (<custom data-type="status" data-id="id-9">1 Critical</custom> / <custom data-type="status" data-id="id-10">16 High</custom>) via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) — **down 1 from the Thursday count (18)** (WEBPLAT-1514 brace-expansion left the filter). The single Critical is SAST `EBBUD-3697` (OS-command injection, To Do). The 16 Highs are mostly transitive SCA dependency bumps (`js-yaml`, `nanoid`, `postcss`, `brace-expansion`, `fast-uri`, `ddtrace`, jackson) across ACT / KMONO / WEBPLAT / SV / MOBPLAT / ECD, plus 1 SAST High (`CXP-1998` file-path). Closest to Growth is `ACT-2563` (Datadog.Trace bump in Activation, In Review). Severity is read from the ticket summary prefix (the Jira priority field is uniformly "Low"). **org-wide** scope (no Growth-owned ticket). Volatile intraday — the count has swung 10 → 25 → 18 → 17 over recent days.

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

- [ ] **Escalate the first-cashout volume drop** (\~21 days below baseline) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); check the Aug 7 \~15:00 UTC cliff (deploy vs demand); open a Jira fix. Note a Thu-eve surge to \~122/hr but troughs still \~1–20/hr. Do NOT tune the monitor.
- [ ] **Investigate the funnel-cashout-expiration drop** ([143509449](https://app.datadoghq.com/monitors/143509449)): check the retrigger-funnel-cashout cronjob + tie to the first-cashout decline. Threshold was tightened `< 5` → `< 2` (applied) — verify it does not mask a real outage; prefer a min-volume/time-of-day guard.
- [ ] **Activation OOM routing — now applied** ([133647340](https://app.datadoghq.com/monitors/133647340)): handles gated to prod at 2026-08-28 00:29 UTC. Verify no dev-eks OOM pages prod over the coming week; optionally add `cluster_flavor:prod` to the query so it no longer even enters Alert on dev; clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342) + scope out dev.
- [ ] **Tune HPA**[135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate to critical-only); keep OOM / pod-not-ready at HIGH. (Fired 3× this week — Warn \~80.7–81.3% on prod, incl. a late-evening page \~8:23 PM PT Wed, all acked Alfred.)
- [ ] **Investigate the OTGE grant-ratio anomaly** firing now ([111675017](https://app.datadoghq.com/monitors/111675017)): > 5σ below predicted (last 2 h), `env:prod`, Slack-routed. Likely tied to the Activation volume decline; confirm and, if chronic, verify routing/sensitivity.
- [ ] **Ship the quick-reply routing fix** (INC-2824; [312932032](https://app.datadoghq.com/monitors/312932032); fix incomplete). Real dead button → frontend Jira, not tuning.
- [ ] **Fix the P5→High over-routing** on the cron ([313314019](https://app.datadoghq.com/monitors/313314019)) and svc-mark-tech ([301972958](https://app.datadoghq.com/monitors/301972958)) baseline monitors; confirm Growth ownership of svc-mark-tech.
- [ ] **Add durable Anthropic-quota protection** for svc-conversational-onboarding (INC-2795 class; [309355473](https://app.datadoghq.com/monitors/309355473)).
- [ ] **Verify OTGE readiness monitor routing** ([111957816](https://app.datadoghq.com/monitors/111957816)): fired \~49 min in prod prior weeks with no handles — add a page/Slack handle.
- [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582)) and clear the 2 stale alerts once shipped.
- [ ] Tune the Activation SQS backlog cluster ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650)): add `env:prod` + a 10–15 min sustain; verify routing (flapped heavily this week, 0 pages).
- [ ] Verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (\~8 months).
- [ ] Review open vulnerability tickets — 17 open (1 Critical / 16 High), org-wide (down 1 from 18).

## 📝 Manual Notes (preserved across refreshes)

_Add notes here; they survive daily refreshes._

---

_Generated by the Growth Team Ops Review agent. Window: 2026-08-25 11:00 → 2026-09-01 11:00 America/Mexico_City (week-to-date, \~72 h in; live, refreshed daily until it freezes at the Sep 1 handoff). Last refreshed: 2026-08-28 10:04 AM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities) — all connectors healthy. Customer identifiers redacted where present (none required this run). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent._