# `daily-refresh.md` — prompt for the "On-call dashboard — daily refresh" automation

This file is **not documentation — it is the prompt** run by the *On-call dashboard —
daily refresh* Cursor Automation. It fetches the current Confluence handoff page,
rebuilds `prisma/oncall.db`, and lands the result on `main`.

Keep this copy in sync with the automation's *Agent Instructions* (the cloud agent does
not read this repo).

---

## Prompt

You maintain the data for the on-call Ops dashboard. The repo is checked out and dependencies are installed (a local `.env` with DATABASE_URL is created during setup).

Do this:

1. Using the Atlassian MCP, find the CURRENT "Growth Team Ops Review — Weekly Handoff" page in Confluence — the most recently created page whose title starts with "Growth Team Ops Review — Weekly Handoff" (they live under the Growth Team Ops Review folder, id 5261557762). Fetch its body as Markdown (contentFormat: markdown).
2. Preserve history on week rollover: if `data/confluence/handoff.md` already exists and its on-call week window ("On-call week … → …") is OLDER than the page you fetched, first copy the existing file to `data/confluence/handoff-<oldWeekStartYYYY-MM-DD>.md` so the previous week stays in the dashboard.
3. Write the fetched Markdown to `data/confluence/handoff.md`.
4. Run `npm run ingest` and confirm it prints `status=success`. This rebuilds `prisma/oncall.db` from the Markdown.
5. If `git status` shows no changes under `data/confluence/` or `prisma/oncall.db`, stop — do not create an empty commit or PR.
6. Otherwise, publish and MERGE the change immediately. Do not use auto-merge (`--auto`) and never leave a draft PR open. Run these steps in order, using the shell:

   a. Make sure main is current and branch from it:

   ```bash
   git fetch origin
   git checkout main && git pull --ff-only origin main
   BR="cursor/daily-refresh-$(date +%Y-%m-%d)"
   git checkout -B "$BR"
   ```

   b. Commit only the data files:

   ```bash
   git add data/confluence/*.md prisma/oncall.db
   git commit -m "Daily refresh $(date +%Y-%m-%d)"
   git push -u origin "$BR"
   ```

   c. Open a NON-draft PR (do not pass `--draft`):

   ```bash
   PR=$(gh pr create --base main --head "$BR" \
     --title "Daily refresh $(date +%Y-%m-%d)" \
     --body "Automated daily Confluence handoff refresh." | grep -oE '[0-9]+$')
   ```

   d. Force it out of draft and confirm, then merge SYNCHRONOUSLY (no `--auto`):

   ```bash
   gh pr ready "$PR" || true
   gh pr merge "$PR" --squash --delete-branch
   ```

   e. If the merge is rejected because the PR is not mergeable (conflicts with main from a previous day's refresh), resolve **only the two data paths** in favour of this branch and retry. Never use a tree-wide strategy like `-X ours` — it would silently discard someone else's source-code change from `main`:

   ```bash
   git fetch origin main
   if ! git merge origin/main -m "Merge main into $BR"; then
     git checkout --ours -- data/confluence prisma/oncall.db
     git add -- data/confluence prisma/oncall.db
     # Anything else still conflicting is out of scope for this automation.
     if [ -n "$(git diff --name-only --diff-filter=U)" ]; then
       echo "Unexpected conflict outside data paths:"; git diff --name-only --diff-filter=U
       git merge --abort
       exit 1
     fi
     git commit --no-edit
   fi
   git push origin "$BR"
   gh pr merge "$PR" --squash --delete-branch
   ```

   f. VERIFY it landed:

   ```bash
   gh pr view "$PR" --json state,isDraft -q '.state + " draft=" + (.isDraft|tostring)'
   ```

   If state is not `MERGED`, the task FAILED — report the exact error; do not finish claiming success.

7. Never create draft PRs and never rely on auto-merge — every run must end with the PR in state MERGED on `main`.

Constraints: only modify `data/confluence/*.md` and `prisma/oncall.db`. Do not change source code. Do not print secrets. The handoff contains no customer PII (monitor IDs and userid placeholders only).

---

## Why the merge is synchronous

Earlier revisions used `gh pr merge --auto` and PRs piled up unmerged (see #16–#28).
Two failure modes drove that:

- **Drafts.** The background agent opens PRs as drafts by default, and `--auto` never
  merges a draft. Step 6d forces `gh pr ready` and asserts the state afterwards.
- **Conflicts.** Every refresh rewrites the same two files (`data/confluence/handoff.md`
  and `prisma/oncall.db`). Once two PRs are open, both go `CONFLICTING` against `main`
  and auto-merge waits forever. Step 6a branches from fresh `main` and step 6e resolves
  in favour of the PR branch — but only for those two paths, so a concurrent
  source-code change on `main` is never discarded.

The agent's `gh` token needs write/merge access to the repo; a permissions failure at
step 6d cannot be fixed by prompt changes.
