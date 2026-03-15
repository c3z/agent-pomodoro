---
name: sprint
description: |
  Sprint cycle for Agent Pomodoro. Build → test → audit → triage → PR.
  Triggery: "sprint", "/sprint", "następny sprint".
---

# Sprint Cycle — Agent Pomodoro

## Deployment Policy

- **Staging:** `npm run build && npx vercel --yes` (preview URL)
- **Production:** `npx vercel --prod --yes` — REQUIRES c3z approval
- **Never deploy to prod without explicit owner approval**

## Workflow

```
branch → brief → build → test → staging → audit → triage → compare → PR
```

## Steps

### 0. BRANCH
```bash
# Read current sprint number from s.md
# Increment and create branch
git checkout -b sprint/N
```

### 1. BRIEF
- Read `s.md` for current state, backlog, scores
- Read last audit results from `docs/reviews/`
- Identify top P1/P2 items to address
- Write brief: goal, metric, scope (max 3 items per sprint)

### 2. BUILD
- Execute fixes/features from brief
- Follow CLAUDE.md conventions
- Keep changes focused — one sprint ≠ rewrite

### 3. TEST
```bash
# Run E2E tests locally
npm run test

# Must pass before proceeding
# If tests fail → fix → retest
```

### 4. STAGING DEPLOY
```bash
npm run build && npx vercel --yes
```
- Capture staging URL for audit

### 5. AUDIT
Launch site-audit skill with `/site-audit` or run reviewers:

For each reviewer, spawn a parallel agent (Opus):

#### End-user Reviewer (PRIMARY)
`review-enduser` → `docs/reviews/enduser-review.md`

**c3z using this daily as a focus tool.**

Scores 5 subcategories 1-10:
- **First Impression** — does it feel like a tool I'd actually open every day?
- **Timer UX** — is starting/pausing/resetting smooth and satisfying?
- **Data Visibility** — can I see my stats at a glance?
- **Mobile Usability** — does it work on phone (PWA potential)?
- **Agent Integration** — can Claude query my usage easily?

Reads: `app/routes/home.tsx`, `app/routes/timer.tsx`, `app/components/Timer.tsx`, `app/components/Stats.tsx`

#### Developer Experience Reviewer
`review-devex` → `docs/reviews/devex-review.md`

**Agent building/extending this autonomously.**

Scores 5 subcategories 1-10:
- **CLI Buildability** — can `npm run build` and `npm run test` run without human?
- **Skill Integration** — does pomodoro-check skill work from Claude Code?
- **Code Organization** — are components/routes/convex cleanly separated?
- **Test Coverage** — do E2E tests cover critical paths?
- **Sprint Autonomy** — can an agent run 10 sprints without getting stuck?

Reads: `package.json`, `CLAUDE.md`, `playwright.config.ts`, `e2e/`, `convex/`, `.claude/skills/`

#### Performance Reviewer
`review-perf` → `docs/reviews/perf-review.md`

**Timer must be precise — laggy timer = unusable.**

Scores 5 subcategories 1-10:
- **Timer Accuracy** — does 1 second = 1 second? No drift?
- **Initial Load** — time to interactive under 2s?
- **Bundle Size** — no unnecessary deps bloating the build?
- **State Management** — no unnecessary re-renders during countdown?
- **Offline Capability** — does timer work without network?

Reads: `app/components/Timer.tsx`, `vite.config.ts`, `package.json`

#### UAT Tester (Production)
`review-uat` → `docs/reviews/uat-review.md`

**Tests the live production deployment using browser automation.**

Uses Playwright or browser tools against the STAGING or PRODUCTION URL to verify:
- **Page loads** — does every route render without errors?
- **Sign-in flow** — does the auth gate show? Does Clerk modal open?
- **Timer interaction** — can you start, pause, reset the timer?
- **Data persistence** — after completing a session, does it appear in history?
- **Console errors** — are there any JS errors in the browser console?
- **Network health** — do Convex WebSocket connections succeed?

Process:
1. Use `npx playwright test --config=playwright.config.ts` with STAGING_URL set to the deploy URL
2. If smoke tests pass on staging → UAT PASS
3. If ANY test fails → UAT FAIL, report errors with screenshots
4. Also manually check browser console for Convex/Clerk errors by reading logs

Writes: `docs/reviews/uat-review.md` with PASS/FAIL verdict and specific errors

### 6. TRIAGE
- Consolidate all reviewer findings
- Classify: P1 (blocker), P2 (should fix), P3 (nice to have)
- P1 = must fix before next sprint
- Update `s.md` backlog

### 7. COMPARE
Generate trend table:

```
| Reviewer        | Sprint N-1 | Sprint N | Δ    |
|-----------------|-----------|----------|------|
| End-user        | X.X       | Y.Y      | +Z.Z |
| DevEx           | X.X       | Y.Y      | +Z.Z |
| Performance     | X.X       | Y.Y      | +Z.Z |
| **Consolidated**| X.X       | Y.Y      | +Z.Z |
```

### 8. UPDATE s.md
- New scores in table
- New backlog items
- Sprint history entry

### 9. PR
```bash
git add -A
git commit -m "(feat) Sprint #N: [summary]"
git push -u origin sprint/N
gh pr create --title "Sprint #N: [summary]" --body "$(cat <<'EOF'
## Summary
[bullets]

## Scores
[trend table]

## Test Results
[pass/fail]

## E2E
[test output summary]
EOF
)"
```

## Scoring Rubric

| Score | Meaning |
|-------|---------|
| 1-2   | Broken / unusable |
| 3-4   | Major issues, barely functional |
| 5-6   | Works but significant gaps |
| 7-8   | Good, minor issues |
| 9-10  | Excellent, polished |

## Stop Condition

**End-user (primary) >= 7.0/10 AND P1 items = 0**

Target: >= 7.0 (MVP stage)
