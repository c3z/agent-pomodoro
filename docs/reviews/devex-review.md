# Developer Experience Review — Sprint #2

**Date:** 2026-03-15
**Reviewer:** Developer Experience
**Previous Score:** 6.4/10
**Overall:** 7.4/10

## Scores

| Subcategory | Sprint #1 | Sprint #2 | Notes |
|-------------|-----------|-----------|-------|
| CLI Buildability | 7/10 | 8/10 | CI pipeline added. Build + test gated on push/PR. Still no `npm run dev:full` for combined Convex + RR dev. |
| Skill Integration | 6/10 | 7/10 | userId fixed to `"dev-user"` in both app and skill. Skill is runnable. Still no auto-discovery of prod Clerk userId. |
| Code Organization | 8/10 | 8/10 | Duplicate `app/lib/convex.ts` removed. Architecture map in CLAUDE.md still references it. Untracked files in git status (`convex/README.md`, `convex/auth.config.js`) remain. |
| Test Coverage | 6/10 | 7/10 | Timer tests cover start/pause/resume/reset/mode-switch. No Convex integration tests, no error-path tests, no completion test. |
| Sprint Autonomy | 5/10 | 7/10 | CI gate exists. Sprint skill workflow is viable for 5+ sprints. `git add -A` in sprint skill still risky. Vercel deploy auth still undocumented. |

## Findings

### P1 (Blockers)

1. **Keyboard shortcut `useEffect` missing dependency array.** In `Timer.tsx` line 227, the keyboard shortcut effect has no dependency array — it re-registers the listener on every single render. During an active timer (ticking 4x/sec due to 250ms interval), this creates and tears down the keydown listener hundreds of times per second. Must add `[isRunning, isPaused]` as deps or use a ref-based approach to avoid this hot-path performance tax.

2. **Completion detection logic has a dead code path.** `Timer.tsx` lines 157-161: the `useEffect` watching `secondsLeft` has a comment "Timer just completed" but the if-body is empty. The actual completion fires from a separate `useEffect` on lines 164-187, which checks `completedRef.current`. However, `completedRef` is set to `true` in `start()` (line 241) and checked in the second effect — meaning if the component re-renders between `secondsLeft` hitting 0 and `isRunning` becoming `false`, the completion callback may fire with stale mode state or not fire at all. This is a latent race condition that will surface in future sprints adding features around session completion.

3. **CI workflow does not set required env vars for Convex.** The `.github/workflows/ci.yml` runs `npm run build` and `npm run test` but provides no `VITE_CONVEX_URL` or `VITE_CLERK_PUBLISHABLE_KEY`. Build succeeds only because Providers.tsx gracefully degrades to no-backend mode. Tests pass only because they test UI-only behavior. This means CI is not testing the real app — it is testing a degraded skeleton. When Convex integration tests are added (which they should be), CI will break with no guidance on how to configure secrets.

### P2 (Should Fix)

1. **CLAUDE.md architecture section is stale.** The tree still shows `app/lib/convex.ts` which was removed in this sprint. An agent reading CLAUDE.md to understand the codebase will look for a file that does not exist. Similarly, the Convex section shows `auth.config.ts` but git status shows an untracked `auth.config.js` — this suggests a stale JS copy sitting in the working tree that could confuse agents running `git add`.

2. **Untracked files polluting git status.** `convex/README.md` and `convex/auth.config.js` appear as untracked in `git status`. These should either be committed or added to `.gitignore`. An agent running the sprint skill (which uses `git add -A`) will commit these, potentially introducing a duplicate auth config (`.js` alongside `.ts`) that causes Convex confusion.

3. **No combined dev command.** `npm run dev` starts React Router but not Convex. An agent entering the project cold must know to run `npx convex dev` separately. This was a P2 in Sprint #1 and remains unfixed. A `"dev:full": "npx concurrently 'npm run dev' 'npx convex dev'"` would solve it, though it adds a dependency.

4. **pomodoro-check skill works for dev-mode only.** The skill hardcodes `"dev-user"` which matches the dev fallback in `useUserId.ts`. In production with Clerk, the actual userId is `user_2x...` format. The skill has no way to discover or configure the real userId. An agent running the skill against a prod Convex deployment will get empty results. Needs either: (a) a `convex run` that lists distinct userIds, or (b) a config file mapping c3z to his Clerk userId.

5. **Sprint skill still uses `git add -A`.** This was flagged as P2 in Sprint #1. Risk: commits `.env.local`, IDE files, or the stale untracked files currently in the repo. Should use explicit `git add` of changed files or at minimum ensure `.gitignore` is comprehensive.

6. **No typecheck in CI.** `npm run typecheck` exists in `package.json` but the CI workflow only runs `build` and `test`. Type regressions can be introduced without detection. Adding `- run: npm run typecheck` to the CI steps is a one-line fix.

### P3 (Nice to Have)

1. **No lint/format enforcement.** No ESLint or Prettier config. After 5+ agent sprints, code style will drift. Minor now, compounding later.

2. **Test IDs undocumented.** `start-button`, `pause-button`, `stop-button`, `start-pomodoro-link` are critical test anchors. An agent refactoring UI may remove them without knowing tests depend on them. A brief section in CLAUDE.md or a comment block in the test files would prevent this.

3. **Playwright tests only run Chromium.** Fine for MVP. Firefox/WebKit coverage would catch CSS quirks in the timer ring SVG.

4. **No Convex seed data or test fixtures.** Agent testing stats or history features has no way to populate data. A `convex/seed.ts` script would enable this.

5. **pomodoro-check CLI one-liner depends on `python3`.** Should use `node -e` for consistency with the Node.js stack. Flagged in Sprint #1, still present.

6. **`s.md` still says "Current Sprint: #1".** Should be updated to reflect Sprint #2. Agent parsing `s.md` for sprint number will create wrong branch name.

## Detailed Analysis

### CLI Buildability (8/10, +1)

The CI pipeline is the biggest improvement. Push to `main` or PR now triggers build + test automatically via GitHub Actions. The workflow is clean: checkout, setup Node 20 with npm cache, install deps, install Playwright browsers, build, test. This gives agents a safety net — broken builds will be caught.

Remaining gap: CI tests a degraded app (no Convex, no Clerk). The build/test pass gives false confidence. When someone adds a Convex query to a component that currently works without it, the local test may pass (graceful degradation) but the real app could break. Adding `VITE_CONVEX_URL` as a CI secret and running against a test Convex deployment would close this gap, but that is a significant infrastructure investment — reasonable to defer.

The `npm run build && npx vercel --yes` staging deploy path works. Missing: documentation of `VERCEL_TOKEN` for automated deploys.

### Skill Integration (7/10, +1)

The userId fix is material. Sprint #1 had `"c3z"` hardcoded in pomodoro-check while the app used `"dev-user"` — guaranteed empty results. Now both use `"dev-user"`, so an agent running the skill in dev mode will get real data back. The skill's interpretation rules, response patterns, and morning/evening hooks remain well-designed.

The gap is production-readiness: when Clerk is configured, the app switches to Clerk's `user.id` format but the skill still queries `"dev-user"`. This is acceptable for current dev-mode usage but will break the monitoring loop once the app goes to prod with real auth.

### Code Organization (8/10, unchanged)

The duplicate `app/lib/convex.ts` removal is clean — `app/lib/` now contains only `useUserId.ts`. The component/route/convex separation remains textbook. Error handling was added to Convex mutations in `timer.tsx` with try/catch and console.warn — this is the right pattern, prevents UI crashes on network failures.

The stale CLAUDE.md architecture tree is a documentation debt, not a code issue. The untracked files (`convex/README.md`, `convex/auth.config.js`) are cleanup items that should have been addressed in this sprint since the duplicate convex.ts was already being removed.

### Test Coverage (7/10, +1)

The timer test suite is solid for UI behavior: default state (25:00), mode switching (BREAK -> 05:00, LONG BREAK -> 15:00), start/countdown (24:59 appears), pause/resume, reset, counter display. The smoke tests cover all four pages and navigation flow.

What is still missing:
- **Completion test:** Timer runs to 00:00 and mode auto-switches. This is the core UX moment and it is untested. A short-duration test mode (e.g., 2-second timer) would make this feasible.
- **Convex integration:** No test verifies that starting a timer creates a session in Convex. No test verifies that stats display real data.
- **Error paths:** No test for what happens when Convex is unreachable mid-session.
- **Keyboard shortcuts:** Space to start/pause, Escape to reset are not tested despite being a Sprint #2 addition.

### Sprint Autonomy (7/10, +2)

This is the area with the most improvement. The CI pipeline means an agent no longer has to manually interpret test output — push to branch, check CI status via `gh run view`. The sprint skill workflow (branch -> brief -> build -> test -> staging -> audit -> triage -> PR) is executable by an agent for multiple iterations.

Remaining friction:
- `s.md` sprint counter is out of date, which will cause branch naming confusion.
- `git add -A` in the sprint skill is still present and still dangerous.
- Vercel deploy requires auth that is not documented for agent use.
- The audit step assumes sub-agent spawning capability, which may not be available in all environments.

An agent could realistically run 5-7 sprints before hitting a blocker. The main risk is the accumulation of untracked files being swept into commits via `git add -A`.

## Comparison with Previous Sprint

| Subcategory | Sprint #1 | Sprint #2 | Delta |
|-------------|-----------|-----------|-------|
| CLI Buildability | 7 | 8 | +1 |
| Skill Integration | 6 | 7 | +1 |
| Code Organization | 8 | 8 | 0 |
| Test Coverage | 6 | 7 | +1 |
| Sprint Autonomy | 5 | 7 | +2 |
| **Overall** | **6.4** | **7.4** | **+1.0** |

### What Moved the Needle
- CI pipeline (+2 to Sprint Autonomy, +1 to CLI Buildability)
- userId fix (+1 to Skill Integration)
- Error handling on mutations (quality improvement, not scored separately)
- Keyboard shortcuts (feature, not directly a DevEx metric but shows good timer test coverage growing)
- Duplicate convex.ts removal (cleanup, already scored 8 on organization)

### What Did Not Move
- No combined dev command (P2 carry-over)
- Untracked files still in working tree (P2 carry-over)
- `git add -A` in sprint skill (P2 carry-over)
- No typecheck in CI (new P2)
- pomodoro-check still dev-mode-only (improved but not fully resolved)

## Recommendations (Priority Order)

1. Fix the keyboard shortcut useEffect dependency array — it is a silent performance drain during active timer use
2. Add `npm run typecheck` to CI pipeline (one line)
3. Clean up untracked files: commit or gitignore `convex/README.md` and `convex/auth.config.js`
4. Update CLAUDE.md architecture tree to remove `app/lib/convex.ts` reference
5. Replace `git add -A` in sprint skill with explicit file staging
6. Add keyboard shortcut tests to `e2e/timer.spec.ts`
7. Update `s.md` to reflect current sprint number
