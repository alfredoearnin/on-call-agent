🔄 **Live page** — refreshed daily during the on-call week (2026-09-22 → 2026-09-29). Last refreshed **2026-09-26 10:12 AM PT (America/Los\_Angeles)** (day 5, \~4 days into the week). This page freezes at the Tuesday handoff (2026-09-29 11:00 America/Mexico\_City); a new page opens for the next week.

🌟 **On-call week, day 5 (\~4 days in).** **2 incident.io Growth alert records** (1 High acked + 1 Low auto-resolved) and **0 incidents** since the Sep 22 handoff. The High was a new `svc-conversational-onboarding` RUM signal — quick-reply taps failing silently in production ([312930741](https://app.datadoghq.com/monitors/312930741)) — acked by primary Ankur Shivani in \~24 s and self-resolved in \~6 min (a guardrail from the closed INC-2824 routing bug; a real signal to investigate, not noise). Datadog logged **129 monitor fire transitions** (220 events incl. recoveries) across **9 monitors** — the standing SQS-backlog trio (first-mile / deactivate-user / user-activation), three OTGE svc-earnings monitors (CPU-throttle [111957818](https://app.datadoghq.com/monitors/111957818), HPA [111957822](https://app.datadoghq.com/monitors/111957822), payroll-status anomaly [112982614](https://app.datadoghq.com/monitors/112982614)), the svc-links error-rate Warn ([180229880](https://app.datadoghq.com/monitors/180229880), now 2× this week), the conversational-onboarding High, and a single [119674469](https://app.datadoghq.com/monitors/119674469) postman latency Low — each self-recovered in minutes. Only 2 routed to incident.io (the acked High + the postman Low); the rest were **0-page flappers**; **0 monitors read Alert/Warn now**. Stale incident.io alerts **hold at 5** (re-verified via `alert_stats`). incident.io authenticated and healthy; Datadog + Jira healthy. Vulnerabilities **46 → 42** (org-wide, volatile).

# Growth Team Ops Review — Weekly Handoff

**09/26/2026 Growth Team Ops Review** · On-call week **2026-09-22 11:00 → 2026-09-29 11:00** (America/Mexico\_City) · Sources: incident.io + Datadog (read-only) + Jira (vulnerabilities) · Last refreshed: **2026-09-26 10:12 AM PT** (week-to-date, day 5; live, refreshed daily).

*This on-call week — primary: **Ankur Shivani**; secondary: **Alfred** (shift Tue 2026-09-22 → Tue 2026-09-29; verified live via *`schedule_show`*). Next handoff 2026-09-29: primary **Alfred**, secondary **aiden.ramgoolam**.*

*Verified live via *`schedule_show`* this run (incident.io connector healthy) — rotation confirmed for both the current week and the Sep 29 handoff.*

*Coverage check (Slack out-of-office, as of 2026-09-26 10:12 AM PT): could not be completed (no Slack profile-read tool available under either name) — verify availability manually. incident.io *`schedule_show`* shows no PTO booked for the rotation members (Ankur Shivani, Alfred, aiden.ramgoolam) this window.*

## SLOs / SLAs (15 minutes)

- [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
- [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
- [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Alert volume — week-to-date (day 5, \~4 days in):** **2 incident.io Growth records** (1 High, 1 Low) — the High acked, the Low auto-resolved. Datadog: **129 monitor fire transitions** (220 events incl. recoveries) across 9 monitors — first-mile SQS [137629294](https://app.datadoghq.com/monitors/137629294) ×72, deactivate-user SQS [137629364](https://app.datadoghq.com/monitors/137629364) ×28, user-activation SQS [137629650](https://app.datadoghq.com/monitors/137629650) ×18, OTGE CPU-throttle [111957818](https://app.datadoghq.com/monitors/111957818) ×4, OTGE HPA [111957822](https://app.datadoghq.com/monitors/111957822) ×2, OTGE payroll-status anomaly [112982614](https://app.datadoghq.com/monitors/112982614) ×1, svc-links error-rate [180229880](https://app.datadoghq.com/monitors/180229880) ×2, conversational-onboarding RUM [312930741](https://app.datadoghq.com/monitors/312930741) ×1, postman latency [119674469](https://app.datadoghq.com/monitors/119674469) ×1 — all self-recovered; only the conversational-onboarding High and the postman Low created incident.io records. | **Prior full week (Sep 15 → Sep 22, closed):** 2 incident.io records (1 High + 1 Low), both auto-resolved, 0 incidents; \~130 Datadog transitions. | **Trend:** incident.io run-rate \~3–4/wk vs prior 2 → nominally ↑, but the shape matches the prior week (1 High + 1 Low); this week's High was acked in \~24 s and self-resolved, and nothing escalated to an incident. Datadog flapper run-rate \~226/wk (elevated vs prior \~130) — standing SQS noise, 0 pages. **Human-attention: 1 · Auto-resolved: 1 · Escalation rate (alerts → incidents): 0/2 (0%). Still firing: 0 active / 5 stale** (incident.io, re-verified via `alert_stats` this run).

*Priority = monitor severity/routing (High/Low); Warn/Alert = the level a fire crossed — independent. A High-priority monitor can fire only at Warn.*

## Incidents (15 minutes)

### Production Incidents — Customer Impact

**No production incidents opened this week** (incident.io `incident_list`, team L2-PENG-Growth → 0 in-window). Two older Growth incidents remain closed and are historical context only: **INC-2632** (Sev3, cashout-eligibility controls; reported 2026-05-26) resolved 2026-06-09; and **INC-2824** (Sev3, `svc-conversational-onboarding` — a backend/frontend button-text mismatch that dead-ended account creation; reported 2026-08-07) closed 2026-09-09. INC-2824 is the origin of the quick-reply guardrail monitor [312930741](https://app.datadoghq.com/monitors/312930741) that fired (and was acked) this week — see the Agent Finding below.

### Operational Incidents — Deploys / Data Repairs / Infra

**No operational incidents this week** (incident.io → 0). **No monitor config changes** since the Sep 22 handoff (Datadog `monitor_audit_event`, `team:l2-peng-growth` → 0). The funnel monitor [143509449](https://app.datadoghq.com/monitors/143509449) was deleted Sep 22 15:43 UTC — before this handoff (prior window) — so it is not a change in this week's window.

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

| Alert | Priority | Service | On-call | Agent Finding |
| --- | --- | --- | --- | --- |
| Quick reply taps failing silently — [312930741](https://app.datadoghq.com/monitors/312930741) | HIGH | `svc-conversational-onboarding` | Ankur Shivani (primary) | **TL;DR:** A RUM error monitor on `svc-conversational-onboarding` caught quick-reply taps failing silently (falling through to a no-op) in production on Fri Sep 25 \~3:05 PM PT; primary Ankur Shivani acked in \~24 s and it self-resolved in \~6 min — brief, low-volume, no incident opened.  **What happened:** *Observed* — monitor [312930741](https://app.datadoghq.com/monitors/312930741) (count of RUM `@type:error` events on `env:production service:conversational-onboarding` with `@error.message:"Quick reply tap fell through to a no-op"` / `@context.quickReplyUnrecognizedClientAction:*` \> 0 over last 5m) triggered **2026-09-25 22:05:21 UTC** (\~3:05 PM PT); incident.io High alert created 22:06:53 UTC, **acked by Ankur Shivani (primary) at 22:07:17 UTC (\~24 s ack latency)**, resolved 22:12:53 UTC — escalation resolved (P1, routed `@webhook-incidentio-high` via the L2-PENG-Growth path). It did **not** create an incident (`Create incident: false`). Env: **prod** (query scope `env:production`). *Likely cause:* a brief recurrence of the quick-reply routing class from the closed INC-2824 (Aug 7 "Yes, Let's Go" backend/frontend button-text mismatch) — monitor [312930741](https://app.datadoghq.com/monitors/312930741) is that incident's follow-up guardrail (carries the `source:inc-2824` tag). Low volume, self-cleared; the follow-up is to check whether unrecognized quick-reply client actions are trending, not a monitor-tuning change. No customer PII in the payload. |

### Auto-Resolved — Escalation Cancelled

**1 alert auto-resolved this week** (escalation cancelled / no human ack):

- **TL;DR:** [119674469](https://app.datadoghq.com/monitors/119674469) — `service-postman-internal` gRPC average latency briefly crossed the Low Warn threshold on **prod** overnight Sep 23–24; routed low-urgency, no human ack, self-resolved in \~8 min — no customer impact.   
**What happened:** *Observed* — monitor [119674469](https://app.datadoghq.com/monitors/119674469) (`avg(last_10m)` gRPC server latency on `env:prod`, `service:service-postman-internal`, \> 0.5s) crossed Warn; incident.io alert created **2026-09-24 04:28 UTC** (\~9:28 PM PT Sep 23), resolved **2026-09-24 04:36 UTC** (\~9:36 PM PT) — \~8 min. Priority Low, routed `@pagerduty-growth-low-urgency` + `@webhook-incidentio-low`; low-urgency routing did not page anyone awake and no human acked (auto-resolved). Env: **prod** (query scope `env:prod`). *Likely cause:* a brief transient prod gRPC latency blip; self-recovered. No customer impact and no PII in the payload. Unchanged since the Sep 24 refresh — no new activity on this alert.

### Recurring / Flappy Alerts — Monitor Tuning Candidates

| Alert | Times Fired (this week) | Notes |
| --- | --- | --- |
| First Mile Calc SQS backlog — [137629294](https://app.datadoghq.com/monitors/137629294) | 72 (Warn) | Standing `last_5m` oldest-age flapper (SQS `first-mile-new-user-score`); each self-cleared \~1–3 min; 0 incident.io pages. Tuning: add `env:prod` + a 10–15 min sustain. |
| Deactivated-User SQS backlog — [137629364](https://app.datadoghq.com/monitors/137629364) | 28 (Warn \> 60 + Alert \> 90) | Same SQS cluster (`deactivate-user`); crossed Alert a few times but self-cleared in minutes; 0 pages. |
| User-Activation SQS backlog — [137629650](https://app.datadoghq.com/monitors/137629650) | 18 (Warn \> 120 + Alert \> 150) | Same SQS cluster (`prod_statusactivationattempt`); self-cleared \~1 min; 0 pages. No new fires since Sep 25. |
| OTGE CPU throttling — [111957818](https://app.datadoghq.com/monitors/111957818) | 4 (Alert) | svc-earnings OTGE, `env:prod`, CPU CFS throttled ≥ 1 (last\_10m); fired Sep 23 08:43, Sep 24 08:38, Sep 25 08:37 + 08:56 UTC (no new fire Sep 26); self-recovered \~1 min each; Service-Advisor monitor, no notification handles → 0 page. Above the 3-fires/wk bar; infra saturation autoscaling/limits handles. |
| OTGE HPA sustained high util — [111957822](https://app.datadoghq.com/monitors/111957822) | 2 (Warn) | svc-earnings OTGE HPA on `production-eks-cluster` (\~80–82% of max replicas \> 90 sustained); fired Sep 24 09:13 + Sep 25 09:22 UTC; Service-Advisor, no handles → 0 page; self-recovered \~6 min. Same infra-saturation pattern as chronic HPA [135119948](https://app.datadoghq.com/monitors/135119948) — still below the noise bar; watch. |
| OTGE payroll-status anomaly — [112982614](https://app.datadoghq.com/monitors/112982614) (new) | 1 (anomaly) | svc-earnings OTGE anomaly — `notpayrollsetuporpayrollactive` / total OTGE ratio \> 5 deviations for 2 h; fired Sep 25 10:03 UTC, recovered \~12:03 UTC (\~2 h); routes `@slack-alerts-activation` only (0 page). Business-logic anomaly (Activation family, sibling of [112981198](https://app.datadoghq.com/monitors/112981198)) — investigate, do NOT tune. |
| svc-links error rate — [180229880](https://app.datadoghq.com/monitors/180229880) | 2 (P1 Warn) | `svc-links-internal` gRPC `resolveshortlink` error rate \> 10% on `env:prod`; fired **2× this week** — Sep 24 18:59 UTC (\~10 min) and Sep 26 06:04 UTC (\~28 min); routes `@slack-growth-engineering-alerts` + `@svc-cursor-growth-oncall-agent` (Slack, no page) → no incident.io record; the SLO burn-rate [181530102](https://app.datadoghq.com/monitors/181530102) stayed OK. Recurring on the Sep-15 svc-links ownership-transfer surface — confirm Growth ownership/routing; watch for a real error trend vs a min-volume-guard candidate. |

*Every Datadog fire this week is standing SQS-backlog + OTGE flapper noise plus the recurring svc-links Warn (0 incident.io pages); the conversational-onboarding High (a real, acked RUM signal) is in Required Human Attention above and the postman Low is in Auto-Resolved. Full standing-candidate history → the *[Monitor Tuning Ledger](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577/Growth+Team+Ops+Review+Monitor+Tuning+Ledger)*.*

### 🔧 Monitor Tuning Recommendations (learned)

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [135119948](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization | Infra saturation autoscaling handles; pages for a self-resolving condition, incl. off-hours | Chronic (weeks\_seen 12); 0 fires this week; monitor OK | **Route HIGH → LOW / gate to critical.** before: util `> 90` Alert → `@webhook-incidentio-high`. after: route the sustained-utilization branch → `@webhook-incidentio-low`; keep OOM / pod-not-ready at HIGH. Coverage: a real capacity pin still pages High. | high | STRONGLY RECOMMEND |
| [17131362](https://app.datadoghq.com/monitors/17131362) — First Cashout Volume anomaly | Real first-cashout volume drop (NOT monitor noise) | Persists \~50 days (Aug 7 cliff); weeks\_seen 5; monitor quiet | **Do NOT tune → investigate.** after: investigate via the Activation runbook (`kem-tug-987`); rule out an Aug 7 \~15:00 UTC deploy / instrumentation change vs a demand regression; open a Jira fix. | high | STRONGLY RECOMMEND |
| [133647340](https://app.datadoghq.com/monitors/133647340) OOM (+ sibling [133647342](https://app.datadoghq.com/monitors/133647342) mem-util) | Activation dev-leak: a dev-eks OOM used to page prod on-call High | **Validated:** a dev-eks OOM fired Sep 22 and did NOT page prod (handles prod-gated). weeks\_seen 6 | **ACHIEVED / validated.** Minor remaining: add `cluster_flavor:prod` so it stops entering Alert on dev; clear the stale mem-util [133647342](https://app.datadoghq.com/monitors/133647342) dev-eks orphan (query is env:prod-scoped, reads OK). Coverage: prod OOM still pages High. | high (observed diff + fire) | VALIDATED ✓ |
| [137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650) — SQS backlog cluster | Flappy backlog, no env scope / no sustain (Datadog noise; 0 incident.io pages) | Fired 72 / 28 / 18 (118 fires) in \~4 days this week; weeks\_seen 10 / 9 / 9; 0 pages | **Add scope + sustain; verify routing.** before: SQS oldest-age Alert on `last_5m`, no env scope, no sustain. after: add `env:prod` + a sustain ≥ 10–15 min; verify the prod routing branch resolves. Coverage: a sustained real backlog still alerts. | med | RECOMMEND |
| [143509449](https://app.datadoghq.com/monitors/143509449) — funnel-cashout expirations low | Real sustained-low drop; monitor **DELETED by Cashout-infra Sep 22** — removing alerting on a real drop (coverage loss, not a noise fix) | Deleted Sep 22 15:43 UTC; weeks\_seen 6; 1 orphaned incident.io alert still firing (Sep-10), can never auto-resolve | **Superseded by deletion — no monitor tuning to apply.** Clear the orphaned incident.io alert (Sep-10); confirm the deletion was intentional; the underlying funnel-cashout-expiration drop (tied to first-cashout) still needs an Activation investigation now its monitor is gone. | high (observed delete) | RESOLVED (DELETED) |

*Top 5 by expected impact; **full history (30 rows) →*** [Monitor Tuning Ledger](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577/Growth+Team+Ops+Review+Monitor+Tuning+Ledger)*. Carried across the week; weeks\_seen holds until the next Tue handoff (2026-09-29). Watch-list this week (tracked to the ledger at the Sep 29 roll): svc-links error-rate [180229880](https://app.datadoghq.com/monitors/180229880) now fired 2× (recurring); OTGE CPU [111957818](https://app.datadoghq.com/monitors/111957818) holds at 4 (above the 3/wk bar); the new payroll-status anomaly [112982614](https://app.datadoghq.com/monitors/112982614) and the conversational-onboarding guardrail [312930741](https://app.datadoghq.com/monitors/312930741) are real signals to investigate, not tune.*

### 🔴 Open Going Into Handoff

**Active — Datadog Alert/Warn now: 0.** No Growth monitor reads Alert/Warn (`search_datadog_monitors team:l2-peng-growth status:(alert OR warn)` → none). The SQS/OTGE/svc-links flapper crossings, the conversational-onboarding High, and the postman Low all self-recovered.

**Stale / lingering incident.io alerts: 5** (re-verified this run via `alert_stats` — 4 High + 1 Low; the `alert_list` attribute filter under-returns some, but `alert_stats` + `alert_show` confirm all 5 still firing; most-recent firing alert created Sep 10, so no new stale this week). None is an active prod problem; each needs a manual clear:

- Funnel-cashout expirations low ([143509449](https://app.datadoghq.com/monitors/143509449)) — High, firing since 2026-09-10 03:24 UTC. **Orphaned — the monitor was deleted Sep 22 15:43 UTC**, so it can no longer auto-resolve; clear manually.
- Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — High \[P2\], since 2026-06-03; Datadog No Data. Real code bug → Jira + clear.
- Duplicate funnel cashout ([143507582](https://app.datadoghq.com/monitors/143507582)) — Low \[P4\], since 2026-07-23; same bug.
- Activation mem-util ([133647342](https://app.datadoghq.com/monitors/133647342)) — High, dev-eks group since 2026-05-29; Datadog monitor is `env:prod`-scoped and reads OK — the dev-eks alert is a lingering orphan; clear it.
- Databricks "Promotions Metrics Processor Job Failed" — High, since 2025-12-17; no live Datadog monitor. Verify the job + clear.

**0 active paging issues; 5 stale incident.io alerts to clear** (re-verified) — not a clean handoff until those are cleared. The [143509449](https://app.datadoghq.com/monitors/143509449) alert is orphaned by the monitor deletion and can only be cleared manually.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** **42 open** via [filter 15295 / OOSLA](https://earnin.atlassian.net/issues/?filter=15295) (org-wide, as of 2026-09-26 10:12 AM PT) — 28 CRITICAL / 13 HIGH by ticket summary prefix, plus 1 security ticket with no severity prefix (CORS misconfig `WEBPLAT-1489`, In Review). **Down 4 vs Sep 25 (46)** — the drop is entirely in Critical (32 → 28); High is flat at 13. Secrets-detection findings dominate the Critical set and SCA dependency CVEs dominate High (composition shifts intraday). Severity is read from the ticket summary prefix (the Jira priority field is uniformly "Low"); secrets tickets carry generic titles (no values). **org-wide** scope (no Growth-owned ticket). *Count is volatile intraday.*

**Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

* [ ] **Clear the 5 stale incident.io alerts** — re-verified via `alert_stats` (4 High + 1 Low). The funnel-cashout orphan ([143509449](https://app.datadoghq.com/monitors/143509449), firing since Sep 10) can no longer auto-resolve (monitor deleted Sep 22 15:43 UTC) — clear manually and confirm the deletion was intentional; the real funnel-cashout-expiration drop now has no monitor → re-cover or fold into the Activation investigation.
* [ ] **Investigate the conversational-onboarding quick-reply failure** ([312930741](https://app.datadoghq.com/monitors/312930741)) — the INC-2824 guardrail fired and was acked (Ankur, \~24 s) Fri Sep 25 22:05 UTC. Check whether unrecognized quick-reply client actions / no-op taps are trending in `svc-conversational-onboarding` RUM (a possible recurrence of the Aug button-text-mismatch class); investigate, do NOT tune the monitor.
* [ ] **Confirm the **`svc-links-internal`** ownership transfer is intended** (21 prod monitors moved into `team:l2-peng-growth` on Sep 15). Error-rate [180229880](https://app.datadoghq.com/monitors/180229880) now fired **2× this week** (Sep 24 \~10 min, Sep 26 \~28 min, Slack-only); SLO burn-rate [181530102](https://app.datadoghq.com/monitors/181530102) fired once Sep 17. Verify Growth on-call routing / coverage and whether resolveshortlink errors are a real trend.
* [ ] **Keep the incident.io connector authenticated** — it recovered Sep 22 after 6 down runs (Sep 16–22); the whole prior on-call week ran without alert enrichment. Watch for another needs-auth lapse.
* [ ] **Triage the svc-referral prod Apdex breach** from last week ([27555488](https://app.datadoghq.com/monitors/27555488)) — fired Sun Sep 20 10:44 UTC (\~3:44 AM PT), paged primary Nabi, escalation cancelled on a \~2-min self-resolve. Check APM traces/logs and any Sep 20 deploy; if it recurs, require ≥ 2 consecutive windows before paging.
* [ ] **Escalate the first-cashout volume drop** (\~50 days below baseline) via the Activation runbook / dashboard kem-tug-987 ([17131362](https://app.datadoghq.com/monitors/17131362)); check the Aug 7 \~15:00 UTC cliff (deploy vs demand); open a Jira fix. Do NOT tune the monitor.
* [ ] **Route the Activation funnel-anomaly cluster to one investigation** (registration-completion [143518919](https://app.datadoghq.com/monitors/143518919); good-to-go [143516414](https://app.datadoghq.com/monitors/143516414); funnel-promotion [136473965](https://app.datadoghq.com/monitors/136473965); OTGE active-status anomaly [112981198](https://app.datadoghq.com/monitors/112981198); new OTGE payroll-status anomaly [112982614](https://app.datadoghq.com/monitors/112982614)) — anomalies echoing the funnel-cashout / first-cashout drop. Investigate, do NOT tune.
* [ ] **Tune the SQS backlog cluster** ([137629294](https://app.datadoghq.com/monitors/137629294) / [137629364](https://app.datadoghq.com/monitors/137629364) / [137629650](https://app.datadoghq.com/monitors/137629650), \~118 fires in \~4 days this week): add `env:prod` + a 10–15 min sustain; verify the prod routing branch resolves.
* [ ] **Tune HPA **[135119948](https://app.datadoghq.com/monitors/135119948): route HIGH → LOW (or gate to critical-only); keep OOM / pod-not-ready at HIGH. Chronic (weeks\_seen 12). Watch the OTGE HPA [111957822](https://app.datadoghq.com/monitors/111957822) (same pattern, 2 fires this week — still below the noise bar) and OTGE CPU [111957818](https://app.datadoghq.com/monitors/111957818) (4 fires, non-paging).
* [ ] **Close out the Activation OOM routing fix** ([133647340](https://app.datadoghq.com/monitors/133647340), validated): optionally add `cluster_flavor:prod`; clear the stale mem-util dev-eks orphan [133647342](https://app.datadoghq.com/monitors/133647342).
* [ ] Open a Jira code fix for the duplicate funnel-cashout bug ([143507582](https://app.datadoghq.com/monitors/143507582)) and clear its 2 stale alerts (High + Low) once shipped; verify + clear the stale Databricks "Promotions Metrics Processor Job Failed" alert (\~9 months).
* [ ] Review open vulnerability tickets — 42 open (28 Critical / 13 High + 1 unlabeled), org-wide; down 4 vs Sep 25 (all in Critical), High flat at 13.

## 📝 Manual Notes (preserved across refreshes)

*Add notes here; they survive daily refreshes.*

---

*Generated by the Growth Team Ops Review agent. Window: 2026-09-22 11:00 → 2026-09-29 11:00 America/Mexico\_City (week-to-date; live, refreshed daily until it freezes at the Sep 29 handoff). Last refreshed: 2026-09-26 10:12 AM PT. Sources: incident.io (read-only) + Datadog (read-only) + Jira (vulnerabilities). Customer identifiers redacted where present (none required this run). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent.*
