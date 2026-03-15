---
name: site-audit
description: |
  Multi-perspective quality audit for Agent Pomodoro.
  Runs 4 reviewer agents in parallel, each writes a review file.
  Triggery: "site-audit", "audit", "oceń jakość".
---

# Site Audit — Agent Pomodoro

Run all reviewers in **parallel** using Agent tool (Opus).
Each reviewer writes their output to `docs/reviews/[slug]-review.md`.

## Reviewers

### Agent Access (PRIMARY — 70% weight)
`review-agent-access` → `docs/reviews/agent-access-review.md`

Can an AI agent install, connect, query, and interpret Agent Pomodoro data?
This is the main quality driver from Sprint #9 onwards.

**Scores 5 subcategories 1-10:**
- CLI Install & Config — can an agent run `npm install -g agent-pomodoro` and `agent-pomodoro config set-key`?
- API Key Flow — can a user generate a key in Settings, copy it, configure the CLI?
- Query & Interpret — does `agent-pomodoro status` / `agent-pomodoro stats` return clear, actionable data?
- LLM Friendliness — does `agent-pomodoro --help-llm` give complete JSON schema with examples?
- REST API — do HTTP endpoints work with curl + Bearer token auth?

**Reads:** `packages/apom/bin/apom.mjs`, `packages/apom/package.json`, `convex/http.ts`, `convex/apiKeys.ts`, `app/routes/settings.tsx`, `.claude/skills/pomodoro-check/SKILL.md`

**Tests to run:**
```bash
# CLI help works
node packages/apom/bin/apom.mjs --help
node packages/apom/bin/apom.mjs --help-llm
node packages/apom/bin/apom.mjs config show
```

### End-user (10% weight — regression guard)
`review-enduser` → `docs/reviews/enduser-review.md`

c3z using this daily as a developer focus tool. Must feel natural, fast, satisfying.

**Scores 5 subcategories 1-10:**
- First Impression — does it feel like a tool I'd open every day?
- Timer UX — is starting/pausing/resetting smooth and satisfying?
- Data Visibility — can I see my stats at a glance?
- Mobile Usability — does it work on phone?
- Settings UX — is the API key management page clear and functional?

**Reads:** `app/routes/home.tsx`, `app/routes/timer.tsx`, `app/routes/settings.tsx`, `app/components/Timer.tsx`, `app/components/Stats.tsx`, `app/components/SessionList.tsx`

### Developer Experience (10% weight — regression guard)
`review-devex` → `docs/reviews/devex-review.md`

Agent building/extending this autonomously in sprint cycles.

**Scores 5 subcategories 1-10:**
- CLI Buildability — does `npm run build && npm run test` work without human?
- Skill Integration — does pomodoro-check skill work from Claude Code?
- Code Organization — clean component/route/convex separation?
- Test Coverage — do E2E tests cover critical paths?
- Sprint Autonomy — can agent run 10 sprints without getting stuck?

**Reads:** `package.json`, `CLAUDE.md`, `playwright.config.ts`, `e2e/`, `convex/`, `.claude/skills/`

### Performance (10% weight — regression guard)
`review-perf` → `docs/reviews/perf-review.md`

Timer must be precise. Laggy timer = unusable tool.

**Scores 5 subcategories 1-10:**
- Timer Accuracy — 1 second = 1 second, no drift?
- Initial Load — time to interactive under 2s?
- Bundle Size — no bloat?
- State Management — no unnecessary re-renders?
- Offline Capability — timer works without network?

**Reads:** `app/components/Timer.tsx`, `vite.config.ts`, `package.json`

## Output Format

Each reviewer writes:

```markdown
# [Reviewer Name] Review — Sprint #N

**Date:** YYYY-MM-DD
**Reviewer:** [name]
**Overall:** X.X/10

## Scores

| Subcategory | Score | Notes |
|-------------|-------|-------|
| [sub1]      | X/10  | ...   |
| [sub2]      | X/10  | ...   |
| [sub3]      | X/10  | ...   |
| [sub4]      | X/10  | ...   |
| [sub5]      | X/10  | ...   |

## Findings

### P1 (Blockers)
- ...

### P2 (Should Fix)
- ...

### P3 (Nice to Have)
- ...

## Comparison with Previous Sprint
[delta table or "first audit"]
```

## Consolidated Score

Average of all reviewer scores, weighted:
- Agent Access: 70% (primary)
- End-user: 10% (regression guard)
- DevEx: 10% (regression guard)
- Performance: 10% (regression guard)
