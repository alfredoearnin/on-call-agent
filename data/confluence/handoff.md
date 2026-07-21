🔄 **Live page** — refreshed daily during the on-call week (2026-07-21 → 2026-07-28). Last refreshed **2026-07-21 08:01 AM PT (America/Los_Angeles)**. This page freezes at the Tuesday handoff (2026-07-28); a new page opens for the next week.

# Growth Team Ops Review — Weekly Handoff

**07/21/2026 Growth Team Ops Review** · On-call week **Tue 2026-07-21 00:00 → Tue 2026-07-28 00:00 (America/Los_Angeles)**, reported **week-to-date (window start → now, \~8 hours in)**. Source: incident.io + Datadog, read-only. **Last refreshed: 2026-07-21 08:01 AM PT (America/Los_Angeles).**

_This on-call week — primary: **aiden.ramgoolam**; secondary: **Edder Núñez** (shift Tue 2026-07-21 10:00 PT → Tue 2026-07-28 10:00 PT). The weekly handoff completes at 10:00 PT today; until then the outgoing on-call (Alfred primary / aiden.ramgoolam secondary) covers the final hours. Verified via incident.io schedule this run._

## SLOs / SLAs (15 minutes)

* [Consolidated PENG-Growth Ops Dashboard (Datadog)](https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard)
* [PENG Bugs OOSLA (Jira)](https://earnin.atlassian.net/jira/dashboards/10779)
* [Vulnerabilities (Jira)](https://earnin.atlassian.net/issues/?filter=15295)

**Auto-generated alert-volume summary (week-to-date, \~8 hours into the new on-call week).** incident.io paging alerts: **0 so far**. Prior full week (Jul 14 → Jul 21, just closed): **5 (3 High, 2 Low)** — all resolved. Trend: **too early to call** (only \~8 h into the week; a run-rate needs ≥1 day elapsed to be meaningful). Human-attention: **0** | Auto-resolved: **0**. Escalation rate (alerts → incidents): **0/0 (n/a yet)**. Still firing: **0 active / 3 stale** (incident.io) — 3 carryover stale alerts (see Open Going Into Handoff); no Growth monitor is in Alert/Warn at refresh time. _Priority = monitor severity (High/Low); Warn/Alert = trigger level — a High-priority monitor can fire only at Warn._

## Incidents (15 minutes)

### Production Incidents — Customer Impact

No production incidents this week.

### Operational Incidents — Deploys / Data Repairs / Infra

No operational incidents this week.

## incident.io Alerts / Monitoring (15 minutes)

### Required Human Attention — Acknowledged by oncall

No alerts required human attention this week (the on-call week just opened \~8 h ago).

### Auto-Resolved — Escalation Cancelled

No alerts auto-resolved this week (the on-call week just opened \~8 h ago).

### Recurring / Flappy Alerts — Monitor Tuning Candidates

No recurring/flappy alerts this week yet (the on-call week just opened). Standing cross-week candidates carried from the [Monitor Tuning Ledger](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577) are summarized in the learned recommendations below.

### 🔧 Monitor Tuning Recommendations (learned)

Learned, **read-only** suggestions carried into the new week from the [Monitor Tuning Ledger](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577). **Nothing here is auto-applied** — each row is a one-click `before → after` for a human to action in the monitor UI. Feedback loop at week open (**2026-07-21**): all diffable monitor configs (the six with standing recommendations — `135119948`, `133647342`, `143507582`, `17131362`, `137629294`, `27555488` — plus last week's new candidates `243692163`, `243692043`, `143557417`) remain **unchanged** vs their recorded before-state, so none has been applied (**no validation win** carried in). The top three stay **strongly recommend** (multi-week streaks, zero human action). Showing the top 5 by expected on-call impact; full cross-week history in the ledger.

| Monitor | Issue | Evidence (fires / weeks / auto-res) | Recommended change (before → after) | Confidence | Status |
| --- | --- | --- | --- | --- | --- |
| [**135119948**](https://app.datadoghq.com/monitors/135119948) — HPA sustained high utilization (job-user-setup-user-first-mile-calc-processor, env:prod) | Infra saturation that autoscaling already handles — a High page that self-resolves in minutes with no incident. Also a Warn transition paging like a critical page. | 0 fires this wk (week just opened); last fired Jul 16 (Warn 82.3%, acked by Alfred, self-resolved \~11 min, no incident); recurring \~3 wks; 0 incidents. | **Route HIGH → LOW (and/or gate the page to critical-only).** before: sustained-utilization >90 Alert / \~80 Warn → `@webhook-incidentio-high` + `@pagerduty-Activation-Alerts` (prod branch); a Warn transition pages the same as Alert. after: route the sustained-utilization branch → `@webhook-incidentio-low` (or scope the page handle to `is_alert`/critical only so Warn stops paging); keep OOM / pod-not-ready at HIGH; optional HIGH guard only if util >90% sustained >15 min. _Coverage preserved:_ a genuine capacity pin still pages HIGH. _Impact:_ removes \~2–3 interrupt-grade High pages/wk. | High — 3-wk streak, fired + human-acked last wk, 100% self-resolve, 0 incidents. | <custom data-type="status" data-id="id-0">strongly recommend</custom> |
| [**133647342**](https://app.datadoghq.com/monitors/133647342) — \[job-user-user-activation-processor\] sustained high memory utilization | Dev noise paging the prod High path + stale — a dev-eks-cluster group has been firing in incident.io since May 29 while prod reads OK. | Firing \~7 wks (since 2026-05-29), dev-eks-cluster group; Datadog OK on prod; 1 stuck High alert (01KST6RVJA…); 0 new fires. | **Scope out dev + clear the orphan.** before: mem-util ≥85% grouped by `kube_cluster_name`, `env:prod` — a dev-cluster group can still hold the prod High page open. after: exclude non-prod (add `cluster_flavor:prod` / `!kube_cluster_name:dev-eks-cluster`), route any dev branch to a dev Slack; then manually resolve the orphaned dev alert. _Coverage preserved:_ prod memory-utilization still pages High. _Impact:_ clears 1 stuck High and stops dev memory pressure paging prod on-call. | High — clear dev-scope leak; prod reads OK. | <custom data-type="status" data-id="id-1">strongly recommend</custom> |
| [**143507582**](https://app.datadoghq.com/monitors/143507582) — CM has requested more than one funnel cashout (job-cashout-user-cashout-status-processor) | Recurring REAL failure, not monitor noise — a duplicate funnel-cashout code/business-logic bug. The alert is also stuck firing (Datadog No Data). | Firing \~6 wks (since 2026-06-03); Datadog No Data; 1 stuck High alert (01KT752A…); 0 new fires. | **Do NOT tune — route to a Jira code fix.** before: monitor left as-is (it is catching a real condition). after: open/track a Jira fix for the duplicate funnel-cashout bug (runbook SRE/3082453072); once shipped, resolve or mute the stale alert. _Coverage preserved:_ monitor unchanged, so it keeps catching duplicates. _Impact:_ eliminates a recurring High and a months-old stuck alert. (Monitor SQL uses a `userid` placeholder — no customer value rendered.) | High — it is a bug, not noise (runbook + recurring since Jun 3). | <custom data-type="status" data-id="id-2">strongly recommend</custom> |
| [**243692163**](https://app.datadoghq.com/monitors/243692163) — svc-notification-preferences high p90 latency (env:prod) | Warn transition paging like a critical page — a High page fired at the Warn threshold (\~0.8s p90) even though the critical threshold is p90 > 1s, because the page handle is unconditional. Double-alerts with the Low avg monitor on one blip. | 0 fires this wk (week just opened); last fired Jul 19 (Sunday, Warn \~0.8s, acked by Alfred, self-resolved \~9 min, no incident); week 2 of tracking. | **Gate the page to critical-only (or split Warn → Low).** before: `avg(last_10m) p90:trace.aspnet_core.request{env:prod,service:svc-notification-preferences} > 1` Alert / \~0.8 Warn → `@webhook-incidentio-high` unconditionally, so a Warn crossing pages High. after: wrap the `@webhook-incidentio-high` handle in `{{#is_alert}}` so only the p90 > 1s crossing pages High, and route the Warn tier → Slack/Low (or drop it). _Coverage preserved:_ a real p90 > 1s latency emergency still pages High. _Impact:_ stops Warn-level latency blips from paging on-call. _Routing fix — no threshold change required._ | Med — clear routing gap (Warn pages High); 1 occurrence so far → "consider". | <custom data-type="status" data-id="id-3">proposed</custom> |
| [**27555488**](https://app.datadoghq.com/monitors/27555488) — svc-referral has an abnormal change in Apdex (env:prod) | Transient overnight Apdex dip paging High — a 1-min self-resolving blip at low-traffic hours, no incident. Apdex is volatile when overnight request volume is low. | 0 fires this wk (week just opened); last fired Jul 16 (04:02 PT, auto-resolved \~1 min, no ack, no incident); OK at refresh. | **Debounce and/or add a volume guard (or route transient dips to Low).** before: `avg(last_5m) trace…apdex{env:prod,service:svc-referral} < 0.9` → HIGH (`@pagerduty-Referral` + `@webhook-incidentio-high`). after: (a) require the breach to be sustained — `last_5m` → `last_15m` or ≥2 consecutive eval windows; and/or (b) add a minimum request-volume guard (**needs baseline — verify typical overnight request volume first**); or (c) route sub-15-min transient dips → Slack/Low, keep HIGH for sustained degradation. _Coverage preserved:_ a sustained real Apdex degradation still pages High. _Impact:_ removes overnight High pages from 1-min self-resolving blips. | Low — single fire last wk, no recurrence yet; escalate if it recurs. | <custom data-type="status" data-id="id-4">proposed</custom> |

_Also tracked in the_ [_ledger_](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577) _(below the weekly top 5): the Databricks Promotions-Metrics stale High (recommend — also in Open Going Into Handoff), the_ `143557417` _cashout-attempt-restore error-rate ratio (add_ `env:prod` _+ a min-volume guard; Low), the_ `243692043` _svc-notification-preferences avg-latency companion (Low), the first-cashout anomaly_ `17131362` _(quiet all of last week incl the weekend → tuning de-prioritized; moves to resolved if quiet through this week), the Datadog-only first-mile-calc backlog_ `137629294`_, and the_ `svc-mark-tech` _baseline-monitor ownership review. All recommendations are advisory — no monitor was changed by this agent._

### 🔴 Open Going Into Handoff

**Active prod Alert/Warn now: 0.** No Growth-owned monitor (prod or non-prod) is in Alert/Warn at refresh time.

**Stale / lingering incident.io alerts: 3** (carried from prior weeks; each alert's Datadog source reads No Data/OK, consistent with a stale carryover rather than active prod work):

* **Monitor 143507582 — "CM has requested more than one funnel cashout"** (<custom data-type="status" data-id="id-5">High</custom>). incident.io alert 01KT752A4WBQQ6AKYNP8AB4AD6, firing since 2026-06-03. Datadog: <custom data-type="status" data-id="id-6">NO DATA</custom>. Duplicate-cashout code bug → Jira fix + resolve/mute (see tuning recommendation above).
* **Monitor 133647342 — "\[job-user-user-activation-processor\] sustained high memory utilization"** (<custom data-type="status" data-id="id-7">High</custom>). incident.io alert 01KST6RVJA4YYGHZS07M0N1T7V, firing since 2026-05-29 on `dev-eks-cluster` (non-prod). Datadog: <custom data-type="status" data-id="id-8">OK</custom> on prod. Orphaned dev-cluster fire → clear it; no prod action (see tuning recommendation above).
* **Databricks "Promotions Metrics Processor Job" — run failed** (workspace earnin-prod, <custom data-type="status" data-id="id-9">High</custom>). incident.io alert 01KCMWX2WHXP5F7R8KHHG3693E, firing since 2025-12-17 (>6 months). No live Datadog monitor. Verify the job has since succeeded → resolve.

**Handoff status:** **No active prod issues; 3 stale incident.io alert(s) to clear** (all carryover from prior weeks). No active prod (or non-prod) alert at refresh time.

## Vulnerabilities, Velocity and Operational Costs (15 minutes)

**Vulnerabilities:** **23 open tickets** (org-wide scope; count as of 2026-07-21 08:01 AM PT via Jira filter 15295, `statusCategory != Done`) — **8 Critical, 15 High**. Unchanged since the Jul 20 midday snapshot (23). Criticals (8): **5** `golang.org/x/crypto` + 1 `@xhmikosr/decompress` (debit-card-uploader, WEBPLAT-1380) + 2 `websocket-driver`. High (15): SCA dependency advisories — `axios` ×2, `undici` ×2, `picomatch`, `drizzle-orm`, `python-multipart` ×2, `starlette`, `cryptography`, `pyjwt` — plus 4 SAST unsanitized-file-path findings. No `svc-referral`/PENG-Growth-owned ticket is in the set; the Growth-scoped matches are all **High** SCA advisories — `svc-conversational-onboarding` (`python-multipart` CVE-2026-53539, `starlette` CVE-2026-48818, `cryptography` GHSA-537c-gmf6-5ccf, `pyjwt` CVE-2026-48526) and `svc-growth-ai-ops` (`python-multipart`). [Vulnerabilities (Jira filter 15295)](https://earnin.atlassian.net/issues/?filter=15295). Scope is org-wide, not Growth-specific; the Jira "priority" field reads Low on all — severity is the summary prefix (\[VM,SCA/SAST\] Critical/High). **Velocity:** TBD. **Operational Costs:** TBD.

## Velocity and Automation

TBD.

## Action Items

- [ ] **Review the 🔧 Monitor Tuning Recommendations (top 5) and the** [**Monitor Tuning Ledger**](https://earnin.atlassian.net/wiki/spaces/~712020cb7ebe6a714e411e98574e2fb19d5faa/pages/5322604577) — all read-only `before → after` suggestions; none applied yet. Highest impact first: (1) route HPA `135119948` High → Low; (2) scope `133647342` out of dev and clear the orphaned alert; (3) open a Jira code fix for the duplicate-cashout bug `143507582`. Apply in the monitor UI if you agree — the agent never changes monitors.
- [ ] **svc-notification-preferences p90 latency** (monitor 243692163): Warn-level p90 (\~0.8s) paged High last Sunday because `@webhook-incidentio-high` is unconditional. Gate the page to critical-only (`{{#is_alert}}`, i.e. p90 > 1s) and route the Warn tier to Slack/Low; the Low avg companion `243692043` already covers the softer signal. Routing fix — no threshold change needed.
- [ ] **cashout-attempt-restore error-rate** (monitor 143557417): Low alert auto-resolved \~4 min overnight last week (no ack). Add `env:prod` scope + a minimum-volume guard (require a floor of SQS `hits` before the errors/hits ratio can alert) so a few errors at low volume don't trip 25%. If the error burst is real, file a Jira for the processor.
- [ ] **first-mile-calc HPA** (monitor 135119948): route High → Low (or gate the page to critical-only so Warn stops paging), keep OOM / pod-not-ready at High; also review HPA `max_replicas` / scaling targets (HPA Quick Hitter runbook).
- [ ] **svc-referral Apdex night page** (monitor 27555488): consider a sustain window (`last_5m` → `last_15m` or ≥2 consecutive windows) and/or a minimum request-volume guard (verify overnight baseline first), or route transient dips to Low; keep High for sustained degradation.
- [ ] **Key watch — first-cashout-volume anomaly** (monitor 17131362): quiet all of last week including the full Jul 18–20 weekend (0 fires; flapped 13× two weeks ago). If quiet through this week → mark resolved; a weekend re-fire reopens the question. Confirm on activation dashboard `kem-tug-987`.
- [ ] **Clear stale: duplicate funnel cashout** (monitor 143507582 / alert 01KT752A4WBQQ6AKYNP8AB4AD6): firing since Jun 3, Datadog No Data. Open/track a Jira code fix per the runbook, then resolve or mute.
- [ ] **Clear stale: dev-cluster memory alert** (monitor 133647342 / alert 01KST6RVJA4YYGHZS07M0N1T7V): firing since May 29 on dev-eks-cluster (non-prod); prod OK. Manually resolve — no prod action.
- [ ] **Clear stale: Databricks Promotions-Metrics alert** (01KCMWX2WHXP5F7R8KHHG3693E): firing since Dec 17 2025. Verify the job has since succeeded, then resolve.
- [ ] **Investigate the incident.io auto-resolution gap**: three High alerts remain firing weeks/months after their Datadog sources recovered. Re-check the webhook auto-resolve path and clear the backlog.
- [ ] **Fix svc-mark-tech baseline-monitor tagging / ownership** (301972959 / 301972960 / 301972961): tagged `team:l2-peng-growth` but service `svc-mark-tech`. Confirm correct team ownership and whether non-prod should alert; re-tag or scope to `env:prod` as appropriate.
- [ ] **Vulnerabilities at 23 open org-wide (8 Critical, 15 High)**: prioritize the `golang.org/x/crypto` Critical cluster (5), the `@xhmikosr/decompress` Critical (WEBPLAT-1380), and the 2 `websocket-driver` Criticals; triage the remaining High SCA advisories including the Growth-scoped `svc-conversational-onboarding` set (python-multipart, starlette, cryptography, pyjwt) and `svc-growth-ai-ops` (python-multipart), via filter 15295 / OOSLA dashboard.

## 📝 Manual Notes (preserved across refreshes)

_Add notes here; they survive daily refreshes._

---

_Generated by the Growth Team Ops Review agent. Window: 2026-07-21 00:00 → 2026-07-28 00:00 America/Los_Angeles (week-to-date). Last refreshed: 2026-07-21 08:01 AM PT. Sources: incident.io (read-only) + Datadog (read-only) (+ Jira for vulnerabilities). Monitor tuning recommendations are advisory only — full history in the Monitor Tuning Ledger. No customer PII was present in the rendered payloads (monitor SQL uses a userid placeholder, not customer data). You can read #growth-engineering-alerts for more information. No monitoring configuration was changed by this agent._
