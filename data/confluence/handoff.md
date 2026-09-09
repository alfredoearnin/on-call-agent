🔄 **Live page** — refreshed daily during the on-call week (2026-09-08 → 2026-09-15). Last refreshed **2026-09-09 10:03 AM PT (America/Los_Angeles)** (\~1 day / 24 h into the week). This page freezes at the Tuesday handoff (2026-09-15 11:00 America/Mexico_City); a new page opens for the next week.

🔴 **Carry-in from the week just closed — watch these.** (1) **First-cashout volume drop** [17131362](https://app.datadoghq.com/monitors/17131362) — the Aug 7 \~15:00 UTC cliff persists (\~33 days); reads OK only because the anomaly model adapted (quiet ≠ recovered). Real signal — do NOT tune → Activation runbook `kem-tug-987` + Jira. (2) **Funnel-cashout expirations low** [143509449](https://app.datadoghq.com/monitors/143509449) — fired again this week (High, acked) at the tightened `< 2` threshold; the real drop persists → Jira / throughput fix, do NOT tune further. Prior week (Sep 1 → Sep 8) closed at **34 records** (14 High / 20 Low), all resolved, 0 incidents.

# Growth Team Ops Review — Weekly Handoff

**09/09/2026 Growth Team Ops Review** · On-call week **2026-09-08 11:00 → 2026-09-15 11:00** (America/Mexico_City) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-09-09 10:03 AM PT** (week-to-date, \~1 day in; live, refreshed daily).

_This on-call week — primary: **Edder Núñez**; secondary: **shashank** (shift Tue Sep 8 → Tue Sep 15; verified live via_ `schedule_show`_). Next handoff Sep 15: primary **shashank**, secondary **Nabi**._

_Coverage check: could not be completed (no Slack profile-read tool available under either name) — verify availability manually._

## SLOs / SLAs (15 minutes)

* [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
* [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
* [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — week-to-date (\~1 day in):** **6 records** (5 High, 1 Low), all resolved. | **Prior full week (Sep 1 → Sep 8):** 34 records (14 High, 20 Low), all resolved, 0 incidents. | **Trend: ≈ flat (→)** — 6 in the first \~24 h vs **6** in the prior week's same 24 h slice; the naive run-rate (\~42/wk) overshoots the prior 34 but is unreliable this early. **Human-attention: 5 | Auto-resolved: 1.** **Escalation rate (alerts → incidents): 0/6 (0%).** **Still firing: 0 active / 4 stale** (incident.io) — no Growth monitor reads Alert/Warn now; the 4 stale are old orphans (below).

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
| [301972958](https://app.datadoghq.com/monitors/301972958) — svc-mark-tech Request duration too high | <custom data-type="status" data-id="id-0">High</custom> | svc-mark-tech | Edder Núñez | **TL;DR:** svc-mark-tech request-duration (p99) crossed its 10 s page 3× overnight Sep 8 (Datadog P5 events routed to incident.io High); Edder acked each in \~6–16 s and all self-resolved in \~4–10 min — no customer impact. **What happened:** Observed — monitor 301972958 (`percentile(last_1d):p99:trace.fastapi.request{service:svc-mark-tech} > 10`, prod, routes @webhook-incidentio-high) fired 3×: (1) 2026-09-09 03:15 UTC (\~8:15 PM PT Sep 8), acked \~15 s, resolved 03:19 UTC; (2) 2026-09-09 03:20 UTC (\~8:20 PM PT), acked \~6 s, resolved 03:26 UTC; (3) 2026-09-09 04:14 UTC (\~9:14 PM PT), acked \~16 s, resolved 04:24 UTC. Env prod (`kube_cluster_name:production-eks-cluster`); monitor now OK. The title carries a Datadog `[P5]` tag yet routes High — the P5→High over-route theme. Likely cause: brief p99 request-duration spikes that self-cleared; a deeper cause is not determined from available signals. |
| [143509449](https://app.datadoghq.com/monitors/143509449) — Less than N Funnel Cashouts Expired | <custom data-type="status" data-id="id-1">High</custom> | job-cashout-user-cashout-status-processor | Edder Núñez | **TL;DR:** Funnel-cashout expirations dropped below the tightened `< 2` threshold once on Sep 9 morning; Edder acked in \~24 s and it self-resolved in \~1 h — no customer impact, but the underlying low-expiration signal is real (carry-in). **What happened:** Observed — monitor 143509449 (`sum(last_4h):…FunnelCashoutExpired… < 2`, prod, routes Activation-Alerts + incidentio-high) fired 2026-09-09 12:25 UTC (\~5:25 AM PT), acked 12:25:35 (\~24 s), resolved 13:26 UTC; monitor now OK. Likely cause: the sustained low funnel-cashout-expiration volume tracked in the carry-in above (a real drop, not monitor noise) — investigate the retrigger-funnel-cashout cronjob per the runbook; do NOT tune further. |
| [135119948](https://app.datadoghq.com/monitors/135119948) — first-mile-calc HPA sustained high utilization | <custom data-type="status" data-id="id-2">Low</custom> | job-user-setup-user-first-mile-calc-processor | Edder Núñez | **TL;DR:** The first-mile-calc HPA briefly hit sustained-high utilization (Warn/Low) Sep 8 evening; Edder acked in \~5 min and autoscaling self-resolved in \~7 min — no customer impact. **What happened:** Observed — monitor 135119948 (`avg(last_30m):(hpa.current/max)*100{…cluster_flavor:prod} > 90`; Warn branch routes @incidentio-low) fired 2026-09-09 01:08 UTC (\~6:08 PM PT Sep 8) at Warn, acked 01:13:28 (\~5 min), resolved 01:15 UTC. Env prod (production-eks-cluster); monitor now OK. Likely cause: a short utilization burst autoscaling absorbed — the chronic HPA-noise pattern (weeks_seen 10); recommend routing the sustained-utilization branch High→Low (below). |

### Auto-Resolved — Escalation Cancelled

* **TL;DR:** [243692163](https://app.datadoghq.com/monitors/243692163) svc-notification-preferences p90 latency crossed its `> 1 s` Warn once at \~1:36 AM PT Sep 9 (a High-routed page in sleeping hours); it self-resolved in \~10 min and the escalation was cancelled with no human ack — no customer impact.

    **What happened:** Observed — monitor 243692163 (`avg(last_10m):p90:trace.aspnet_core.request{env:prod,service:svc-notification-preferences} > 1`, routes @webhook-incidentio-high) fired 2026-09-09 08:36 UTC (\~1:36 AM PT), resolved 08:46 UTC; the escalation was cancelled (no ack) when it self-cleared. Monitor now OK; the query has no sustain (single 10-min window). Likely cause: a brief p90 latency blip (p90 baseline \~116 ms / 14 d, so `> 1 s` is \~8× normal) — a sustain guard would suppress this class of night page nobody had to act on.



### Recurring / Flappy Alerts — Monitor Tuning Candidates

| Alert | Times Fired | Notes |
| --- | --- | --- |
| [301972958](https://app.datadoghq.com/monitors/301972958) — svc-mark-tech Request duration too high | 3× (all Sep 8 evening PT) | P5→High over-route: fired 3× overnight, all fast-acked and self-resolved in minutes. Route the prod branch to Low or require ≥ 2 sustained / ≥ N consecutive windows. Ledger weeks_seen 8; see Action Items. |

_Only 301972958 fired multiple times this week. Standing recurring candidates (HPA_ `135119948`_, the svc-notification-preferences pair_ `243692163` _/_ `243692043`_, the SQS backlog cluster, the mark-tech cron_ `313314019`_) live in the_ [_Monitor Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577) _and the recommendations below._

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; High/Alert pages for a self-resolving condition, incl. outside working hours | Chronic (weeks_seen 10); fired 1× this week at Warn/Low (acked); 8× the prior week incl 2 Alert/High; monitor OK | **Route HIGH → LOW / gate to critical.** before: util `> 90` Alert / \~80 Warn → `@webhook-incidentio-high`. after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | <custom data-type="status" data-id="id-3">strongly recommend</custom> |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~33 days (Aug 7 cliff); weeks_seen 5; monitor quiet (model adapting) | **Do NOT tune → investigate.** before: monitor unchanged. after: investigate via the Activation runbook (`kem-tug-987`); rule out an Aug 7 \~15:00 UTC deploy/instrumentation change vs a demand regression; open a Jira fix. Coverage: monitor unchanged. | high | <custom data-type="status" data-id="id-4">strongly recommend</custom> |
| [143509449](https://app.datadoghq.com/monitors/143509449) — funnel-cashout expirations low | Real, sustained-low expiration drop that pages High — threshold change applied at the Aug 25 handoff | Threshold `< 5` → `< 2` (applied, re-confirmed live); fired 1× this week + 4× the prior week at `< 2`; weeks_seen 4; the drop persists | **Applied (threshold 5 → 2).** Cut paging substantially, but the real drop persists. Still needed: investigate throughput + the retrigger-funnel-cashout cronjob; prefer a time-of-day / min-volume guard. Coverage: a real funnel-cashout outage still pages High. | high (observed diff) | <custom data-type="status" data-id="id-5">applied</custom> |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM (+ sibling [133647342](https://app.datadoghq.com/monitors/133647342) mem-util) | Activation dev-leak: a dev-eks OOM paged prod on-call High because the page handles were unconditional | Routing fixed 2026-08-28 (handles inside the prod `is_match` block; re-confirmed live); weeks_seen 5; 0 OOM this week — no post-fix dev-eks OOM yet to validate | **ACHIEVED — handles prod-gated.** Remaining: query still has no env scope (still enters Alert on dev, no page); optionally add `cluster_flavor:prod`; clear the stale mem-util 133647342 dev-eks orphan + scope out dev. Coverage: prod OOM still pages High. | high (observed diff + audit) | <custom data-type="status" data-id="id-6">applied</custom> |
| [137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650) — SQS backlog cluster | Flappy backlog, no env scope / no sustain (Datadog-only noise; 0 incident.io pages) | No incident.io pages this week; weeks_seen 9 / 8 / 8 | **Add scope + sustain; verify routing.** before: SQS oldest-age `> 90–150 s` Alert, `last_5m`, no env scope, no sustain. after: add `env:prod` + a sustain ≥ 10–15 min; verify the prod routing branch actually resolves. Coverage: a sustained real backlog still alerts. | med | <custom data-type="status" data-id="id-7">recommend</custom> |

_Top 5 by expected impact; **full history (25 rows) →**_ [_Monitor Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577)_. Standing, learned recommendations carried into the new week — they persist until applied. This week's noisiest was the_ **svc-mark-tech P5 → High over-route** _(request-duration_ `301972958` _×3; cron_ `313314019` _quiet this week) — see Action Items._

### 🔴 Open Going Into the Week

**Active — Datadog Alert/Warn now: 0.** No Growth monitors read Alert/Warn (verified via `search_datadog_monitors team:l2-peng-growth status:(Alert OR Warn)` — none).

**Stale / lingering incident.io alerts (need a manual clear, not active prod work): 4** (all confirmed still-firing via `alert_stats status:firing` and absent from the current Datadog Alert/Warn set):

* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High, since 2026-06-03; Datadog No Data. Code bug → Jira + clear.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low, since 2026-07-23; same bug.
* Activation mem-util ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks group since 2026-05-29; Datadog OK on prod. Dev-scope leak → scope out dev + clear.
* Databricks "Promotions Metrics Processor Job Failed" — High, since 2025-12-17; no live Datadog monitor. Verify job + clear.

**No active prod issue; 0 active / 4 stale incident.io alert(s) to clear** — plus the carry-in cashout-volume signals above to keep watching.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** 27 open (<custom data-type="status" data-id="id-8">7 Critical</custom> / <custom data-type="status" data-id="id-9">20 High</custom>) via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) (org-wide, as of this refresh; up from 20 at the Sep 8 handoff). 7 Critical: 5 `tomcat-embed-core` SCA bumps (`KMONO-60`, `KMONO-61`, `EBBUD-3777`, `EBBUD-3778`, `EBBUD-3779`), a new `io.netty:netty-handler` SCA (`KMONO-63`), and the SAST OS-command-injection `EBBUD-3697`. 20 High: SAST anti-forgery-token (PayRouter, EarninCard, DataLoader, Bank, Offers) + SAST file-path / log-leakage / SSRF + SCA bumps (`js-yaml`, `fast-uri`, `brace-expansion`, `nanoid`, `SSH.NET`, `tar`, `hono`). Severity from the ticket summary prefix (Jira priority field uniformly "Low"). **org-wide** scope (no Growth-owned ticket). _Count is volatile intraday._

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

- [ ] **Escalate the first-cashout volume drop** (\~33 days below baseline) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); check the Aug 7 \~15:00 UTC cliff (deploy vs demand); open a Jira fix. Do NOT tune the monitor.
- [ ] **Investigate the funnel-cashout-expiration drop** ([143509449](https://app.datadoghq.com/monitors/143509449)): fired again this week at the applied `< 2` threshold; check the retrigger-funnel-cashout cronjob + tie to the first-cashout decline; prefer a min-volume / time-of-day guard.
- [ ] **Fix the svc-mark-tech P5 → High over-routing** (request-duration [301972958](https://app.datadoghq.com/monitors/301972958) ×3 High this week; cron [313314019](https://app.datadoghq.com/monitors/313314019)): route the prod branch to Low or require ≥ 2 sustained / ≥ N consecutive windows; confirm Growth ownership of svc-mark-tech.
- [ ] **Tune HPA** [135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate to critical-only); keep OOM / pod-not-ready at HIGH. Fired 1× this week (Warn/Low); 8× the prior week incl 2 High/Alert.
- [ ] **Add a sustain to the svc-notification-preferences latency pair** ([243692163](https://app.datadoghq.com/monitors/243692163) p90 High / [243692043](https://app.datadoghq.com/monitors/243692043) avg Low): p90 auto-resolved a \~1:36 AM PT night page this week; keep the bounds (p90 baseline \~116 ms/14 d), require ≥ 2 consecutive windows; consider consolidating the two.
- [ ] **Verify the Activation OOM routing fix holds** ([133647340](https://app.datadoghq.com/monitors/133647340)): handles gated to prod (2026-08-28, re-confirmed). Confirm no dev-eks OOM pages prod; optionally add `cluster_flavor:prod`; clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342).
- [ ] **Tune the Activation SQS backlog cluster** ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650)): add `env:prod` + a 10–15 min sustain; verify routing (Datadog-only, 0 incident.io pages).
- [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582)) and clear the 2 stale alerts once shipped.
- [ ] Verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (\~9 months).
- [ ] Review open vulnerability tickets — 27 open (7 Critical / 20 High), org-wide; the 5 `tomcat-embed-core` + new `netty-handler` (`KMONO-63`) Criticals lead.

## 📝 Manual Notes (preserved across refreshes)

_Add notes here; they survive daily refreshes._

---

_Generated by the Growth Team Ops Review agent. Window: 2026-09-08 11:00 → 2026-09-15 11:00 America/Mexico_City (week-to-date, \~1 day in; live, refreshed daily until it freezes at the Sep 15 handoff). Last refreshed: 2026-09-09 10:03 AM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities) — all connectors healthy. Customer identifiers redacted where present (none required this run). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent._