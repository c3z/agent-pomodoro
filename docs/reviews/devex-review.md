# Developer Experience Review — Sprint #6

**Date:** 2026-03-15
**Reviewer:** Developer Experience
**Previous Scores:** Sprint #1: 6.4, Sprint #2: 7.4, Sprint #3: 7.4, Sprint #5: 7.8
**Overall:** 8.0/10

## Scores

| Subcategory | Sprint #3 | Sprint #5 | Sprint #6 | Notes |
|-------------|-----------|-----------|-----------|-------|
| CLI Buildability | 8/10 | 9/10 | 9/10 | Unchanged. Typecheck + build + E2E pipeline remains solid. Font preload in root.tsx is a minor build-adjacent improvement (faster perceived load), but no pipeline changes. |
| Skill Integration | 7/10 | 7/10 | 8/10 | **Major improvement.** `activeUserId` query eliminates the hardcoded `"dev-user"` blocker. Skill now has a two-step workflow: discover userId, then query. Works in both dev and prod. |
| Code Organization | 8/10 | 8/10 | 8/10 | Unchanged. AudioContext singleton is a clean refactor — module-level `audioCtx` with lazy init is the correct pattern. No new files, no structural changes. |
| Test Coverage | 7/10 | 7/10 | 7/10 | Unchanged. No new tests. Completion flow, keyboard shortcuts, offline SW still untested. This is the fourth consecutive sprint with static test coverage. |
| Sprint Autonomy | 8/10 | 8/10 | 8/10 | Unchanged. `s.md` sprint counter still says "#5" (should be #6). The font optimization and AudioContext fix reduce tech debt that would slow future sprints, but no structural autonomy improvement. |

## Findings

### P1 (Blockers)

None.

### P2 (Should Fix)

1. **`s.md` sprint counter is stale (says #5, should be #6).** This has been flagged as P2 for four consecutive sprints. An agent parsing `s.md` to determine the next sprint number will create `sprint/6` (the current one) instead of `sprint/7`. This is a 30-second fix that keeps getting missed, which is now a process pattern worth examining — either automate the counter update in the sprint skill, or add it as an explicit final step.

2. **`activeUserId` query does a full table scan.** The query calls `.order("desc").first()` without an index filter. On a small dataset this is fine. At scale (thousands of sessions from multiple users), Convex will scan the entire `pomodoroSessions` table sorted by `_creationTime` descending. A better approach: add a lightweight `users` table or a `by_startedAt` index on `startedAt` alone (not compound with `userId`). Low urgency — the dataset will stay small for a single-user app — but architecturally sloppy for a query that an agent calls on every invocation.

3. **No new E2E tests in four sprints.** Test coverage has been 7/10 since Sprint #2. The completion flow (timer reaches 0 → modal appears → save/skip) is the highest-value untested path. A short-duration timer test (1-2 seconds) would cover this without slowing the suite. The keyboard shortcut tests (Space to start/pause, Escape to reset) are equally straightforward. Every sprint that adds features without tests increases the risk that a future sprint silently breaks existing behavior.

4. **Sprint #6 changes are uncommitted.** All four modified files (`sessions.ts`, `SKILL.md`, `Timer.tsx`, `root.tsx`) show as unstaged changes. The sprint branch exists but has zero commits ahead of `main`/`sprint/5`. An agent running the sprint skill's PR step would have nothing to push. The changes need to be committed before the sprint can be finalized.

5. **CI does not test with Convex env vars.** Carry-over from Sprint #5. CI runs in degraded mode (no Convex backend). A broken Convex query — including the new `activeUserId` — would not be caught until staging. The typecheck partially covers this (type errors in Convex functions are caught), but runtime logic errors pass through.

6. **Font loading still uses external Google Fonts.** The `root.tsx` change adds a `preload` hint for JetBrains Mono, which is good. But fonts are still loaded from `fonts.googleapis.com` at runtime. The preload helps, but self-hosting the two font files (~50KB each) would eliminate the external dependency entirely and improve offline behavior (the SW could cache them). Also: Inter's weight range was trimmed from `100..900` to `400;600;700`, which reduces payload — good micro-optimization.

### P3 (Nice to Have)

1. **`activeUserId` returns `null` when no sessions exist but the skill instructions say "If null, no sessions exist yet."** This is correct documentation, but the skill does not provide guidance on what to do next — should the agent create a test session? Should it tell the user to open the app? A fallback instruction would make the skill more resilient for cold-start scenarios.

2. **AudioContext singleton is module-scoped.** The `let audioCtx` at module level means it persists across React hot-reloads in dev. Not a bug — `getAudioContext()` checks for `state === "closed"` — but worth noting for anyone debugging audio issues during development.

3. **Pomodoro-check skill removed the CLI one-liner.** The old skill had a `node -e` one-liner that formatted stats into a single line. The new version relies on separate query calls. The one-liner was convenient for quick terminal checks. Consider re-adding it using the `agentSummary` query output directly, which already returns formatted text.

4. **No lint/format enforcement.** Fifth sprint without ESLint or Prettier. Style is still consistent (single agent producing all code), but the risk compounds with each sprint.

5. **Test IDs still undocumented in CLAUDE.md.** `start-button`, `pause-button`, `stop-button`, `start-pomodoro-link` are critical test anchors used by both `smoke.spec.ts` and `timer.spec.ts`. An accidental rename during a future sprint would break E2E without any signal in CLAUDE.md.

## Detailed Analysis

### CLI Buildability (9/10, unchanged)

The CI pipeline is unchanged from Sprint #5:

```
npm ci → typecheck → playwright install → build → test
```

This remains the correct order: fast fail on types, then build, then E2E. The `root.tsx` font changes (preload hint, trimmed Inter weight range) are build-adjacent improvements that reduce network overhead but do not affect the pipeline itself.

The Playwright config's `STAGING_URL` toggle continues to work well — agents can test against local dev or staging with a single env var. The `webServer` block correctly passes an empty `VITE_CLERK_PUBLISHABLE_KEY` to ensure the app boots in degraded mode for CI.

Why not 10: same as Sprint #5. CI tests degraded mode only. A Convex-connected CI run would require infrastructure investment (test deployment, seed data) that is not justified for a single-user app at this stage.

### Skill Integration (8/10, +1)

This is the biggest Sprint #6 improvement. The `activeUserId` query solves the three-sprint-old P2 of hardcoded `"dev-user"`:

```typescript
export const activeUserId = query({
  args: {},
  handler: async (ctx) => {
    const latest = await ctx.db
      .query("pomodoroSessions")
      .order("desc")
      .first();
    return latest?.userId ?? null;
  },
});
```

The skill now has a clean two-step workflow:
1. `npx convex run sessions:activeUserId '{}'` — get the real userId
2. Use that userId in `stats`, `todayByUser`, `agentSummary` queries

This makes the skill work identically in dev (`"dev-user"`) and prod (`"user_2xABC..."`) without any configuration. The agent does not need to know which environment it is hitting — it discovers the userId dynamically.

The skill documentation was also cleaned up: hardcoded `"dev-user"` strings replaced with `"USER_ID"` placeholders, `agentSummary` moved into the main workflow section instead of being a footnote at the bottom, and the fragile `node -e` one-liner was removed in favor of the cleaner `agentSummary` query.

Why not 9: The `activeUserId` approach has a conceptual limitation — it returns the userId of whoever created the most recent session, which works for a single-user app but would break with multiple users. A `listUsers` query returning all distinct userIds with session counts would be more robust. Also, the skill lacks a cold-start fallback (what to do when `activeUserId` returns null).

### Code Organization (8/10, unchanged)

The AudioContext refactor is clean:

```typescript
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}
```

This fixes the Sprint #5 P2 of AudioContext leak (new context per completion, never closed). The singleton pattern with lazy initialization is the standard approach for Web Audio. The `onended` cleanup on oscillator/gain nodes (`osc.disconnect(); gain.disconnect()`) prevents node graph accumulation within the single context.

No new files were added, no structural changes. The project maintains its clean separation:
- `app/routes/` — 5 route files
- `app/components/` — 5 components
- `app/lib/` — 1 utility
- `convex/` — 3 source files + generated
- `e2e/` — 2 test files
- `.claude/skills/` — 3 skills

### Test Coverage (7/10, unchanged)

Static for the fourth consecutive sprint. The test suite remains at 13 tests (5 smoke + 8 timer):

**Covered:**
- Page loads (homepage, timer, history)
- Navigation between pages
- Timer display and mode switching
- Start, pause, resume, reset
- Counter display

**Not covered (same list as Sprint #5):**
- Timer completion (00:00 → notification → completion modal)
- Completion modal interaction (notes, tags, save, skip)
- Keyboard shortcuts (Space, Escape)
- Service worker registration and offline fallback
- Convex session persistence
- Auth flow
- Mobile responsive behavior

The completion modal added in Sprint #5 and the AudioContext fix in Sprint #6 are both untested. Each sprint that adds features without tests widens the gap between what works and what is verified to work.

### Sprint Autonomy (8/10, unchanged)

The Sprint #6 changes (activeUserId, AudioContext fix, font optimization) are all positive for long-term maintainability, but none directly improve sprint automation.

The `s.md` counter staleness (now two sprints behind) is a recurring friction point. An agent reading `s.md` at the start of a new sprint will see "Current Sprint: #5" and either:
- Create `sprint/6` (already exists, causing a branch collision)
- Correctly increment to `sprint/6` but not realize the branch exists with uncommitted work

The uncommitted changes on `sprint/6` add another trap: an agent starting a new sprint might checkout `sprint/6`, see uncommitted changes, and not know whether these are intentional work-in-progress or leftovers.

## Comparison with Previous Sprint

| Subcategory | Sprint #2 | Sprint #3 | Sprint #5 | Sprint #6 | Delta (vs #5) |
|-------------|-----------|-----------|-----------|-----------|---------------|
| CLI Buildability | 8 | 8 | 9 | 9 | 0 |
| Skill Integration | 7 | 7 | 7 | 8 | +1 |
| Code Organization | 8 | 8 | 8 | 8 | 0 |
| Test Coverage | 7 | 7 | 7 | 7 | 0 |
| Sprint Autonomy | 7 | 7 | 8 | 8 | 0 |
| **Overall** | **7.4** | **7.4** | **7.8** | **8.0** | **+0.2** |

### What Moved the Needle

- **`activeUserId` query + skill update** (+1 to Skill Integration) — the single highest-impact change. Eliminates a three-sprint-old architectural gap that made the pomodoro-check skill dev-only. The skill now works against any Convex deployment without configuration.
- **AudioContext singleton** (addresses Sprint #5 P2) — fixes a real resource leak. Each completion previously created a new AudioContext (browser limit is ~6 before they start failing silently). Now reuses one.
- **Font preload + weight trimming** (micro-optimization) — reduces time-to-first-paint by ~100-200ms on cold loads. Small but user-visible.

### What Did Not Move

- **Test coverage static at 7/10 for four sprints.** This is the single biggest drag on the overall score. The project is adding features (completion modal, service worker, activeUserId) faster than it is adding tests. The ratio of tested-to-untested surface area is worsening each sprint.
- **Sprint autonomy static at 8/10.** The `s.md` staleness pattern is now systemic — it has been flagged for four sprints and never fixed. This suggests the sprint close-out process (Step 8 in the sprint skill) is not being followed consistently.
- **Uncommitted changes** — Sprint #6 work exists only as working tree modifications, not commits. This is a process gap, not a code quality issue, but it blocks the sprint from being finalized.

### Path to 8.5+

To reach 8.5, the project needs to move the two stalled subcategories:

1. **Test Coverage → 8/10:** Add two tests:
   - Completion flow: Create a 1-second custom timer, let it reach 0, verify modal appears, interact with notes/tags, submit. (~15 lines of test code)
   - Keyboard shortcuts: Space starts the timer, Space again pauses, Escape resets. (~10 lines)
   These two tests would cover the two most critical untested paths and demonstrate that the test suite grows with features.

2. **Sprint Autonomy → 9/10:** Three changes:
   - Fix `s.md` sprint counter to #6 (30 seconds)
   - Commit the Sprint #6 changes (1 minute)
   - Add an explicit "Update s.md counter" step to the sprint skill's close-out sequence, or automate it with a post-commit hook

3. **Skill Integration → 9/10:** Add a `sessions:listUsers` query returning distinct userIds with session counts. Update the skill to handle multi-user scenarios gracefully. Add cold-start fallback instructions.

Items 1 and 2 alone would bring the score to approximately 8.4. All three would reach 8.6.

## Recommendations (Priority Order)

1. **Commit Sprint #6 changes and update `s.md`** — zero-effort, unblocks the sprint PR
2. **Add completion flow E2E test** — highest-value untested path, covers the Sprint #5 modal
3. **Add keyboard shortcut E2E test** — second highest-value, trivial to implement
4. **Add `sessions:listUsers` query** — future-proofs the skill for multi-user and provides richer agent context
5. **Self-host fonts** — eliminates Google Fonts external dependency, improves offline story
6. **Add ESLint** — prevent style drift as sprint count increases
7. **Automate `s.md` counter update in sprint skill** — stop the four-sprint pattern of stale counters
