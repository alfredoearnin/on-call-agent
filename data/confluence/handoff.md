🔄 **Live page** — refreshed daily during the on-call week (2026-09-01 → 2026-09-08). Last refreshed **2026-09-01 10:03 AM PT (America/Los_Angeles)** (week just opened, \~0 h in). This page freezes at the Tuesday handoff (2026-09-08 11:00 America/Mexico_City); a new page opens for the next week.

🔴 **Carry-in from last week — two real, unresolved cashout-volume signals to watch.** (1) **First-cashout volume** — the Aug 7 \~15:00 UTC cliff persists (\~25 days); monitor [17131362](https://app.datadoghq.com/monitors/17131362) reads OK only because its anomaly model adapted (quiet ≠ recovered). (2) **Funnel-cashout expirations remain low** — `FunnelCashoutExpired` \~1–12/hr (overnight troughs \~1–2) vs \~20–79/hr earlier; monitor [143509449](https://app.datadoghq.com/monitors/143509449) is at the tightened `< 2` threshold (fired once last week at that bound). **Cause not determined from available signals** — investigate both via the Activation runbook / dashboard `kem-tug-987`; open a Jira fix. Also open at handoff: 4 stale incident.io orphans to clear (see Open Going Into Handoff).

# Growth Team Ops Review — Weekly Handoff

**09/01/2026 Growth Team Ops Review** · On-call week **2026-09-01 11:00 → 2026-09-08 11:00** (America/Mexico_City) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-09-01 10:03 AM PT** (week just opened; live, refreshed daily).

_This on-call week — primary: **aiden.ramgoolam**; secondary: **Edder Núñez** (shift Tue Sep 1 → Tue Sep 8; verified live via_ `schedule_show`_). Next handoff Sep 8: primary **Edder Núñez**, secondary **shashank**._

_Coverage check: could not be completed (no Slack profile-read tool available) — verify availability manually._

## SLOs / SLAs (15 minutes)

* [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
* [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
* [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — new on-call week (just opened, \~0 h in):** **0 incident.io alert records so far.** | **Prior full week (Aug 25 → Sep 1):** 15 records (10 High + 5 Low), all resolved — incl. 4 operator `[TEST]` notifications (real activity 11). | **Trend: too early to call** (only \~0 h into the week; a run-rate needs ≥ 1 day elapsed). **Human-attention: 0** | **Auto-resolved: 0.** **Escalation rate (alerts → incidents): 0/0.** **Still firing: 0 active / 4 stale** (no Datadog monitor in Alert/Warn now; 4 stale = incident.io orphans carried from prior weeks).

_Priority = monitor severity/routing (High/Low); Warn/Alert = the level a fire actually crossed — the two are independent. A High-priority monitor can fire only at Warn._

## Incidents (15 minutes)

### Production Incidents — Customer Impact

No production incidents this week (incident.io `incident_list` for the team = 0). Carry-overs still tracked (no live incident): the quick-reply dead-button frontend bug (INC-2824, [312932032](https://app.datadoghq.com/monitors/312932032), fix incomplete) and the Anthropic-quota fragility (INC-2795 class, [309355473](https://app.datadoghq.com/monitors/309355473), OK).

### Operational Incidents — Deploys / Data Repairs / Infra

No operational incidents this week (0 in incident.io for the team).

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

No alerts required human attention yet this week (the week just opened at the Sep 1 handoff).

### Auto-Resolved — Escalation Cancelled

No alerts auto-resolved yet this week.

### Recurring / Flappy Alerts — Monitor Tuning Candidates

No new recurring/flappy fires yet this week. Standing candidates carried from the [Monitor Tuning Ledger](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577) (22 rows) are summarized below; watch for recurrence this week.

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; a Warn pages like a critical page, including outside working hours | Chronic (weeks_seen 9); fired 5× real Warn last week (+ 4 operator test notifications); 0 fires yet this new week | **Route HIGH → LOW / gate to critical.** before: util `> 90` Alert / \~80 Warn → `@webhook-incidentio-high`. after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | <custom data-type="status" data-id="id-0">strongly recommend</custom> |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~25 days (Aug 7 cliff); recent \~1–122/hr (troughs \~1–6) vs pre-cliff weekday \~110–198/hr; weeks_seen 5; monitor quiet (model adapting) | **Do NOT tune → investigate.** before: monitor unchanged. after: investigate via the Activation runbook (`kem-tug-987`); rule out an Aug 7 \~15:00 UTC deploy/instrumentation change vs a demand regression; open a Jira fix. Coverage: monitor unchanged. | high | <custom data-type="status" data-id="id-1">strongly recommend</custom> |
| [143509449](https://app.datadoghq.com/monitors/143509449) — funnel-cashout expirations low | Real, sustained-low expiration drop that pages High overnight — threshold change applied at the Aug 25 handoff | Threshold `< 5` → `< 2` (applied); fired 1× last week at `< 2` (down from 10 the week before); weeks_seen 3; 0 fires yet this new week | **Applied (threshold 5 → 2).** Cut paging \~90%, but the underlying drop persists. Still needed: investigate the throughput drop + the retrigger-funnel-cashout cronjob; prefer a time-of-day / min-volume guard. Coverage: a real funnel-cashout outage still pages High. | high (observed diff) | <custom data-type="status" data-id="id-2">applied</custom> |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM (+ sibling [133647342](https://app.datadoghq.com/monitors/133647342) mem-util) | Activation dev-leak: a dev-eks OOM paged prod on-call High because the page handles were unconditional | Routing fixed 2026-08-28 00:29 UTC (handles now inside the prod `is_match` block; confirmed live); weeks_seen 5; no post-fix dev-eks OOM yet to validate | **ACHIEVED — handles prod-gated.** Remaining: query still has no env scope (still enters Alert on dev, no page); optionally add `cluster_flavor:prod`; clear the stale mem-util 133647342 dev-eks orphan + scope out dev. Coverage: prod OOM still pages High. | high (observed diff + audit) | <custom data-type="status" data-id="id-3">applied</custom> |
| [137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650) — SQS backlog cluster | Flappy backlog, no env scope / no sustain (Datadog-only noise; 0 incident.io pages) | Dominated last week's 409-event firehose (each self-clears \~2–4 min; 0 pages); weeks_seen 9 / 8 / 8; watching this week | **Add scope + sustain; verify routing.** before: SQS oldest-age `> 90–150 s` Alert, `last_5m`, no env scope, no sustain. after: add `env:prod` + a sustain ≥ 10–15 min; verify the prod routing branch actually resolves. Coverage: a sustained real backlog still alerts. | med | <custom data-type="status" data-id="id-4">recommend</custom> |

_Top 5 by expected impact; **full history (22 rows) →**_ [_Monitor Tuning Ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577)_. These are carried from last week's close; the feedback loop re-runs as fires accrue this week. Both applied changes (OOM prod-gating, funnel_ `< 2`_) were confirmed still live at the Sep 1 close._

### 🔴 Open Going Into Handoff

**Active Datadog Alert/Warn now: 0.** No team monitor reads Alert/Warn at the start of this week (`search_datadog_monitors team:l2-peng-growth status:(alert OR warn)` → none).

**Stale / lingering incident.io alerts (need a manual clear, not active prod work): 4** (carried in from prior weeks, verified still-firing at the Sep 1 handoff):

* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High, since 2026-06-03; Datadog No Data. Code bug → Jira + clear.
* Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low, since 2026-07-23; same bug.
* Activation mem-util ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks group since 2026-05-29; Datadog OK on prod. Dev-scope leak → scope out dev + clear.
* Databricks "Promotions Metrics Processor Job Failed" — High, since 2025-12-17; no live Datadog monitor. Verify job + clear.

**No active prod issues; 4 stale incident.io alert(s) to clear** — plus the carry-in cashout-volume signals above to keep watching.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** 10 open (<custom data-type="status" data-id="id-5">1 Critical</custom> / <custom data-type="status" data-id="id-6">9 High</custom>) via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) at week open. The single Critical is SAST `EBBUD-3697` (OS-command injection, To Do). The 9 Highs are 1 SAST (`CXP-1998`, file-path, In Review) + 8 transitive SCA dependency bumps (`ddtrace`, `js-yaml`, `fast-uri`, `brace-expansion`, `nanoid`) across SV / QAMRE / MOBPLAT / ECD. Severity from the ticket summary prefix (Jira priority field uniformly "Low"). **org-wide** scope (no Growth-owned ticket). Count is volatile intraday.

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

- [ ] **Escalate the first-cashout volume drop** (\~25 days below baseline) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); check the Aug 7 \~15:00 UTC cliff (deploy vs demand); open a Jira fix. Do NOT tune the monitor.
- [ ] **Investigate the funnel-cashout-expiration drop** ([143509449](https://app.datadoghq.com/monitors/143509449)): paged once last week at the applied `< 2` threshold; check the retrigger-funnel-cashout cronjob + tie to the first-cashout decline; prefer a min-volume / time-of-day guard.
- [ ] **Verify the Activation OOM routing fix holds** ([133647340](https://app.datadoghq.com/monitors/133647340)): handles gated to prod (2026-08-28). Confirm no dev-eks OOM pages prod this week; optionally add `cluster_flavor:prod`; clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342).
- [ ] **Tune HPA**[135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate to critical-only); keep OOM / pod-not-ready at HIGH.
- [ ] **Add a sustain guard to the postman-internal latency pair** ([119674465](https://app.datadoghq.com/monitors/119674465) p90 / [119674469](https://app.datadoghq.com/monitors/119674469) avg): fired last week on brief `last_10m` crossings.
- [ ] **Triage the two Low cashout monitors:**[143557417](https://app.datadoghq.com/monitors/143557417) (add `env:prod` + min-hits floor); [143516414](https://app.datadoghq.com/monitors/143516414) GoodToGo (new candidate, watch recurrence).
- [ ] **Ship the quick-reply routing fix** (INC-2824; [312932032](https://app.datadoghq.com/monitors/312932032)).
- [ ] **Fix the P5→High over-routing** on the cron ([313314019](https://app.datadoghq.com/monitors/313314019)) + svc-mark-tech ([301972958](https://app.datadoghq.com/monitors/301972958)); confirm Growth ownership of svc-mark-tech.
- [ ] **Verify OTGE readiness monitor routing** ([111957816](https://app.datadoghq.com/monitors/111957816)): no notification handles — add a page/Slack handle. Also investigate the OTGE grant-ratio anomaly ([111675017](https://app.datadoghq.com/monitors/111675017)) that fired Friday.
- [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582)) and clear the 2 stale alerts once shipped.
- [ ] Tune the Activation SQS backlog cluster ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650)): add `env:prod` + a 10–15 min sustain; verify routing.
- [ ] Verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (\~8 months).
- [ ] Review open vulnerability tickets — 10 open (1 Critical / 9 High), org-wide.

## 📝 Manual Notes (preserved across refreshes)

_Add notes here; they survive daily refreshes._

---

_Generated by the Growth Team Ops Review agent. Window: 2026-09-01 11:00 → 2026-09-08 11:00 America/Mexico_City (week-to-date, just opened; live, refreshed daily until it freezes at the Sep 8 handoff). Last refreshed: 2026-09-01 10:03 AM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities) — all connectors healthy. Customer identifiers redacted where present (none required this run). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent._