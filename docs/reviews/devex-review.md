# Developer Experience Review — Sprint #0 (Bootstrap)

**Date:** 2026-03-15
**Reviewer:** Developer Experience
**Overall:** 6.4/10

## Scores

| Subcategory | Score | Notes |
|-------------|-------|-------|
| CLI Buildability | 7/10 | Scripts well-defined, graceful env-var fallback. Convex backend not deployable without manual config. |
| Skill Integration | 6/10 | pomodoro-check skill exists and is well-documented, but userId mismatch and no validation layer. |
| Code Organization | 8/10 | Clean separation: routes, components, convex, lib. Follows conventions from CLAUDE.md. |
| Test Coverage | 6/10 | Smoke + timer interaction covered. No auth, no Convex persistence, no error-path tests. |
| Sprint Autonomy | 5/10 | Sprint skill is thorough, but missing s.md initialization, no CI, userId conflicts will block agents. |

## Findings

### P1 (Blockers)

1. **userId mismatch between app and pomodoro-check skill.** The `useUserId` hook returns Clerk's `user.id` (format: `user_2x...`) in prod and `"dev-user"` in dev mode. But the pomodoro-check skill hardcodes `"c3z"` as userId in every CLI command (`'{"userId": "c3z"}'`). This means the skill will NEVER find real session data. An agent running pomodoro-check will always get empty results and conclude c3z isn't working. Fix: either make the app use a stable userId (e.g., `"c3z"`) or update the skill to discover the actual userId from Convex.

2. **Timer sessions not persisted to Convex (acknowledged in s.md).** The Convex mutations (`sessions:start`, `sessions:complete`, `sessions:interrupt`) exist and are well-structured, but the Timer component does not call them. This means `npm run test` passes (UI-only tests), but the core data pipeline is broken. An agent building on top of this will write features against empty data.

3. **No CI pipeline.** Sprint skill says "E2E tests MUST pass before PR" but there is no GitHub Actions workflow. An agent can run `npm run test` locally, but PR merges have no automated gate. After 3-4 sprints, a regression will slip through.

### P2 (Should Fix)

1. **Convex client created twice.** `app/lib/convex.ts` creates a `ConvexReactClient` singleton, and `app/components/Providers.tsx` creates another one inside `useMemo`. The lib export (`convex`) is potentially unused, or if used alongside Providers, causes two WebSocket connections. Agent extending features may use the wrong client.

2. **No `convex dev` in dev workflow automation.** The `npm run dev` command starts the React Router dev server but not the Convex backend. An agent running `npm run dev` won't have a working backend. Need either a combined script (e.g., `concurrently`) or explicit documentation that Convex must be started separately. CLAUDE.md documents `npx convex dev` but it's not wired into the dev flow.

3. **Playwright config lacks `webServer` startup for Convex.** Tests run against the dev server (`npm run dev` on port 5173) but Convex is not started. Tests pass only because the app gracefully degrades to no-backend mode. This hides real integration bugs.

4. **`s.md` references convex/auth.config.js but file is actually `auth.config.ts`.** Git status shows `convex/auth.config.js` as untracked while the actual file is `.ts`. This suggests a stale or duplicate file. Agent running `git add -A` during sprint will commit both, causing confusion.

5. **Sprint skill uses `git add -A` in step 9.** This is dangerous — it will stage `.env.local`, IDE configs, or any other untracked files. Should use explicit file additions or at minimum have a `.gitignore` that covers common exclusions.

6. **pomodoro-check skill depends on `python3` for the CLI one-liner.** Not a standard dependency for a Node.js project. May fail on some environments. Should use `node -e` instead for consistency.

### P3 (Nice to Have)

1. **No `npm run lint` or formatting check.** Agent making changes has no automated style enforcement. After several sprints, code style will drift.

2. **Test IDs (`data-testid`) are used but not documented.** The smoke tests reference `start-pomodoro-link`, `start-button`, `pause-button`, `stop-button`. These should be listed in CLAUDE.md or a test conventions section so agents know which IDs exist and must be preserved.

3. **No Convex test fixtures or seed data.** Agent testing stats, history, or session list features has no way to populate test data without manual Convex dashboard interaction.

4. **playwright.config.ts only tests Chromium.** Firefox and Safari/WebKit are not covered. Fine for MVP, but worth noting.

5. **`convex/README.md` is untracked (in git status).** Either commit it or add to `.gitignore`. Loose untracked files confuse agents running `git status`.

6. **No TypeScript strict mode verification.** `npm run typecheck` exists but there is no evidence it runs in any automated flow. An agent could introduce type errors that go unnoticed.

## Detailed Analysis

### CLI Buildability (7/10)

The good: `package.json` scripts are clean and standard. `npm run build`, `npm run test`, `npm run typecheck` all exist. Playwright config auto-starts the dev server for local testing. The staging deploy command (`npm run build && npx vercel --yes`) is a single copy-paste.

The gap: An agent doing a clean checkout cannot get a working app without manually running `npx convex dev` and configuring `.env.local` with four environment variables. There is no `setup` or `bootstrap` script. The env vars section in CLAUDE.md lists what's needed but provides placeholder values. For fully autonomous operation, a `npm run setup` that checks for required env vars and prints actionable errors would close this gap.

### Skill Integration (6/10)

The pomodoro-check skill is genuinely well-designed. The interpretation rules (healthy patterns, warning signs, response patterns) give an agent clear behavioral guidance. The morning/evening integration hooks are a strong idea.

But the userId mismatch (P1 #1) makes it non-functional against real data. Additionally, the skill assumes `npx convex run` works from the project directory, which requires `CONVEX_DEPLOYMENT` to be set. If the env var is missing, the agent gets a cryptic Convex error with no guidance on how to fix it.

### Code Organization (8/10)

This is the strongest area. The separation between `app/routes/`, `app/components/`, `app/lib/`, and `convex/` is textbook clean. Each file has a single responsibility. The Providers component handles the Clerk/Convex integration elegantly with graceful fallback for dev mode (no env vars = renders children raw).

The `useUserId` hook is a smart pattern — conditional hook selection based on environment. The Convex schema is well-indexed (`by_user`, `by_user_date`, `by_completed`). The `sessions.ts` queries are focused and composable.

Minor: `convex.ts` in `app/lib/` creates a client that may conflict with the one in Providers.tsx. Should pick one pattern.

### Test Coverage (6/10)

Smoke tests cover all four pages loading and navigation between them. Timer tests cover the core interaction flow: default display, mode switching, start/pause/resume/reset. This is a solid foundation.

Missing:
- No tests for authenticated vs. unauthenticated state
- No tests for Convex data flow (session creation, stats display)
- No tests for error states (network failure, Convex down)
- No tests for the history page showing actual session data
- No tests for the dashboard stats rendering
- Timer completion test (waiting 25 minutes is impractical, but a short-duration test mode would work)

The test infrastructure itself is good: proper config, screenshot-on-failure, trace-on-retry, staging URL support.

### Sprint Autonomy (5/10)

The sprint skill is impressively detailed — 9 steps from branch to PR, with audit integration and trend tracking. The workflow is well-defined and an agent can follow it mechanically.

But several friction points will cause agent stalls:
- **s.md has no sprint counter to parse.** "Current Sprint: #0 (bootstrap)" — agent must extract "0", increment, but "bootstrap" tag breaks simple parsing.
- **No CI means the agent must run tests locally, interpret output, and decide pass/fail.** Playwright's exit code helps, but flaky tests with retries=1 may cause ambiguous results.
- **Staging deploy requires Vercel CLI authentication.** Agent needs `VERCEL_TOKEN` configured, which is not documented.
- **The audit step says "spawn a parallel agent (Opus)"** — this assumes the agent runner supports spawning sub-agents. If run in a single Claude Code session, the agent must serialize the audits.
- **`git add -A` in the PR step is the riskiest moment.** One bad file committed and the sprint is compromised.

After about 3-4 sprints, accumulated P1s (userId mismatch, no persistence) will block meaningful progress unless an agent fixes them first.

## Comparison with Previous Sprint

First audit — no prior data.

## Recommendations (Priority Order)

1. Fix userId: make pomodoro-check use the same ID as the app, or introduce a config constant
2. Wire Timer component to Convex mutations (the data pipeline P1)
3. Add a GitHub Actions CI workflow that runs `npm run build && npm run test`
4. Consolidate the Convex client (remove duplicate in `app/lib/convex.ts` or in Providers)
5. Add `npm run dev:full` that starts both React Router and Convex dev
6. Replace `git add -A` in sprint skill with explicit file patterns
