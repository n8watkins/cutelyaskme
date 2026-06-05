<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Repository Workflow

- When a coherent work unit is finished and verification passes, remind the user that the current changes should be committed.
- Do not auto-commit without explicit user approval.
- Before suggesting or making a commit, run `git status --short` and summarize the intended commit scope.
- If unrelated user changes are present, leave them out of the commit unless the user explicitly asks to include them.
