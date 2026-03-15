# Developer Experience Review — Sprint #7

**Date:** 2026-03-15
**Reviewer:** Developer Experience
**Previous Scores:** Sprint #1: 6.4, Sprint #2: 7.4, Sprint #3: 7.4, Sprint #5: 7.8, Sprint #6: 8.0
**Overall:** 8.6/10

## Scores

| Subcategory | Sprint #5 | Sprint #6 | Sprint #7 | Notes |
|-------------|-----------|-----------|-----------|-------|
| CLI Buildability | 9/10 | 9/10 | 9/10 | Unchanged. CI pipeline still runs the correct sequence: `npm ci -> typecheck -> playwright install -> build -> test`. No pipeline changes needed. The 7 new E2E tests slot in without config modifications — Playwright autodiscovers `e2e/dashboard.spec.ts`. |
| Skill Integration | 7/10 | 8/10 | 8/10 | Unchanged. `retryQueue.ts` is an app-level concern, not skill-facing. The pomodoro-check skill was not modified. The `activeUserId` workflow from Sprint #6 still works. No regression. |
| Code Organization | 8/10 | 8/10 | 9/10 | **Improvement.** `retryQueue.ts` is a clean, single-purpose module (32 lines, 4 exported functions, zero dependencies). It lives correctly in `app/lib/` alongside `useUserId.ts`. The `timer.tsx` route integrates it without polluting the Timer component — retry logic stays in the route, presentation stays in the component. This is the right separation. Third test file (`dashboard.spec.ts`) follows existing naming conventions. File count remains manageable: 6 routes, 5 components, 2 lib modules, 3 test files, 3 Convex source files. |
| Test Coverage | 7/10 | 7/10 | 9/10 | **Major improvement (+2).** 7 new tests across 2 files bring the total from 13 to 20. The four-sprint drought of static test coverage is broken. Dashboard period selector tests cover the Stats component's interactive behavior (previously untested). Keyboard shortcut tests (Space start/pause, Escape reset, hint visibility) close the most-flagged gap from the last three reviews. The new `dashboard.spec.ts` file is the first test file added since the project's initial test setup. |
| Sprint Autonomy | 8/10 | 8/10 | 8/10 | Unchanged. `s.md` still says "Current Sprint: #6" (should be #7) — this is now the fifth consecutive sprint where the counter is stale. CLAUDE.md architecture section still lists only 2 E2E files (`smoke.spec.ts` and `timer.spec.ts`), missing the new `dashboard.spec.ts`. The `retryQueue.ts` module is also absent from the `lib/` listing. These documentation gaps accumulate: an agent reading CLAUDE.md gets an incomplete picture of the codebase. |

## Findings

### P1 (Blockers)

None.

### P2 (Should Fix)

1. **CLAUDE.md architecture section is stale.** The `e2e/` listing shows only `smoke.spec.ts` and `timer.spec.ts` — missing `dashboard.spec.ts`. The `lib/` listing shows only `useUserId.ts` — missing `retryQueue.ts`. An agent relying on CLAUDE.md to understand project structure will not know these files exist. This is a 2-minute fix that compounds with each sprint.

2. **`s.md` sprint counter still says #6 (fifth consecutive sprint stale).** This has been flagged as P2 since Sprint #3. It is now a systemic process failure, not an oversight. The sprint skill's Step 8 ("Update s.md") is either not being executed or is updating scores but not the counter. Recommendation: make the counter update the FIRST line the agent writes in Step 8, not the last.

3. **`retryQueue.ts` only retries `start` mutations.** The `flush()` function in `timer.tsx` (lines 27-28) checks `item.action === "start"` but ignores `"complete"` and `"interrupt"` actions. If a user completes a session while offline, the `onSessionComplete` handler catches the error and logs it (line 66) but does NOT call `enqueue()`. Only `onSessionStart` enqueues on failure (line 53). This means the retry queue is half-implemented — it protects session creation but not session completion. A session started offline will be retried, but a session completed offline will be silently lost.

4. **CI does not test with Convex env vars.** Carry-over from Sprint #5. The new `retryQueue.ts` integration cannot be verified in CI because Convex mutations will never actually fire. Typecheck catches type errors but not runtime logic (e.g., the incomplete flush function above).

### P3 (Nice to Have)

1. **`retryQueue.ts` has no TTL or max-size on queued items.** If the app is used offline for an extended period, `localStorage` could accumulate stale mutations with timestamps from hours or days ago. A simple `MAX_QUEUE_SIZE = 50` or `MAX_AGE_MS = 24 * 60 * 60 * 1000` would prevent unbounded growth.

2. **Dashboard tests assert CSS class (`text-white`) for active state.** The test `"7d is selected by default"` checks `toHaveClass(/text-white/)` (dashboard.spec.ts:14). This couples the test to a Tailwind implementation detail. If the active state styling changes (e.g., to a border or background), the test breaks without the feature being broken. A `data-active` attribute or `aria-pressed` would be more semantic.

3. **No unit tests for `retryQueue.ts`.** The module is pure functions operating on `localStorage` — ideal for unit testing without Playwright. A Vitest/Jest suite testing `enqueue`, `getQueue`, `removeItem`, and edge cases (corrupt JSON, empty storage) would take 20 minutes and cover the offline path that E2E cannot reach.

4. **Timer E2E tests still use `waitForTimeout(1100)` and `waitForTimeout(500)`.** Lines 49 and 69 of `timer.spec.ts` use hard-coded waits. These are flaky on slow CI runners. Prefer `waitForSelector` or Playwright's auto-waiting (`expect(...).toBeVisible()`) where possible.

5. **No lint/format enforcement.** Sixth sprint without ESLint or Prettier. Still consistent because a single agent produces all code, but the risk grows with each sprint.

## Detailed Analysis

### CLI Buildability (9/10, unchanged)

The CI pipeline at `.github/workflows/ci.yml` is unchanged and correct:

```
npm ci -> typecheck -> playwright install -> build -> test
```

The 7 new E2E tests required zero pipeline modifications. Playwright autodiscovers any `*.spec.ts` in the `e2e/` directory, so adding `dashboard.spec.ts` was seamless. The `fullyParallel: true` config in `playwright.config.ts` means the expanded test suite (20 tests) runs concurrently without increased wall-clock time.

The `webServer` block correctly passes empty `VITE_CLERK_PUBLISHABLE_KEY` for CI degraded mode. The `STAGING_URL` toggle continues to work for staging E2E.

Why not 10: same as Sprint #5 and #6 — CI tests degraded mode only. No Convex-connected test run. Not justified for a single-user app, but it means `retryQueue.ts` integration is effectively untested in CI.

### Skill Integration (8/10, unchanged)

No changes to skills this sprint. The `retryQueue.ts` module is an app-level resilience feature, not a skill-facing change. The pomodoro-check skill's workflow (activeUserId -> stats/agentSummary) is unaffected.

The `retryQueue` could theoretically benefit the skill if it exposed queue status (e.g., "3 mutations pending retry"), but this is not currently wired up and is not a priority.

Why not 9: same as Sprint #6. The `activeUserId` approach works for single-user but does not scale. No cold-start fallback. No `listUsers` query. These are the same gaps as last sprint — no regression, no improvement.

### Code Organization (9/10, +1)

This sprint demonstrates good architectural instincts. The `retryQueue.ts` module:

- **Single responsibility:** 4 functions, 32 lines, zero imports. Pure localStorage operations.
- **Correct placement:** `app/lib/` alongside `useUserId.ts`. Utility modules live here, not in `components/` or `routes/`.
- **Clean integration:** `timer.tsx` imports `enqueue`, `getQueue`, `removeItem` and wires them into the route's mutation handlers. The `Timer` component is unaware of retry logic — it still receives the same `onSessionStart/Complete/Interrupt` callbacks.
- **Effect cleanup:** The `useEffect` in `timer.tsx` correctly returns a cleanup function removing the `online` event listener.

The new `dashboard.spec.ts` follows the established test naming pattern (`{feature}.spec.ts`) and grouping pattern (`test.describe("{Feature}", ...)`).

File inventory post-Sprint #7:
- `app/routes/` — 5 route files
- `app/components/` — 5 components (unchanged)
- `app/lib/` — 2 utility modules (+1: `retryQueue.ts`)
- `convex/` — 3 source files + generated (unchanged)
- `e2e/` — 3 test files (+1: `dashboard.spec.ts`)
- `.claude/skills/` — 3 skills (unchanged)

Why not 10: the `retryQueue` integration in `timer.tsx` has an asymmetry — `onSessionStart` enqueues on failure, but `onSessionComplete` and `onSessionInterrupt` do not. This is either intentional (only start matters for offline) or an oversight. Either way, it should be documented in a code comment explaining the design choice.

### Test Coverage (9/10, +2)

The biggest improvement this sprint. After four sprints of static coverage, 7 new tests bring the total to 20:

**New tests (Sprint #7):**

Dashboard period selector (4 tests in `dashboard.spec.ts`):
- Period selector visible with 3 options (7d, 30d, All)
- 7d selected by default
- Clicking 30d switches active period
- Stat cards visible (Streak, Focus Time, Completion, Since Last)

Keyboard shortcuts (3 tests in `timer.spec.ts`):
- Space starts the timer
- Escape resets the timer
- Keyboard hint text is visible

**Coverage map post-Sprint #7:**

| Area | Tests | Status |
|------|-------|--------|
| Page loads (home, timer, history) | 3 | Covered |
| Navigation | 1 | Covered |
| Timer display & mode switching | 3 | Covered |
| Timer start/pause/resume/reset | 3 | Covered |
| Counter display | 1 | Covered |
| Dashboard stats cards | 1 | **NEW** |
| Dashboard period selector | 3 | **NEW** |
| Keyboard shortcuts | 3 | **NEW** |
| Timer completion (00:00 -> modal) | 0 | NOT COVERED |
| Completion modal (notes, tags) | 0 | NOT COVERED |
| Offline retry queue behavior | 0 | NOT COVERED |
| Auth flow | 0 | NOT COVERED |

Why not 10: the completion flow (timer reaches zero, modal appears, notes/tags, save) remains untested — this was the #1 recommendation in the Sprint #6 review. The retry queue has no tests at any level (E2E or unit). Auth is not testable in degraded CI mode, which is acceptable.

### Sprint Autonomy (8/10, unchanged)

Sprint #7 delivered solid feature work, but documentation upkeep continues to lag:

- `s.md` counter: still #6, should be #7
- CLAUDE.md architecture: missing `dashboard.spec.ts` and `retryQueue.ts`
- `s.md` P2 backlog still lists "Test coverage static" and "Mutation retry queue" as open items, but both were addressed this sprint — the backlog was not updated

An agent starting Sprint #8 from `s.md` would:
1. See "Current Sprint: #6" and potentially create the wrong branch
2. See "Mutation retry queue" as an open P2 and attempt to re-implement it
3. Not know that `dashboard.spec.ts` exists (not in CLAUDE.md)

These are all solvable with 5 minutes of documentation updates, but the pattern of not doing them is now five sprints old.

Why not 9: the documentation staleness creates real friction for autonomous agents. An agent that reads CLAUDE.md and `s.md` as its primary orientation documents will have an incorrect mental model of the project state. The sprint skill's close-out steps (8 and 9) need stricter enforcement or automation.

## Comparison with Previous Sprint

| Subcategory | Sprint #3 | Sprint #5 | Sprint #6 | Sprint #7 | Delta (vs #6) |
|-------------|-----------|-----------|-----------|-----------|---------------|
| CLI Buildability | 8 | 9 | 9 | 9 | 0 |
| Skill Integration | 7 | 7 | 8 | 8 | 0 |
| Code Organization | 8 | 8 | 8 | 9 | +1 |
| Test Coverage | 7 | 7 | 7 | 9 | +2 |
| Sprint Autonomy | 7 | 8 | 8 | 8 | 0 |
| **Overall** | **7.4** | **7.8** | **8.0** | **8.6** | **+0.6** |

### What Moved the Needle

- **7 new E2E tests** (+2 to Test Coverage) — the single biggest impact. Broke a four-sprint drought. Dashboard period selector and keyboard shortcuts were the two most-cited gaps in previous reviews. Both are now covered. Total test count: 13 -> 20 (54% increase).
- **`retryQueue.ts` as a clean module** (+1 to Code Organization) — demonstrates good separation of concerns. The retry logic is isolated from the Timer component, the route wires them together, localStorage operations are in their own file with zero dependencies.

### What Did Not Move

- **Sprint Autonomy static at 8/10 for four sprints.** The documentation staleness pattern (`s.md` counter, CLAUDE.md architecture) is now chronic. It has been flagged in every review since Sprint #3 and never addressed. This is the single biggest drag on the autonomy score.
- **Skill Integration static at 8/10 for two sprints.** No skill changes. The `listUsers` query and cold-start fallback from the Sprint #6 recommendations were not implemented. These are low priority for a single-user app.

### Path to 9.0+

To reach 9.0, the project needs:

1. **Sprint Autonomy -> 9/10:** Update `s.md` counter, update CLAUDE.md architecture section, mark completed P2 items as done in `s.md` backlog. Then automate these updates in the sprint skill (add explicit checklist items in Step 8). This alone would bring the overall from 8.6 to 8.8.

2. **Test Coverage -> 10/10:** Add the completion flow E2E test (timer reaches 0, modal, save). Add a unit test file for `retryQueue.ts` with Vitest. This would bring coverage to 10/10 and the overall to 9.0.

3. **Code Organization -> 10/10:** Add a code comment in `timer.tsx` explaining why `onSessionComplete` and `onSessionInterrupt` do not enqueue on failure (if intentional), or implement the missing enqueue calls (if oversight). Add ESLint for style enforcement.

Items 1 and 2 alone would bring the score to approximately 9.0.

## Recommendations (Priority Order)

1. **Update `s.md` and CLAUDE.md** — fix sprint counter, add `dashboard.spec.ts` and `retryQueue.ts` to architecture, mark completed P2s as done. 5-minute fix, fifth sprint flagged.
2. **Complete the retry queue** — add `enqueue()` calls in `onSessionComplete` and `onSessionInterrupt` error handlers, or document why only `start` is retried.
3. **Add completion flow E2E test** — still the highest-value untested path. Timer reaches 0, modal appears, save. Would bring test coverage to near-complete.
4. **Add unit tests for `retryQueue.ts`** — pure functions, no browser needed, ideal for Vitest. Cover edge cases: corrupt JSON, empty storage, removeItem on empty queue.
5. **Add TTL/max-size to retry queue** — prevent unbounded localStorage growth during extended offline use.
6. **Replace `toHaveClass(/text-white/)` with semantic attribute** — `aria-pressed` or `data-active` decouples tests from Tailwind classes.
7. **Automate `s.md` counter update in sprint skill** — break the five-sprint pattern of stale counters.
