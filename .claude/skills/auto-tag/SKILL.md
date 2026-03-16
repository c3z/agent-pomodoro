---
name: auto-tag
description: Automatically tag pomodoro sessions based on git context when completing.
  Use when stopping a pomodoro session to generate meaningful tags from git diff.
  Triggery: triggered automatically by pomodoro-check on session end.
---

# Auto-Tag — Git-Aware Session Tagging

## When to use
Called at the end of a pomodoro session (before `apom stop`).

## Workflow
1. Run `git diff --stat HEAD@{25.minutes.ago}..HEAD` (adjust for actual session duration)
2. Run `git log --oneline --since="25 minutes ago"`
3. Analyze the changes:
   - Which directories changed? (convex/ -> backend, app/ -> frontend, e2e/ -> tests)
   - What kind of changes? (new files -> feature, modifications -> fix/refactor)
4. Generate tags from fixed vocabulary: code, backend, frontend, tests, docs, refactor, feature, fix, config, style
5. Generate notes summary from commit messages
6. Call `apom stop --tags "generated,tags" --notes "Auto: summary of work"`

## Tag vocabulary
- `code` — general coding
- `backend` — convex/ changes
- `frontend` — app/ changes
- `tests` — e2e/ changes
- `docs` — .md file changes
- `feature` — new files created
- `fix` — bug fix (from commit messages)
- `refactor` — restructuring
- `config` — package.json, tsconfig, etc
- `review` — code review work

## Directory-to-tag mapping

| Directory pattern | Tag |
|---|---|
| `convex/` | backend |
| `app/routes/` | frontend |
| `app/components/` | frontend |
| `app/lib/` | frontend, code |
| `e2e/` | tests |
| `packages/` | code |
| `*.md` | docs |
| `package.json`, `tsconfig*`, `*.config.*` | config |
| `.claude/skills/` | config, docs |
| `public/` | frontend |

## Commit message-to-tag mapping

| Commit prefix | Tag |
|---|---|
| `(feat)` | feature |
| `(fix)` | fix |
| `(refactor)` | refactor |
| `(test)` | tests |
| `(docs)` | docs |
| `(style)` | style |
| `(config)`, `(chore)`, `(build)` | config |

## Example

Git diff shows changes in `app/components/Timer.tsx`, `convex/sessions.ts`, and `e2e/timer.spec.ts`.
Git log shows: `(feat) Add pause button to timer`.

Generated command:
```bash
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro stop --tags "feature,frontend,backend,tests" --notes "Auto: Add pause button to timer — changed Timer component, sessions backend, timer E2E tests"
```

## Fallback

If there are no git changes during the session (no commits, no diff):
- Use conversation context instead
- Generate tags from what was discussed
- Notes: summarize the conversation outcome

## Integration

This skill is invoked by `pomodoro-check` at conversation end. It should NOT be called standalone — it's always part of the session completion flow.
