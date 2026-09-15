🔄 **Live page** — refreshed daily during the on-call week (2026-09-15 → 2026-09-22). Last refreshed **2026-09-15 10:16 AM PT (America/Los_Angeles)** (just opened — a few minutes into the week). This page freezes at the Tuesday handoff (2026-09-22 11:00 America/Mexico_City); a new page opens for the next week.

🔴 **Ongoing cashout-funnel signals — carried in, keep watching.** (1) **First-cashout volume drop** [17131362](https://app.datadoghq.com/monitors/17131362) — the Aug 7 \~15:00 UTC cliff persists (\~39 days); reads OK only because the anomaly model adapted (quiet ≠ recovered). Real signal — do NOT tune → Activation runbook `kem-tug-987` + Jira. (2) **Funnel-cashout expirations low** [143509449](https://app.datadoghq.com/monitors/143509449) — the Sep 10 and Sep 14 fires are still open as stale incident.io alerts (Datadog No Data); the monitor now routes incidentio-low (was High at fire time — confirm the re-route was intentional). Registration-completion [143518919](https://app.datadoghq.com/monitors/143518919) also fired ×2 last week. The real drop persists → Jira / throughput fix, do NOT tune further. Prior on-call week (Sep 8 → Sep 15) closed at **28 records** (12 High / 16 Low), all resolved, 0 incidents.

# Growth Team Ops Review — Weekly Handoff

**09/15/2026 Growth Team Ops Review** · On-call week **2026-09-15 11:00 → 2026-09-22 11:00** (America/Mexico_City) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-09-15 10:16 AM PT** (week-to-date, just opened; live, refreshed daily).

_This on-call week — primary: **Nabi**; secondary: **Ankur Shivani** (shift Tue Sep 15 → Tue Sep 22; verified live via_ `schedule_show`_). Next handoff Sep 22: primary **Ankur Shivani**, secondary **Alfred**._

_Coverage check: could not be completed (no Slack profile-read tool available under either name) — verify availability manually._

## SLOs / SLAs (15 minutes)

* [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
* [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
* [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — week-to-date (just opened, < 1 h in):** **0 records** so far this on-call week. | **Prior full week (Sep 8 → Sep 15):** 28 records (12 High, 16 Low), 26 resolved, 0 incidents. | **Trend: too early to call** (only minutes into the week; a run-rate needs at least a day elapsed). **Human-attention: 0 | Auto-resolved: 0.** **Escalation rate (alerts → incidents): 0/0.** **Still firing: 0 active / 6 stale** (incident.io) — 0 Growth monitors currently read Alert/Warn; the 6 stale are carried in from prior weeks (2 funnel-cashout + 2 dup-funnel + dev-eks mem-util + Databricks) and still need a manual clear (below).

_Priority = monitor severity/routing (High/Low); Warn/Alert = the level a fire actually crossed — the two are independent. A High-priority monitor can fire only at Warn._

## Incidents (15 minutes)

### Production Incidents — Customer Impact

No production incidents this week (incident.io `incident_list` for the team = 0). Carry-overs still tracked (no live incident): the quick-reply dead-button frontend bug (INC-2824, [312932032](https://app.datadoghq.com/monitors/312932032)) and the Anthropic-quota fragility (INC-2795 class, [309355473](https://app.datadoghq.com/monitors/309355473), OK).

### Operational Incidents — Deploys / Data Repairs / Infra

No operational incidents this week (0 in incident.io for the team).

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

No alerts have required human attention yet this week (the week just opened at the Sep 15 handoff).

### Auto-Resolved — Escalation Cancelled

No alerts auto-resolved yet this week.

### Recurring / Flappy Alerts — Monitor Tuning Candidates

No recurring/flappy alerts yet this week. Standing learned recommendations (carried across weeks) are below.

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; pages for a self-resolving condition, incl. outside working hours | Chronic (weeks_seen 11); fired 9× last week at Warn/Low (7 acked + 2 no-ack); monitor OK | **Route HIGH → LOW / gate to critical.** before: util `> 90` Alert / \~80 Warn → `@webhook-incidentio-high`. after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | <custom data-type="status" data-id="id-0">strongly recommend</custom> |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~39 days (Aug 7 cliff); weeks_seen 5; monitor quiet (model adapting) | **Do NOT tune → investigate.** before: monitor unchanged. after: investigate via the Activation runbook (`kem-tug-987`); rule out an Aug 7 \~15:00 UTC deploy/instrumentation change vs a demand regression; open a Jira fix. Coverage: monitor unchanged. | high | <custom data-type="status" data-id="id-1">strongly recommend</custom> |
| [143509449](https://app.datadoghq.com/monitors/143509449) — funnel-cashout expirations low | Real, sustained-low expiration drop — threshold change applied at the Aug 25 handoff; a further high→low re-route was observed at the Sep 15 close | Threshold `< 5` → `< 2` (applied, re-confirmed live); fired 3× last week (Sep 10 & Sep 14 fires still open/stale); routing now incidentio-low; weeks_seen 5; the drop persists | **Applied (threshold 5 → 2); routing re-route observed.** Confirm the incidentio-low re-route was intentional. Still needed: investigate throughput + the retrigger-funnel-cashout cronjob; prefer a time-of-day / min-volume guard. Coverage: a real funnel-cashout outage still pages. | high (observed diff) | <custom data-type="status" data-id="id-2">applied</custom> |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM (+ sibling [133647342](https://app.datadoghq.com/monitors/133647342) mem-util) | Activation dev-leak: a dev-eks OOM paged prod on-call High because the page handles were unconditional | Routing fixed 2026-08-28 (handles inside the prod `is_match` block; re-confirmed live); weeks_seen 5; 0 OOM last week — no post-fix dev-eks OOM yet to validate | **ACHIEVED — handles prod-gated.** Remaining: query still has no env scope (still enters Alert on dev, no page); optionally add `cluster_flavor:prod`; clear the stale mem-util 133647342 dev-eks orphan + scope out dev. Coverage: prod OOM still pages High. | high (observed diff + audit) | <custom data-type="status" data-id="id-3">applied</custom> |
| [137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650) — SQS backlog cluster | Flappy backlog, no env scope / no sustain (Datadog-only noise; 0 incident.io pages) | No incident.io pages last week; weeks_seen 9 / 8 / 8 | **Add scope + sustain; verify routing.** before: SQS oldest-age `> 90–150 s` Alert, `last_5m`, no env scope, no sustain. after: add `env:prod` + a sustain ≥ 10–15 min; verify the prod routing branch actually resolves. Coverage: a sustained real backlog still alerts. | med | <custom data-type="status" data-id="id-4">recommend</custom> |

_Top 5 by expected impact; **full history (27 rows) →**_ [_Monitor Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577)_. Standing, learned recommendations carried into the new week — they persist until applied. Last week's noisiest was the_ **HPA flapper** _(_`135119948` _×9); the cashout-funnel signal cluster (funnel expirations, registration-completion, first-cashout) remains the key watch. See Action Items._

### 🔴 Open Going Into the Week

**Active — Datadog Alert/Warn now: 0.** No Growth monitor currently reads Alert/Warn (`search_datadog_monitors team:l2-peng-growth status:(alert OR warn)` → none).

**Stale / lingering incident.io alerts (need a manual clear, not active prod work): 6** (all confirmed still-firing via `alert_list status:firing` and absent from the current Datadog Alert/Warn set — carried in from prior weeks):

* Funnel-cashout expirations low ([143509449](https://app.datadoghq.com/monitors/143509449)) — High, since 2026-09-14 01:24 UTC; Datadog No Data. Tied to the real funnel-cashout drop — investigate + clear.
* Funnel-cashout expirations low ([143509449](https://app.datadoghq.com/monitors/143509449)) — High, since 2026-09-10 03:24 UTC; Datadog No Data. Earlier lingering fire; same underlying drop.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High, since 2026-06-03; Datadog No Data. Code bug → Jira + clear.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low, since 2026-07-23; same bug.
* Activation mem-util ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks group since 2026-05-29; Datadog OK on prod. Dev-scope leak → scope out dev + clear.
* Databricks "Promotions Metrics Processor Job Failed" — High, since 2025-12-17; no live Datadog monitor. Verify job + clear.

**0 active paging issues; 6 stale incident.io alert(s) to clear** — plus the carry-in cashout-volume signals above to keep watching.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** 26 open via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) (org-wide, as of the Sep 15 handoff) — <custom data-type="status" data-id="id-5">20 Critical</custom> / <custom data-type="status" data-id="id-6">4 High</custom> by ticket summary prefix, plus 2 security tickets with no severity prefix (a CORS misconfiguration `WEBPLAT-1489`, In Progress, and an IAM config review `ACC-6258`, Blocked). The 20 Criticals are led by `io.netty:netty-handler` (11), `tomcat-embed-core` (5), Next.js (3) and `System.Text.Encodings.Web` (1). 4 High: anti-forgery-token (`QAMRE-1920`), log-leakage (`MOBPLAT-4684`), `tar` (`MOBPLAT-4682`), `netty-codec-http` (`KMONO-59`). Severity from the ticket summary prefix (Jira priority field uniformly "Low"). **org-wide** scope (no Growth-owned ticket). _Count is volatile intraday._

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

- [ ] **Escalate the first-cashout volume drop** (\~39 days below baseline) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); check the Aug 7 \~15:00 UTC cliff (deploy vs demand); open a Jira fix. Do NOT tune the monitor.
- [ ] **Investigate the funnel-cashout-expiration drop** ([143509449](https://app.datadoghq.com/monitors/143509449)): the Sep 10 & Sep 14 fires are still open (stale) — clear both, check the retrigger-funnel-cashout cronjob, and tie to the first-cashout decline. Confirm the recent incidentio-low re-route was intentional.
- [ ] **Watch the funnel-anomaly monitors** (registration-completion [143518919](https://app.datadoghq.com/monitors/143518919) fired ×2 last week; good-to-go [143516414](https://app.datadoghq.com/monitors/143516414)): robust weekly anomalies that echo the funnel-cashout / first-cashout drop — route to that Activation investigation rather than tuning.
- [ ] **Watch svc-referral Apdex** ([27555488](https://app.datadoghq.com/monitors/27555488), High): fired ×2 last week after \~8 weeks quiet (weeks_seen 2) — a loose `< 0.9` Apdex bound on `last_5m` is volatile at low overnight traffic. Debounce (`last_15m` / ≥ 2 windows) or route transient dips to Low.
- [ ] **Tune HPA** [135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate to critical-only); keep OOM / pod-not-ready at HIGH. Fired 9× last week (all Warn/Low); chronic (weeks_seen 11).
- [ ] **Finish the svc-mark-tech P5 → High fix** (request-duration [301972958](https://app.datadoghq.com/monitors/301972958) ×3 High last week): eval window was widened `last_10m → last_1d` on Sep 9 (0 fires since) but `last_1d` p99 may mask a real regression — prefer `last_1h`; route the prod branch to Low or require ≥ N consecutive windows; confirm Growth ownership of svc-mark-tech.
- [ ] **Add a sustain to the svc-notification-preferences latency pair** ([243692163](https://app.datadoghq.com/monitors/243692163) p90 High / [243692043](https://app.datadoghq.com/monitors/243692043) avg Low): p90 fired 4× last week (incl. a \~1:36 AM PT night page); keep the bounds (grounded p90 baseline \~116 ms / 14 d), require ≥ 2 consecutive windows; consider consolidating the two.
- [ ] **Verify the Activation OOM routing fix holds** ([133647340](https://app.datadoghq.com/monitors/133647340)): handles gated to prod (2026-08-28, re-confirmed). Confirm no dev-eks OOM pages prod; optionally add `cluster_flavor:prod`; clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342).
- [ ] **Tune the Activation SQS backlog cluster** ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650)): add `env:prod` + a 10–15 min sustain; verify routing (Datadog-only, 0 incident.io pages).
- [ ] **Add a sustain to the job-cashout SQS receive-latency pair** ([142140455](https://app.datadoghq.com/monitors/142140455) avg-duration / [142140338](https://app.datadoghq.com/monitors/142140338) p90, both Low, auto-resolved no-ack Sep 11): require ≥ 2 consecutive windows so a 4–5 min blip does not alert; keep Low.
- [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582)) and clear the 2 stale alerts once shipped.
- [ ] Verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (\~9 months).
- [ ] Review open vulnerability tickets — 26 open (20 Critical / 4 High + 2 unlabeled), org-wide; the `netty-handler` (11), `tomcat-embed-core` (5) and Next.js (3) Criticals lead.

## 📝 Manual Notes (preserved across refreshes)

_Add notes here; they survive daily refreshes._

---

_Generated by the Growth Team Ops Review agent. Window: 2026-09-15 11:00 → 2026-09-22 11:00 America/Mexico_City (week-to-date, just opened; live, refreshed daily until it freezes at the Sep 22 handoff). Last refreshed: 2026-09-15 10:16 AM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities) — all connectors healthy. Customer identifiers redacted where present (none required this run). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent._
