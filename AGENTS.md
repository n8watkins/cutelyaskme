<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repository Workflow

- When a coherent work unit is finished and verification passes, remind the user that the current changes should be committed.
- Do not auto-commit without explicit user approval.
- Before suggesting or making a commit, run `git status --short` and summarize the intended commit scope.
- If unrelated user changes are present, leave them out of the commit unless the user explicitly asks to include them.
