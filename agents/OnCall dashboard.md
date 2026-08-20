You maintain the data for the on-call Ops dashboard. The repo is checked out and dependencies are installed (a local `.env` with DATABASE_URL is created during setup).

## Retry before giving up

Every step below touches the network or another process, and any of them can fail
for a reason that is gone a minute later. When one does, retry **that operation in
place**. Never restart the run from step 1 — earlier steps have already written
files, commits, and possibly a PR, and redoing them is how you end up with two
branches for the same day.

- **Attempts:** 3 per operation (first try + 2 retries).
- **Backoff:** wait 30s before the 2nd attempt, 90s before the 3rd. On a
  `needsAuth` error, call `mcp_auth` for that one server before retrying.
- **Retry only transient failures:** timeouts, network errors, HTTP 429, HTTP 5xx,
  `needsAuth`, and git/`gh` errors naming a lock, a network problem, or a race with
  another push (`fetch first`, `non-fast-forward`).
- **Do not retry a deterministic failure.** A malformed request, a validation
  error, a 404 for a page that genuinely does not exist, or an `npm run ingest`
  that fails the same way twice will fail identically on attempt 3 — retrying only
  burns the run. Report it instead.
- **Exhausted retries end the run as FAILED**, with the exact error. Never finish
  claiming a success you did not verify.

## Resume, do not duplicate

A retry — or a manual re-run after a failed run earlier the same day — must never
leave two branches or two PRs for one date. Before creating either, look for
today's and adopt it. Only create when the lookup comes back empty. Steps 6a and
6c below do this explicitly; keep that shape.

Do this:
1. Using the Atlassian MCP, find the CURRENT "Growth Team Ops Review — Weekly Handoff" page in Confluence — the most recently created page whose title starts with "Growth Team Ops Review — Weekly Handoff" (they live under the Growth Team Ops Review folder, id 5261557762). Fetch its body as Markdown (contentFormat: markdown).
2. Preserve history on week rollover: if `data/confluence/handoff.md` already exists and its on-call week window ("On-call week … → …") is OLDER than the page you fetched, first copy the existing file to `data/confluence/handoff-<oldWeekStartYYYY-MM-DD>.md` so the previous week stays in the dashboard.
3. Write the fetched Markdown to `data/confluence/handoff.md`.
4. Run `npm run ingest` and confirm it prints `status=success`. This rebuilds `prisma/oncall.db` from the Markdown. If it does not print `status=success`, retry once; if it fails the same way twice the parse is genuinely broken, so STOP and report — publishing a database built from a failed ingest is worse than publishing nothing.
5. If `git status` shows no changes under `data/confluence/` or `prisma/oncall.db`, there is nothing new to write — but do not stop before checking for an orphan left by a failed run earlier today:
   `gh pr list --state open --search "Daily refresh $(date +%Y-%m-%d) in:title" --json number -q '.[0].number'`
   If that returns a PR, its content is already correct and only the merge failed: skip to step 6d and merge it. If it returns nothing, stop — do not create an empty commit or PR.
6. Otherwise, publish and MERGE the change immediately. Do not use auto-merge (`--auto`) and never leave a draft PR open. Run these steps in order, using the shell:

   a. Make sure main is current, then get onto today's branch — ADOPTING it if an
      earlier attempt already pushed one, so a retry never forks a second branch:
      git fetch origin
      git checkout main && git pull --ff-only origin main
      BR="cursor/daily-refresh-$(date +%Y-%m-%d)"
      if git ls-remote --exit-code --heads origin "$BR" >/dev/null 2>&1; then
        git checkout -B "$BR" "origin/$BR"   # resume the earlier attempt
      else
        git checkout -B "$BR" main
      fi

   b. Commit only the data files. On an adopted branch the commit may already be
      there, so an empty commit is a no-op, NOT a failure — carry on to (c):
      git add data/confluence/*.md prisma/oncall.db
      git diff --cached --quiet || git commit -m "Daily refresh $(date +%Y-%m-%d)"
      git push -u origin "$BR"

   c. Reuse today's PR if one is already open, else open a NON-draft one (never
      pass --draft). Opening a second PR for the same branch is the failure this
      lookup exists to prevent:
      PR=$(gh pr list --head "$BR" --state open --json number -q '.[0].number')
      if [ -z "$PR" ]; then
        PR=$(gh pr create --base main --head "$BR" --title "Daily refresh $(date +%Y-%m-%d)" --body "Automated daily Confluence handoff refresh." | grep -oE '[0-9]+$')
      fi

   d. Force it out of draft and confirm, then merge SYNCHRONOUSLY (no --auto):
      gh pr ready "$PR" || true
      gh pr merge "$PR" --squash --delete-branch

   e. If the merge is rejected because the PR is not mergeable (conflicts with main from a
      previous day's refresh), resolve **only the two data paths** in favour of this branch
      and retry. NEVER use a tree-wide strategy like `-X ours`, and never `git add -A`: this
      automation merges to main unattended every day, so either one would silently discard
      somebody else's source-code change. Abort instead — a failed refresh is recoverable,
      a lost commit is not:
      git fetch origin main
      if ! git merge origin/main -m "Merge main into $BR"; then
        git checkout --ours -- data/confluence prisma/oncall.db
        git add -- data/confluence prisma/oncall.db
        # Anything still conflicting is outside this automation's scope.
        if [ -n "$(git diff --name-only --diff-filter=U)" ]; then
          echo "Unexpected conflict outside data paths:"; git diff --name-only --diff-filter=U
          git merge --abort
          exit 1
        fi
        git commit --no-edit
      fi
      git push origin "$BR"
      gh pr merge "$PR" --squash --delete-branch

   f. VERIFY it landed. Run `gh pr view "$PR" --json state,isDraft -q '.state + " draft=" + (.isDraft|tostring)'`.

      If state is not "MERGED", do NOT report failure yet — diagnose, then retry
      the merge, up to 3 merge attempts in total:
      gh pr view "$PR" --json isDraft,mergeable,mergeStateStatus,statusCheckRollup
      - `isDraft: true`      → `gh pr ready "$PR"`, then merge again.
      - `mergeable: CONFLICTING` → apply step (e), then merge again.
      - `mergeStateStatus: BLOCKED` or a check still pending → wait 60s and merge
        again; a required check that is merely slow is the most common cause.
      - anything else → wait 30s and merge again.

      Only after the 3rd attempt still leaves it unmerged has the task FAILED.
      Then report: the PR URL, its `state`, `mergeable`, `mergeStateStatus`, and
      the exact error text from the last `gh pr merge`. Do not finish claiming
      success, and do not describe a merged-but-unverified PR as landed.

7. Never create draft PRs and never rely on auto-merge — every run must end with the PR in state MERGED on `main`.

Constraints: only modify `data/confluence/*.md` and `prisma/oncall.db`. Do not change source code. Do not print secrets. The handoff contains no customer PII (monitor IDs and userid placeholders only).

---

## Why the merge is synchronous (do not "simplify" this back)

Earlier revisions used `gh pr merge --auto` and PRs piled up unmerged (see #16–#28).
Two failure modes drove that:

- **Drafts.** The background agent opens PRs as drafts by default, and `--auto` never
  merges a draft. Step d forces `gh pr ready` and asserts the state afterwards.
- **Conflicts.** Every refresh rewrites the same two files (`data/confluence/handoff.md`
  and `prisma/oncall.db`). Once two PRs are open, both go `CONFLICTING` against `main`
  and auto-merge waits forever. Step a branches from fresh `main` and step e resolves in
  favour of the PR branch — but **only for those two paths**, so a concurrent
  source-code change on `main` is never discarded.

That last clause is why step e must not use `-X ours` or `git add -A`. This automation
merges to `main` unattended every day; a tree-wide strategy would silently drop somebody
else's commit. A failed refresh is recoverable, a lost commit is not.

The agent's `gh` token needs write/merge access to the repo; a permissions failure at
step d cannot be fixed by prompt changes.
