🔄 **Live page** — refreshed daily during the on-call week (2026-09-08 → 2026-09-15). Last refreshed **2026-09-08 10:04 AM PT (America/Los_Angeles)** (\~0 h into the week — just opened at the Tuesday handoff). This page freezes at the Tuesday handoff (2026-09-15 11:00 America/Mexico_City); a new page opens for the next week.

🔴 **Carry-in from the week just closed — watch these.** (1) **First-cashout volume drop** [17131362](https://app.datadoghq.com/monitors/17131362) — the Aug 7 \~15:00 UTC cliff persists (\~32 days); reads OK only because the anomaly model adapted (quiet ≠ recovered). Real signal — do NOT tune → Activation runbook `kem-tug-987` + Jira. (2) **Funnel-cashout expirations low** [143509449](https://app.datadoghq.com/monitors/143509449) — fired **4×** last week at the tightened `< 2` threshold (the real drop persists) → Jira / throughput fix, do NOT tune further. **Open at the handoff: 0 active Datadog Alert/Warn + 4 stale incident.io orphans** to clear (below). Prior week (Sep 1 → Sep 8) closed at **34 records** (14 High / 20 Low), all resolved, 0 incidents.

# Growth Team Ops Review — Weekly Handoff

**09/08/2026 Growth Team Ops Review** · On-call week **2026-09-08 11:00 → 2026-09-15 11:00** (America/Mexico_City) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-09-08 10:04 AM PT** (week-to-date, \~0 h in; live, refreshed daily).

_This on-call week — primary: **Edder Núñez**; secondary: **shashank** (shift Tue Sep 8 → Tue Sep 15; verified live via_ `schedule_show`_). Next handoff Sep 15: primary **shashank**, secondary **Nabi**._

_Coverage check: could not be completed (no Slack profile-read tool available under either name) — verify availability manually._

## SLOs / SLAs (15 minutes)

* [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
* [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
* [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — week-to-date (\~0 h in, just opened):** **0 records** — the on-call week just opened at the Sep 8 handoff. | **Prior full week (Sep 1 → Sep 8):** 34 records (14 High, 20 Low), all resolved, 0 incidents. | **Trend: too early to call** (only \~0 h into the week; run-rate is meaningless below one day elapsed). **Human-attention: 0 | Auto-resolved: 0.** **Escalation rate (alerts → incidents): 0/0.** **Still firing: 0 active / 4 stale** (incident.io) — no Growth monitor reads Alert/Warn; the 4 stale are old orphans carried in (below).

_Priority = monitor severity/routing (High/Low); Warn/Alert = the level a fire actually crossed — the two are independent. A High-priority monitor can fire only at Warn._

## Incidents (15 minutes)

### Production Incidents — Customer Impact

No production incidents yet this week (the on-call week just opened; incident.io `incident_list` for the team = 0). Carry-overs still tracked (no live incident): the quick-reply dead-button frontend bug (INC-2824, [312932032](https://app.datadoghq.com/monitors/312932032), fix incomplete) and the Anthropic-quota fragility (INC-2795 class, [309355473](https://app.datadoghq.com/monitors/309355473), OK).

### Operational Incidents — Deploys / Data Repairs / Infra

No operational incidents yet this week (0 in incident.io for the team).

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

No alerts required human attention yet this week (the on-call week just opened at the Sep 8 handoff). This page refreshes daily.

### Auto-Resolved — Escalation Cancelled

No alerts auto-resolved yet this week.

### Recurring / Flappy Alerts — Monitor Tuning Candidates

No recurring/flappy alerts yet this week (the week just opened). Standing tuning candidates from prior weeks live in the [Monitor Tuning Ledger](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577) (25 rows) and the recommendations below; the carry-in cashout-volume signals above are the priority watch items.

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; High/Alert pages for a self-resolving condition, including outside working hours | Chronic (weeks_seen 10); fired 8× last week (6 Warn/Low + 2 Alert/High, one 91.7%), all acked; 0 fires yet this week; monitor OK | **Route HIGH → LOW / gate to critical.** before: util `> 90` Alert / \~80 Warn → `@webhook-incidentio-high`. after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | <custom data-type="status" data-id="id-0">strongly recommend</custom> |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~32 days (Aug 7 cliff); weeks_seen 5; monitor quiet (model adapting) | **Do NOT tune → investigate.** before: monitor unchanged. after: investigate via the Activation runbook (`kem-tug-987`); rule out an Aug 7 \~15:00 UTC deploy/instrumentation change vs a demand regression; open a Jira fix. Coverage: monitor unchanged. | high | <custom data-type="status" data-id="id-1">strongly recommend</custom> |
| [143509449](https://app.datadoghq.com/monitors/143509449) — funnel-cashout expirations low | Real, sustained-low expiration drop that pages High — threshold change applied at the Aug 25 handoff | Threshold `< 5` → `< 2` (applied, re-confirmed live); fired 4× last week at `< 2`; weeks_seen 4; the underlying drop persists | **Applied (threshold 5 → 2).** Cut paging substantially, but the real drop persists. Still needed: investigate throughput + the retrigger-funnel-cashout cronjob; prefer a time-of-day / min-volume guard. Coverage: a real funnel-cashout outage still pages High. | high (observed diff) | <custom data-type="status" data-id="id-2">applied</custom> |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM (+ sibling [133647342](https://app.datadoghq.com/monitors/133647342) mem-util) | Activation dev-leak: a dev-eks OOM paged prod on-call High because the page handles were unconditional | Routing fixed 2026-08-28 (handles inside the prod `is_match` block; re-confirmed live); weeks_seen 5; 0 OOM — no post-fix dev-eks OOM yet to validate | **ACHIEVED — handles prod-gated.** Remaining: query still has no env scope (still enters Alert on dev, no page); optionally add `cluster_flavor:prod`; clear the stale mem-util 133647342 dev-eks orphan + scope out dev. Coverage: prod OOM still pages High. | high (observed diff + audit) | <custom data-type="status" data-id="id-3">applied</custom> |
| [137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650) — SQS backlog cluster | Flappy backlog, no env scope / no sustain (Datadog-only noise; 0 incident.io pages) | `137629294` flapped to Warn Sunday then self-cleared; the other two OK; weeks_seen 9 / 8 / 8 | **Add scope + sustain; verify routing.** before: SQS oldest-age `> 90–150 s` Alert, `last_5m`, no env scope, no sustain. after: add `env:prod` + a sustain ≥ 10–15 min; verify the prod routing branch actually resolves. Coverage: a sustained real backlog still alerts. | med | <custom data-type="status" data-id="id-4">recommend</custom> |

_Top 5 by expected impact; **full history (25 rows) →**_ [_Monitor Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577)_. These are standing, learned recommendations carried into the new week — they persist until applied. The_ **mark-tech P5 → High over-routing** _theme (cron_ `313314019` _+ request-duration_ `301972958`_) and the svc-notification-preferences latency pair (_`243692163` _/_ `243692043`_) recurred last week — see the ledger + Action Items._

### 🔴 Open Going Into the Week (carried in from the Sep 8 handoff)

**Active — Datadog Alert/Warn now: 0.** No Growth monitors read Alert/Warn at the handoff (verified via `search_datadog_monitors team:l2-peng-growth status:(Alert OR Warn)` — none).

**Stale / lingering incident.io alerts (need a manual clear, not active prod work): 4** (carried in; all 4 confirmed still-firing via `alert_stats status:firing` and absent from the current Datadog Alert/Warn set):

* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High, since 2026-06-03; Datadog No Data. Code bug → Jira + clear.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low, since 2026-07-23; same bug.
* Activation mem-util ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks group since 2026-05-29; Datadog OK on prod. Dev-scope leak → scope out dev + clear.
* Databricks "Promotions Metrics Processor Job Failed" — High, since 2025-12-17; no live Datadog monitor. Verify job + clear.

**No active prod issue; 0 active / 4 stale incident.io alert(s) to clear** — plus the carry-in cashout-volume signals above to keep watching.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** 20 open (<custom data-type="status" data-id="id-5">6 Critical</custom> / <custom data-type="status" data-id="id-6">14 High</custom>) via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) (org-wide, as of the Sep 8 handoff). 6 Critical: 5 `tomcat-embed-core` SCA bumps (`KMONO-60`, `KMONO-61`, `EBBUD-3777`, `EBBUD-3778`, `EBBUD-3779`) + the SAST OS-command-injection `EBBUD-3697`. 14 High: 3 SAST anti-forgery-token + 11 transitive SCA bumps (`js-yaml`, `fast-uri`, `brace-expansion`, `nanoid` ×4, `SSH.NET` ×3). Severity from the ticket summary prefix (Jira priority field uniformly "Low"). **org-wide** scope (no Growth-owned ticket). _Count is volatile intraday._

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

- [ ] **Escalate the first-cashout volume drop** (\~32 days below baseline) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); check the Aug 7 \~15:00 UTC cliff (deploy vs demand); open a Jira fix. Do NOT tune the monitor.
- [ ] **Investigate the funnel-cashout-expiration drop** ([143509449](https://app.datadoghq.com/monitors/143509449)): fired 4× last week at the applied `< 2` threshold; check the retrigger-funnel-cashout cronjob + tie to the first-cashout decline; prefer a min-volume / time-of-day guard.
- [ ] **Tune HPA** [135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate to critical-only); keep OOM / pod-not-ready at HIGH. Fired 8× last week incl 2 High/Alert pages (91.7%).
- [ ] **Fix the P5 → High over-routing on the mark-tech monitors** (cron [313314019](https://app.datadoghq.com/monitors/313314019) ×2 High + request-duration [301972958](https://app.datadoghq.com/monitors/301972958) ×1 High last week): route the prod branch to Low or require ≥ N consecutive / ≥ 2 sustained windows; confirm Growth ownership of svc-mark-tech.
- [ ] **Add a sustain to the svc-notification-preferences latency pair** ([243692163](https://app.datadoghq.com/monitors/243692163) p90 High / [243692043](https://app.datadoghq.com/monitors/243692043) avg Low): fired 6× last week; keep the bounds (p90 baseline \~116 ms/14 d), require ≥ 2 consecutive windows; consider consolidating the two.
- [ ] **Add a sustain / min-duration guard to processor-avg-duration** [142140455](https://app.datadoghq.com/monitors/142140455): fired 9× last week, all auto-resolved with no ack.
- [ ] **Add a sustain / consolidate the postman-internal latency pair** ([119674465](https://app.datadoghq.com/monitors/119674465) p90 / [119674469](https://app.datadoghq.com/monitors/119674469) avg).
- [ ] **Verify the Activation OOM routing fix holds** ([133647340](https://app.datadoghq.com/monitors/133647340)): handles gated to prod (2026-08-28, re-confirmed). Confirm no dev-eks OOM pages prod; optionally add `cluster_flavor:prod`; clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342).
- [ ] **Tune the Activation SQS backlog cluster** ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650)): add `env:prod` + a 10–15 min sustain; verify routing (Datadog-only, 0 incident.io pages).
- [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582)) and clear the 2 stale alerts once shipped.
- [ ] Verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (\~9 months).
- [ ] Review open vulnerability tickets — 20 open (6 Critical / 14 High), org-wide (5 Critical `tomcat-embed-core` SCA).

## 📝 Manual Notes (preserved across refreshes)

_Add notes here; they survive daily refreshes._

---

_Generated by the Growth Team Ops Review agent. Window: 2026-09-08 11:00 → 2026-09-15 11:00 America/Mexico_City (week-to-date, \~0 h in; live, refreshed daily until it freezes at the Sep 15 handoff). Last refreshed: 2026-09-08 10:04 AM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities) — all connectors healthy. Customer identifiers redacted where present (none required this run). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent._