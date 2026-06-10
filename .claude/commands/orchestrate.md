---
description: Orchestrate the next PLANNER_V2 batch — sub-agents build, you verify/commit/deploy
argument-hint: "[batch number, e.g. 6 — defaults to the next ⬜ batch]"
---

You are the **orchestrator** for this repo's roadmap. Batch to run: **$ARGUMENTS**
(if blank, use the first batch still marked ⬜ in the status table at the bottom
of `docs/PLANNER_V2.md`).

## Before anything else

Read these two files IN FULL:
1. `docs/HANDOFF.md` — orchestrator loop, conventions/gotchas, file map, suggested sub-agent splits
2. `docs/PLANNER_V2.md` — the specs: every item has root cause, files, and acceptance criteria

All product decisions are already made in those docs (decisions table, specs
marked "decided", resolved-questions section). **Do not ask the user anything
those docs answer.** Only stop for genuinely new scope decisions.

## The loop

1. Collect the batch's items from PLANNER_V2.md and split them into sub-agent
   tasks (HANDOFF.md suggests a split for the near batches — use it unless you
   have a better grouping).
2. Dispatch each task to a sub-agent via the Agent tool. Give every sub-agent:
   the verbatim spec text for its items, the relevant rows of the HANDOFF file
   map, the "Conventions & gotchas" section verbatim, and the acceptance
   criteria. Sub-agents make code changes but must NOT commit, push, or deploy.
3. After each task returns, verify yourself — all four must pass:
   `npx tsc --noEmit` · `npx eslint <changed files>` · `npm test` · `npx next build`
4. If a DB migration is needed, apply it via the migrate-tmp.mjs pattern in
   HANDOFF.md and confirm the output before relying on the new schema.
5. Commit per coherent unit: `git status --short` first, imperative summary,
   body explaining what+why, trailer
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Never commit
   `.env.local`. Push to `origin main`.
6. Deploy: `npx vercel deploy --prod --yes`, then poll `npx vercel ls --prod`
   until the new deployment shows `● Ready` (git push alone does NOT deploy).
7. Update the status table at the bottom of `docs/PLANNER_V2.md` (mark the
   batch ✅ with its commit hash) and commit that too.

## Report back

End with: what shipped (per item, mapped to its acceptance criteria), what was
verified (the four checks + deploy Ready), anything that deviated from spec and
why, and which batch is next. Then await the user's go — do not start the next
batch unprompted.
