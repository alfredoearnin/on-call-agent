🔄 **Live page** — refreshed daily during the on-call week (2026-09-08 → 2026-09-15). Last refreshed **2026-09-12 10:01 AM PT (America/Los_Angeles)** (\~4 days / 96 h into the week). This page freezes at the Tuesday handoff (2026-09-15 11:00 America/Mexico_City); a new page opens for the next week.

🔴 **Carry-in from the week just closed — watch these.** (1) **First-cashout volume drop** [17131362](https://app.datadoghq.com/monitors/17131362) — the Aug 7 \~15:00 UTC cliff persists (\~35 days); reads OK only because the anomaly model adapted (quiet ≠ recovered). Real signal — do NOT tune → Activation runbook `kem-tug-987` + Jira. (2) **Funnel-cashout expirations low** [143509449](https://app.datadoghq.com/monitors/143509449) — fired 2× this week (High, acked) at the tightened `< 2` threshold; the Sep 10 fire is still open as a stale incident.io alert (Datadog No Data). The real drop persists → Jira / throughput fix, do NOT tune further. Prior week (Sep 1 → Sep 8) closed at **34 records** (14 High / 20 Low), all resolved, 0 incidents.

# Growth Team Ops Review — Weekly Handoff

**09/12/2026 Growth Team Ops Review** · On-call week **2026-09-08 11:00 → 2026-09-15 11:00** (America/Mexico_City) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-09-12 10:01 AM PT** (week-to-date, \~4 days in; live, refreshed daily).

_This on-call week — primary: **Edder Núñez**; secondary: **shashank** (shift Tue Sep 8 → Tue Sep 15; verified live via_ `schedule_show`_). Next handoff Sep 15: primary **Nabi**, secondary **Ankur Shivani**._

_Coverage check: could not be completed (no Slack profile-read tool available under either name) — verify availability manually._

## SLOs / SLAs (15 minutes)

* [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
* [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
* [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — week-to-date (\~4 days in):** **17 records** (8 High, 9 Low) — 16 resolved, 1 still firing (a stale funnel-cashout alert, Datadog No Data); no new alerts since Sep 11 \~9:25 AM PT (a quiet day 4). | **Prior full week (Sep 1 → Sep 8):** 34 records (14 High, 20 Low), all resolved, 0 incidents. | **Trend: ↓ (lighter)** — 17 records in the first \~4 days vs **25** in the prior week's same 4-day slice; run-rate \~30/wk (the prior full week's 34 was front-loaded — all 25 of the same-slice landed by day 3 — so the same-slice comparison is the fair read). **Human-attention: 11 | Auto-resolved: 6.** **Escalation rate (alerts → incidents): 0/17 (0%).** **Still firing: 0 active / 5 stale** (incident.io) — no Growth monitor reads Alert/Warn now; the 5 stale are 4 old orphans plus the Sep 10 lingering funnel-cashout alert (below).

_Priority = monitor severity/routing (High/Low); Warn/Alert = the level a fire actually crossed — the two are independent. A High-priority monitor can fire only at Warn._

## Incidents (15 minutes)

### Production Incidents — Customer Impact

No production incidents this week (incident.io `incident_list` for the team = 0). Carry-overs still tracked (no live incident): the quick-reply dead-button frontend bug (INC-2824, [312932032](https://app.datadoghq.com/monitors/312932032)) and the Anthropic-quota fragility (INC-2795 class, [309355473](https://app.datadoghq.com/monitors/309355473), OK).

### Operational Incidents — Deploys / Data Repairs / Infra

No operational incidents this week (0 in incident.io for the team).

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

| Alert | Priority | Service | On-call | Agent Finding |
| --- | --- | --- | --- | --- |
| [301972958](https://app.datadoghq.com/monitors/301972958) — svc-mark-tech Request duration too high | <custom data-type="status" data-id="id-0">High</custom> | svc-mark-tech | Edder Núñez | **TL;DR:** svc-mark-tech request-duration (p99) crossed its 10 s page 3× on Sep 8 evening PT (Datadog P5 events routed to incident.io High); Edder acked each in \~6–16 s and all self-resolved in \~4–10 min — no customer impact. **What happened:** Observed — monitor 301972958 (`percentile(last_1d):p99:trace.fastapi.request{service:svc-mark-tech} by {kube_cluster_name,env} > 10`, prod branch routes @webhook-incidentio-high) fired 3×: (1) 2026-09-09 03:15 UTC (\~8:15 PM PT Sep 8), acked \~15 s, resolved 03:19 UTC; (2) 2026-09-09 03:20 UTC (\~8:20 PM PT Sep 8), acked \~6 s, resolved 03:26 UTC; (3) 2026-09-09 04:14 UTC (\~9:14 PM PT Sep 8), acked \~16 s, resolved 04:24 UTC. Env prod (alert scope `env:prod,kube_cluster_name:production-eks-cluster`); monitor now OK. The title carries a Datadog `[P5]` tag yet routes High — the P5→High over-route theme. No new fires since Sep 8 evening. Cause not determined from available signals (brief p99 request-duration spikes that self-cleared). |
| [143509449](https://app.datadoghq.com/monitors/143509449) — Less than N Funnel Cashouts Expired | <custom data-type="status" data-id="id-1">High</custom> | job-cashout-user-cashout-status-processor | Edder Núñez | **TL;DR:** Funnel-cashout expirations dropped below the applied `< 2` threshold twice on Sep 9 PT (morning + night); Edder acked both in \~18–24 s — the first self-resolved in \~1 h, the second is still open as a stale incident.io alert (Datadog now No Data). No customer impact, but the underlying low-expiration signal is real (carry-in). **What happened:** Observed — monitor 143509449 (`sum(last_4h):…FunnelCashoutExpired… + …ProcessingFunnelExpirationEvent… < 2`, prod, routes Activation-Alerts + incidentio-high) fired: (1) 2026-09-09 12:25 UTC (\~5:25 AM PT Sep 9), acked 12:25:35 (\~24 s), resolved 13:26 UTC (\~1 h); (2) 2026-09-10 03:24 UTC (\~8:24 PM PT Sep 9), acked 03:24:29 (\~18 s), still firing in incident.io while the Datadog monitor reads No Data → classified stale (needs a manual clear). No new funnel fires since. Likely cause: the sustained low funnel-cashout-expiration volume tracked in the carry-in above (a real drop, not monitor noise) — investigate the retrigger-funnel-cashout cronjob per the runbook; do NOT tune further. |
| [135119948](https://app.datadoghq.com/monitors/135119948) — first-mile-calc HPA sustained high utilization | <custom data-type="status" data-id="id-2">Low</custom> | job-user-setup-user-first-mile-calc-processor | Edder Núñez / shashank | **TL;DR:** The first-mile-calc HPA hit sustained-high utilization (Warn/Low) 5× across the window; Edder acked three and shashank one, the fifth self-resolved with no ack — autoscaling absorbed each in \~7–25 min, no customer impact. **What happened:** Observed — monitor 135119948 (`avg(last_30m):(hpa.current/max)*100{…cluster_flavor:prod} > 90`; Warn branch routes @incidentio-low) fired 5× at Warn: (1) 2026-09-09 01:08 UTC (\~6:08 PM PT Sep 8), acked \~5 min (Edder), resolved 01:15 UTC; (2) 2026-09-10 04:33 UTC (\~9:33 PM PT Sep 9), acked \~56 s (Edder), resolved 04:43 UTC; (3) 2026-09-10 16:22 UTC (\~9:22 AM PT Sep 10), acked \~23 min (shashank), resolved 16:47 UTC; (4) 2026-09-11 04:38 UTC (\~9:38 PM PT Sep 10), acked \~2 min (Edder), resolved 04:47 UTC; (5) 2026-09-11 11:38 UTC (\~4:38 AM PT Sep 11), escalation cancelled (no ack, self-resolved), resolved 11:47 UTC. Env prod (production-eks-cluster); monitor now OK. Likely cause: short utilization bursts autoscaling absorbed — the chronic HPA-noise pattern (weeks_seen 10); recommend routing the sustained-utilization branch High→Low (below). |
| [243692163](https://app.datadoghq.com/monitors/243692163) — svc-notification-preferences high p90 latency | <custom data-type="status" data-id="id-3">High</custom> | svc-notification-preferences | Edder Núñez | **TL;DR:** svc-notification-preferences p90 latency crossed its `> 1 s` page 3× (Sep 9 night PT through Sep 10 evening PT); Edder acked two in seconds and the third — a \~1:36 AM PT night page — self-resolved with no ack; all cleared in \~9–15 min, no customer impact. **What happened:** Observed — monitor 243692163 (`avg(last_10m):p90:trace.aspnet_core.request{env:prod,service:svc-notification-preferences} > 1`, routes @webhook-incidentio-high) fired 3×: (1) 2026-09-09 08:36 UTC (\~1:36 AM PT Sep 9), escalation cancelled (no ack), self-resolved 08:46 UTC (\~10 min) — a High-routed page in sleeping hours nobody had to act on; (2) 2026-09-10 23:41 UTC (\~4:41 PM PT Sep 10), acked 23:41:18 (\~13 s), resolved 23:56 UTC; (3) 2026-09-11 04:41 UTC (\~9:41 PM PT Sep 10), acked 04:41:14 (\~9 s), resolved 04:50 UTC. Monitor now OK; the query has no sustain (single 10-min window). This week it rose to 3× → crosses the ≥ 3-fires noise bar. Likely cause: brief p90 latency blips (p90 baseline \~116 ms / 14 d, so `> 1 s` is \~8× normal) — a sustain guard would suppress this class. |

### Auto-Resolved — Escalation Cancelled

* **TL;DR:** [243692043](https://app.datadoghq.com/monitors/243692043) svc-notification-preferences average latency crossed its `> 0.7 s` Warn once at \~4:41 PM PT Sep 10 (alongside the p90 fire above); the escalation was cancelled with no ack and it self-resolved in \~14 min — no customer impact.

    **What happened:** Observed — monitor 243692043 (`avg(last_10m):avg:trace.aspnet_core.request{env:prod,service:svc-notification-preferences} > 0.7`, routes @webhook-incidentio-low) fired 2026-09-10 23:41 UTC, resolved 23:55 UTC; escalation cancelled (no ack). The Low sibling of the p90 monitor above; a correlated latency blip. Consider consolidating the pair.


* **TL;DR:** [142140455](https://app.datadoghq.com/monitors/142140455) the cashout-status processor's SQS receive average-duration crossed `> 140 s` twice on Sep 11 (early + late morning PT); both escalations were cancelled with no ack and self-resolved in \~3 min — no customer impact.

    **What happened:** Observed — monitor 142140455 (`avg(last_5m):avg:trace.amazonsqs.receive.duration{env:prod, service:job-cashout-user-cashout-status-processor} > 140`, routes @webhook-incidentio-low) fired: (1) 2026-09-11 11:16 UTC (\~4:16 AM PT), resolved 11:19 UTC; (2) 2026-09-11 16:25 UTC (\~9:25 AM PT), resolved 16:28 UTC. Both cancelled (no ack). Brief SQS receive-duration blips, no sustain (`last_5m`) — new noise this week (ledger weeks_seen 2).


* **TL;DR:** [142140338](https://app.datadoghq.com/monitors/142140338) the cashout-status processor's SQS receive p90 latency crossed `> 20 s` once at \~9:25 AM PT Sep 11 (alongside the avg-duration fire above); the escalation was cancelled with no ack and it self-resolved in \~1 min — no customer impact.

    **What happened:** Observed — monitor 142140338 (`percentile(last_5m):p90:trace.amazonsqs.receive{env:prod, service:job-cashout-user-cashout-status-processor} > 20`, routes @webhook-incidentio-low) fired 2026-09-11 16:25 UTC, resolved 16:26 UTC; cancelled (no ack). Correlated with 142140455 above (same SQS receive-latency blip). New tuning candidate this week (first seen) — will be added to the ledger at the Sep 15 roll.



### Recurring / Flappy Alerts — Monitor Tuning Candidates

| Alert | Times Fired | Notes |
| --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — first-mile-calc HPA sustained high utilization | 5× (Sep 8–11) | Chronic HPA flapper (all Warn/Low this week; weeks_seen 10). Route the sustained-utilization branch High→Low; keep OOM / pod-not-ready at High. See the tuning table + Action Items. |
| [301972958](https://app.datadoghq.com/monitors/301972958) — svc-mark-tech Request duration too high | 3× (all Sep 8 evening PT) | P5→High over-route: fired 3× overnight, all fast-acked and self-resolved in minutes. Route the prod branch to Low or require ≥ 2 sustained / ≥ N consecutive windows. Ledger weeks_seen 7 (→ 8 at the Sep 15 roll); see Action Items. |
| [243692163](https://app.datadoghq.com/monitors/243692163) — svc-notification-preferences high p90 latency | 3× (Sep 9–11) | New this week it crosses the ≥ 3-fires bar (2 acked + a \~1:36 AM PT night page, cancelled). Add a sustain / duration guard (keep the `> 1 s` bound; p90 baseline \~116 ms/14 d). weeks_seen 4; see Action Items. |
| [143509449](https://app.datadoghq.com/monitors/143509449) — Less than N Funnel Cashouts Expired | 2× (both Sep 9 PT) | Real low-volume drop, not monitor noise — fires at the applied `< 2` threshold; the Sep 10 fire is still open (stale). Do NOT tune further; investigate throughput / the retrigger-funnel-cashout cronjob. weeks_seen 4. |
| [142140455](https://app.datadoghq.com/monitors/142140455) — job-cashout Processor average duration > 140 s | 2× (both Sep 11 PT) | Auto-resolved SQS receive-duration blips (Low, no ack); its p90 sibling [142140338](https://app.datadoghq.com/monitors/142140338) fired 1× at the same moment. Add a sustain (≥ 2 consecutive windows) so a 4–5 min blip does not alert. weeks_seen 2 (142140338 new). |

_Five monitors fired multiple times this week (HPA_ `135119948` _×5, svc-mark-tech_ `301972958` _×3, svc-notif p90_ `243692163` _×3, funnel_ `143509449` _×2, job-cashout receive-duration_ `142140455` _×2). Full history lives in the_ [_Monitor Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577) _and the recommendations below._

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; High/Alert pages for a self-resolving condition, incl. outside working hours | Chronic (weeks_seen 10); fired 5× this week at Warn/Low (4 acked + 1 no-ack; incl. \~9:22 AM & \~9:38 PM & \~4:38 AM PT); monitor OK | **Route HIGH → LOW / gate to critical.** before: util `> 90` Alert / \~80 Warn → `@webhook-incidentio-high`. after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | <custom data-type="status" data-id="id-4">strongly recommend</custom> |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~35 days (Aug 7 cliff); weeks_seen 5; monitor quiet (model adapting) | **Do NOT tune → investigate.** before: monitor unchanged. after: investigate via the Activation runbook (`kem-tug-987`); rule out an Aug 7 \~15:00 UTC deploy/instrumentation change vs a demand regression; open a Jira fix. Coverage: monitor unchanged. | high | <custom data-type="status" data-id="id-5">strongly recommend</custom> |
| [143509449](https://app.datadoghq.com/monitors/143509449) — funnel-cashout expirations low | Real, sustained-low expiration drop that pages High — threshold change applied at the Aug 25 handoff | Threshold `< 5` → `< 2` (applied, re-confirmed live); fired 2× this week at `< 2` (the Sep 10 fire still open/stale) + 4× the prior week; weeks_seen 4; the drop persists | **Applied (threshold 5 → 2).** Cut paging substantially, but the real drop persists. Still needed: investigate throughput + the retrigger-funnel-cashout cronjob; prefer a time-of-day / min-volume guard. Coverage: a real funnel-cashout outage still pages High. | high (observed diff) | <custom data-type="status" data-id="id-6">applied</custom> |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM (+ sibling [133647342](https://app.datadoghq.com/monitors/133647342) mem-util) | Activation dev-leak: a dev-eks OOM paged prod on-call High because the page handles were unconditional | Routing fixed 2026-08-28 (handles inside the prod `is_match` block; re-confirmed live); weeks_seen 5; 0 OOM this week — no post-fix dev-eks OOM yet to validate | **ACHIEVED — handles prod-gated.** Remaining: query still has no env scope (still enters Alert on dev, no page); optionally add `cluster_flavor:prod`; clear the stale mem-util 133647342 dev-eks orphan + scope out dev. Coverage: prod OOM still pages High. | high (observed diff + audit) | <custom data-type="status" data-id="id-7">applied</custom> |
| [137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650) — SQS backlog cluster | Flappy backlog, no env scope / no sustain (Datadog-only noise; 0 incident.io pages) | No incident.io pages this week; weeks_seen 9 / 8 / 8 | **Add scope + sustain; verify routing.** before: SQS oldest-age `> 90–150 s` Alert, `last_5m`, no env scope, no sustain. after: add `env:prod` + a sustain ≥ 10–15 min; verify the prod routing branch actually resolves. Coverage: a sustained real backlog still alerts. | med | <custom data-type="status" data-id="id-8">recommend</custom> |

_Top 5 by expected impact; **full history (25 rows) →**_ [_Monitor Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577)_. Standing, learned recommendations carried into the week — they persist until applied. This week's noisiest were the_ **HPA flapper** _(_`135119948` _×5) and the_ **svc-mark-tech P5 → High over-route** _(_`301972958` _×3); the_ **svc-notif p90** _pair (_`243692163` _×3) newly crossed the ≥ 3-fires bar — see Action Items._

### 🔴 Open Going Into the Week

**Active — Datadog Alert/Warn now: 0.** No Growth monitors read Alert/Warn (verified via `search_datadog_monitors team:l2-peng-growth status:(alert OR warn)` — none).

**Stale / lingering incident.io alerts (need a manual clear, not active prod work): 5** (all confirmed still-firing via `alert_stats/alert_list status:firing` and absent from the current Datadog Alert/Warn set):

* **New this week —** Funnel-cashout expirations low ([143509449](https://app.datadoghq.com/monitors/143509449)) — High, since 2026-09-10 03:24 UTC; Datadog No Data. The Sep 10 fire was acked but never resolved; tied to the real funnel-cashout drop (carry-in) — investigate + clear once the drop is addressed.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High, since 2026-06-03; Datadog No Data. Code bug → Jira + clear.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low, since 2026-07-23; same bug.
* Activation mem-util ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks group since 2026-05-29; Datadog OK on prod. Dev-scope leak → scope out dev + clear.
* Databricks "Promotions Metrics Processor Job Failed" — High, since 2025-12-17; no live Datadog monitor. Verify job + clear.

**No active prod issue; 0 active / 5 stale incident.io alert(s) to clear** — plus the carry-in cashout-volume signals above to keep watching.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** 13 open (<custom data-type="status" data-id="id-9">6 Critical</custom> / <custom data-type="status" data-id="id-10">7 High</custom>) via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) (org-wide, as of this refresh; unchanged from the Sep 11 refresh at 13). 6 Critical: 5 `tomcat-embed-core` SCA bumps (`KMONO-60`, `KMONO-61`, `EBBUD-3777`, `EBBUD-3778`, `EBBUD-3779`) and a `io.netty:netty-handler` SCA (`KMONO-63`). 7 High: SAST anti-forgery-token (PayRouter `QAMRE-1920`, EarninCard `QAMRE-1919`, Bank `QAMRE-1970`, Offers `QAMRE-1969`) + SAST log-leakage (`MOBPLAT-4684`) + SCA bumps (`tar` `MOBPLAT-4682`, `netty-codec-http` `KMONO-59`). Severity from the ticket summary prefix (Jira priority field uniformly "Low"). **org-wide** scope (no Growth-owned ticket). _Count is volatile intraday._

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

- [ ] **Escalate the first-cashout volume drop** (\~35 days below baseline) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); check the Aug 7 \~15:00 UTC cliff (deploy vs demand); open a Jira fix. Do NOT tune the monitor.
- [ ] **Investigate the funnel-cashout-expiration drop** ([143509449](https://app.datadoghq.com/monitors/143509449)): fired 2× this week at the applied `< 2` threshold and the Sep 10 fire is still open (stale) — clear it, check the retrigger-funnel-cashout cronjob, and tie to the first-cashout decline; prefer a min-volume / time-of-day guard.
- [ ] **Tune HPA** [135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate to critical-only); keep OOM / pod-not-ready at HIGH. Fired 5× this week (all Warn/Low); chronic (weeks_seen 10).
- [ ] **Fix the svc-mark-tech P5 → High over-routing** (request-duration [301972958](https://app.datadoghq.com/monitors/301972958) ×3 High this week; cron [313314019](https://app.datadoghq.com/monitors/313314019)): route the prod branch to Low or require ≥ 2 sustained / ≥ N consecutive windows; confirm Growth ownership of svc-mark-tech.
- [ ] **Add a sustain to the svc-notification-preferences latency pair** ([243692163](https://app.datadoghq.com/monitors/243692163) p90 High / [243692043](https://app.datadoghq.com/monitors/243692043) avg Low): p90 fired 3× this week (crosses the ≥ 3-fires bar; incl. a \~1:36 AM PT night page); keep the bounds (p90 baseline \~116 ms/14 d), require ≥ 2 consecutive windows; consider consolidating the two.
- [ ] **Verify the Activation OOM routing fix holds** ([133647340](https://app.datadoghq.com/monitors/133647340)): handles gated to prod (2026-08-28, re-confirmed). Confirm no dev-eks OOM pages prod; optionally add `cluster_flavor:prod`; clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342).
- [ ] **Tune the Activation SQS backlog cluster** ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650)): add `env:prod` + a 10–15 min sustain; verify routing (Datadog-only, 0 incident.io pages).
- [ ] **Add a sustain to the job-cashout SQS receive-latency pair** ([142140455](https://app.datadoghq.com/monitors/142140455) avg-duration ×2 / [142140338](https://app.datadoghq.com/monitors/142140338) p90 ×1, both Low, auto-resolved no-ack on Sep 11): require ≥ 2 consecutive windows so a 4–5 min blip does not alert; keep Low.
- [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582)) and clear the 2 stale alerts once shipped.
- [ ] Verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (\~9 months).
- [ ] Review open vulnerability tickets — 13 open (6 Critical / 7 High), org-wide; the 5 `tomcat-embed-core` + `netty-handler` (`KMONO-63`) Criticals lead.

## 📝 Manual Notes (preserved across refreshes)

_Add notes here; they survive daily refreshes._

---

_Generated by the Growth Team Ops Review agent. Window: 2026-09-08 11:00 → 2026-09-15 11:00 America/Mexico_City (week-to-date, \~4 days in; live, refreshed daily until it freezes at the Sep 15 handoff). Last refreshed: 2026-09-12 10:01 AM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities) — all connectors healthy. Customer identifiers redacted where present (none required this run). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent._