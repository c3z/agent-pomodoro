# Developer Experience Review — Sprint #14

**Date:** 2026-03-15
**Reviewer:** Developer Experience
**Previous Scores:** Sprint #1: 6.4, Sprint #2: 7.4, Sprint #3: 7.4, Sprint #5: 7.8, Sprint #6: 8.0, Sprint #7: 8.6, Sprint #8: 9.0
**Overall:** 8.6/10

## Scores

| Subcategory | Sprint #8 | Sprint #14 | Delta | Notes |
|-------------|-----------|------------|-------|-------|
| CLI Buildability | 9/10 | 9/10 | 0 | Build pipeline unchanged. `npm run build` and `npm run test` scripts remain clean. No new dependencies that could break headless CI. Web Audio API and Wake Lock API are browser-only with proper guards, so SSR/build is unaffected. The empty Clerk key trick in `playwright.config.ts` still works for degraded-mode E2E. |
| Skill Integration | 8/10 | 8/10 | 0 | No skill file changes in Sprint #14. `pomodoro-check` skill workflow (`APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro status`) remains functional. REST API endpoints unchanged. The skill does not reference sounds or wake lock, nor does it need to — these are client-side features invisible to agents. |
| Code Organization | 9/10 | 8/10 | -1 | Timer.tsx has grown to 567 lines. Sprint #14 added ~100 lines of audio synthesis code (makeNote, playWorkCompleteSound, playBreakEndSound, playCompletionSound) plus wake lock functions, all inline in the same file. The audio code is pure utility with zero React dependency — it belongs in a separate module (e.g., `app/lib/sounds.ts`). Wake lock helpers similarly have no React coupling. Timer.tsx is now doing four jobs: timer logic, UI rendering, audio synthesis, and screen wake management. |
| Test Coverage | 9/10 | 7/10 | -2 | Sprint #14 introduced three user-facing features (work completion sound, break end sound, wake lock) with zero new E2E tests. The existing 21 tests do not exercise timer completion at all — the timer never reaches 0 in any test. There is no verification that `playCompletionSound` is called, no check that the completion modal appears after timer expiry, and no test for wake lock acquisition/release lifecycle. The sound and wake lock code paths are entirely untested at every level. |
| Sprint Autonomy | 8/10 | 8/10 | 0 | CLAUDE.md was updated in Sprint #13+ with accurate architecture. `s.md` has the Sprint #14 plan. However, `s.md` still says "Current Sprint: #13+" — it was not updated to reflect Sprint #14 as active or completed. The test count in CLAUDE.md says "21 tests" which appears to remain accurate (no new tests added). An agent starting Sprint #15 would need to read `s.md` to find the plan but would see the stale sprint counter. |

## Findings

### P1 (Blockers)

None.

### P2 (Should Fix)

1. **Timer.tsx exceeds single-responsibility: 567 lines mixing 4 concerns.** The audio synthesis code (`makeNote`, `playWorkCompleteSound`, `playBreakEndSound`, `playCompletionSound` — lines 31-100) is pure JavaScript with no React hooks or JSX. It should be extracted to `app/lib/sounds.ts`. The wake lock helpers (`requestWakeLock`, `releaseWakeLock` — defined inside the component but referencing only a ref) should be extracted to `app/lib/wakeLock.ts` or at minimum moved to a custom hook (`useWakeLock`). Currently, any agent modifying audio frequencies must edit Timer.tsx, risking unrelated regressions in timer logic or UI.

2. **No test coverage for Sprint #14 features.** Three features shipped with zero tests:
   - **Sounds:** Web Audio API calls cannot easily be verified in Playwright, but the *effect* of completion can be tested — when the timer hits 0, the completion modal should appear. This flow is untested across 14 sprints.
   - **Wake Lock:** Playwright does not expose Wake Lock API, but the lifecycle (acquired on start, released on pause/stop/completion) could be tested via a mock or by verifying no console errors are thrown.
   - **Vibration:** `navigator.vibrate` is not available in headless Chromium, but the conditional check (`"vibrate" in navigator`) prevents crashes. Still, no test verifies it does not break non-vibration browsers.

   At minimum, a completion flow E2E test (short timer or clock mock -> modal appears -> save works -> timer advances to break) would cover the most critical untested path and implicitly validate that sound/wake lock code does not throw.

3. **`s.md` sprint counter stale.** Shows "Current Sprint: #13+ (cleanup done)" but Sprint #14 items are listed in the upcoming section. An agent reading `s.md` to determine the current sprint number would incorrectly create `sprint/13` branch or be confused about state. The counter should be updated to "Current Sprint: #14" with status.

4. **Silent `catch {}` blocks suppress real errors during development.** Four empty catch blocks in Timer.tsx:
   - `playWorkCompleteSound` line 74: `catch {}`
   - `playBreakEndSound` line 88: `catch {}`
   - `requestWakeLock` line 146: `catch {}`
   - `releaseWakeLock` line 149: `catch(() => {})`

   In production, swallowing audio/wake lock errors is correct — these are non-critical. But during development, a `console.debug` in the catch would help agents diagnose issues like "sound is not playing" without debugging blind. A conditional `import.meta.env.DEV && console.debug(...)` pattern would preserve silent production behavior while aiding agent debugging.

### P3 (Nice to Have)

1. **`makeNote` does not disconnect nodes on error path.** If `osc.start()` throws (e.g., AudioContext closed), the oscillator and gain nodes are never disconnected. The `osc.onended` callback handles the happy path, but an error would leak nodes. Wrapping the start/stop in try-catch with explicit disconnect would prevent Web Audio resource leaks on edge cases.

2. **AudioContext singleton has no explicit cleanup.** The module-level `audioCtx` variable persists for the lifetime of the page. If the user navigates away from the timer page and back multiple times, the same AudioContext is reused (which is correct), but it is never explicitly closed. In practice, browsers handle this well, but a `useEffect` cleanup in the Timer component that calls `audioCtx.close()` on unmount would be formally correct.

3. **PWA manifest maskable icon uses same source as regular icon.** `manifest.json` line 23-28 uses `/icon-512.png` for both regular and maskable purposes. Maskable icons should have extra padding (safe zone) to avoid clipping on Android. Using the same image means the icon edges may be cut off on devices that apply the maskable mask. A separate `icon-512-maskable.png` with 20% padding would fix this.

4. **No ESLint or format enforcement.** Carried forward from Sprint #8. The codebase remains consistent due to single-agent authorship, but the Sprint #14 audio code introduces a new pattern (module-level singleton, `osc.onended` cleanup callbacks) that future agents might replicate incorrectly without lint guardrails.

5. **`--help-llm` version is stale.** `packages/apom/bin/apom.mjs` line 183 shows `version: "0.1.0"` in the LLM help JSON, but `packages/apom/package.json` declares `version: "0.2.0"`. An agent parsing `--help-llm` output would see the wrong version.

6. **CLAUDE.md does not document Sprint #14 features.** The architecture section describes `Timer.tsx` as "Core timer logic + UI + completion modal" — it does not mention sounds, vibration, or wake lock. An agent reading CLAUDE.md would not know these features exist, which could lead to reimplementation or conflicting changes. Adding "sounds (Web Audio), vibration, wake lock" to the Timer.tsx description would fix this.

7. **Dashboard tests still assert CSS class for active state.** `dashboard.spec.ts` line 14 checks `toHaveClass(/text-white/)`. Carried forward from Sprint #8. Using `aria-pressed` or `data-active` attribute would be more resilient.

## Detailed Analysis

### CLI Buildability (9/10, unchanged)

The build and test pipeline is unaffected by Sprint #14 changes. The key reason: all three features (Web Audio, Wake Lock, Vibration) use proper browser API guards:

- `getAudioContext()` creates AudioContext on demand, not at import time
- `requestWakeLock()` checks `typeof navigator !== "undefined" && "wakeLock" in navigator`
- `playCompletionSound()` has try-catch wrapping all Web Audio calls
- `navigator.vibrate` is behind `"vibrate" in navigator` check

None of these will throw during SSR (React Router build) or in headless Chromium (Playwright). The build remains `npm ci && npm run build && npm run test` with no human intervention needed.

The `package.json` scripts are minimal and unchanged. No new devDependencies were added — the audio synthesis is pure Web Audio API, no third-party sound library. This is the right call for a 4-note chime.

Why not 10: same as Sprint #8. CI runs without Convex env vars, so the Convex integration path (session mutations, API key validation, REST endpoints) is never tested in CI. This is a known, accepted gap for a single-user app.

### Skill Integration (8/10, unchanged)

Sprint #14 features are client-side PWA enhancements. They do not affect:
- REST API endpoints (`/api/status`, `/api/stats`, `/api/sessions/*`)
- CLI tool (`agent-pomodoro status/stats/sessions`)
- `pomodoro-check` skill workflow
- `agent-onboarding` skill documentation

The skills remain functional and accurate. The `pomodoro-check` skill's interpretation rules (4+ sessions/day = good, hoursSinceLastSession > 24 = scold) are unaffected by whether the app makes sounds.

Why not 9: same gaps as Sprint #8. The `activeUserId` query has no cold-start fallback. The `--help-llm` version is stale (0.1.0 vs 0.2.0). The morning/evening integration described in the skill is aspirational. None of these are Sprint #14 regressions.

### Code Organization (8/10, -1 regression)

This is the primary regression in Sprint #14. Timer.tsx was 450~ lines at Sprint #8 and is now 567 lines. The growth comes from well-written but misplaced code:

**Audio synthesis (lines 31-100, ~70 lines):**
```
makeNote() — pure function, takes AudioContext + params
playWorkCompleteSound() — composes makeNote calls
playBreakEndSound() — composes makeNote calls
playCompletionSound() — dispatches to the above + vibration
```
None of these reference React state, props, refs, or hooks. They are pure audio utilities that happen to live in a React component file. An `app/lib/sounds.ts` module would:
- Make sounds independently testable (unit tests with mocked AudioContext)
- Allow other components to reuse sounds in the future
- Reduce Timer.tsx cognitive load for agents modifying timer behavior

**Wake Lock (lines 139-151, ~13 lines):**
The `requestWakeLock` and `releaseWakeLock` functions use `wakeLockRef` which is defined inside the Timer component. This creates a coupling that could be cleanly abstracted into a `useWakeLock()` custom hook returning `{ request, release }` functions. The hook would own its own ref and cleanup.

**Why -1 and not -2:** The code within Timer.tsx is well-structured internally. Functions are named clearly. The `playCompletionSound(mode)` dispatcher cleanly separates work/break sounds. The wake lock calls are placed at exactly the right lifecycle points (start, pause, stop, completion, visibility change). The issue is file-level organization, not code quality.

### Test Coverage (7/10, -2 regression)

This is the largest regression. Sprint #14 shipped three features with zero test coverage:

**What exists (21 tests, unchanged):**
- `smoke.spec.ts` (6 tests): page loads, navigation
- `timer.spec.ts` (11 tests): display, mode switching, start/pause/reset, keyboard shortcuts
- `dashboard.spec.ts` (4 tests): period selector, stat cards

**What is missing after Sprint #14:**

1. **Timer completion flow (P1 gap, now 14 sprints old):** No test runs the timer to 0. This means:
   - `playCompletionSound()` is never invoked in tests
   - The completion modal (`showCompletion` state) is never rendered in tests
   - The `advanceAfterCompletion` flow (pomodoro counter increment, mode switch to break) is never verified
   - `releaseWakeLock()` on completion is never called in tests

   Playwright supports clock mocking (`page.clock.install()` + `page.clock.fastForward()`). A test could install a fake clock, start the timer, fast-forward 25 minutes, and verify the modal appears.

2. **Sound code has no test at any level:** No unit test for `makeNote`. No integration test for `playWorkCompleteSound`. No E2E verification that AudioContext is created. Web Audio in headless Chromium does work (it is supported), so a test could at minimum verify that `playCompletionSound("work")` does not throw.

3. **Wake Lock has no test at any level:** `navigator.wakeLock` is not available in headless Chromium by default, but the guard (`"wakeLock" in navigator`) means the code path simply skips. A test should verify that starting the timer does not throw a wake lock error in environments where the API is unavailable.

**Why -2 and not -1:** Three new feature code paths were added, all untested, and the highest-value existing test gap (completion flow) was not addressed despite being recommended in every review since Sprint #5. The ratio of untested feature code to tested feature code has grown worse.

### Sprint Autonomy (8/10, unchanged)

An agent starting Sprint #15 has a mixed experience:

**What works:**
- CLAUDE.md architecture section accurately lists all files (though Timer.tsx description is incomplete — no mention of sounds/wake lock)
- `s.md` contains the Sprint #15 plan (agent write-back: start/stop via CLI + API)
- Convex deployment names are documented
- Build/test commands are documented and functional
- Skills are documented with copy-paste bash commands

**What creates friction:**
- `s.md` says "Current Sprint: #13+" — an agent would need to infer Sprint #14 is done by reading the sprint plan list
- Timer.tsx description in CLAUDE.md says "Core timer logic + UI + completion modal" without mentioning sounds, vibration, or wake lock — an agent modifying Timer.tsx for Sprint #15 would encounter unexpected code
- The `--help-llm` version mismatch (0.1.0 vs 0.2.0) could confuse an agent checking CLI version compatibility

**Why 8 and not 7:** Despite the stale counter, the project is still highly navigable. CLAUDE.md + `s.md` + skills give an agent 90% of what it needs. The gaps are friction, not blockers.

## Comparison with Previous Sprint

| Subcategory | Sprint #6 | Sprint #7 | Sprint #8 | Sprint #14 | Delta (vs #8) |
|-------------|-----------|-----------|-----------|------------|---------------|
| CLI Buildability | 9 | 9 | 9 | 9 | 0 |
| Skill Integration | 8 | 8 | 8 | 8 | 0 |
| Code Organization | 8 | 9 | 9 | 8 | -1 |
| Test Coverage | 7 | 9 | 9 | 7 | -2 |
| Sprint Autonomy | 8 | 8 | 10 | 8 | -2 |
| **Overall** | **8.0** | **8.6** | **9.0** | **8.0** | **-1.0** |

Note: Overall is the arithmetic mean of the five subcategories. The drop from 9.0 to 8.0 is primarily driven by Test Coverage (-2) and Sprint Autonomy (-2, down from the exceptional 10/10 in Sprint #8).

### What Moved the Needle (Downward)

- **Test Coverage regression (-2):** Three features shipped with zero tests. The completion flow E2E test has been the top recommendation for 9 sprints running. Sprint #14 made this gap worse by adding more untested code paths.

- **Code Organization regression (-1):** Timer.tsx crossed the complexity threshold. Audio synthesis code belongs in a utility module. The single-file approach worked at 400 lines; at 567 lines with 4 distinct concerns, it is a maintenance risk.

- **Sprint Autonomy regression (-2 from Sprint #8's 10):** Sprint #8's documentation overhaul brought Sprint Autonomy to a perfect 10. Sprint #14 let `s.md` counter go stale and did not update CLAUDE.md to reflect new features. This is the same documentation drift pattern that Sprints #3-#7 exhibited.

### What Held Steady

- **CLI Buildability at 9/10:** Stable across 8 sprints. Browser API guards prevent build/SSR issues. No new dependencies.
- **Skill Integration at 8/10:** Stable across 6 sprints. Agent-facing interfaces unchanged.

### Path Back to 9.0+

1. **Test Coverage -> 9/10:** Add completion flow E2E test using Playwright clock mocking. This single test would validate sounds-don't-throw, modal appears, save works, timer advances. Optionally add a unit test for `makeNote` / `playCompletionSound` to verify no throws. (+2 to Test Coverage, +0.4 to overall)

2. **Code Organization -> 9/10:** Extract audio code to `app/lib/sounds.ts` and wake lock to `app/lib/wakeLock.ts` (or `useWakeLock` hook). Timer.tsx drops to ~450 lines. (+1 to Code Organization, +0.2 to overall)

3. **Sprint Autonomy -> 9/10:** Update `s.md` counter to "Current Sprint: #14 (completed)" with Sprint #14 history entry. Update CLAUDE.md Timer.tsx description to include sounds/vibration/wake lock. Fix `--help-llm` version. (+1 to Sprint Autonomy, +0.2 to overall)

All three fixes together: 9.0 + 0.4 + 0.2 + 0.2 = projected 8.8. The remaining gap to 9.0+ requires the CI-with-Convex improvement (CLI Buildability -> 10) or multi-user skill support (Skill Integration -> 9).

## Recommendations (Priority Order)

1. **Extract audio code to `app/lib/sounds.ts`** — move `makeNote`, `playWorkCompleteSound`, `playBreakEndSound`, `playCompletionSound`, and the `audioCtx` singleton. Timer.tsx imports and calls `playCompletionSound(mode)`. This is a mechanical refactor with zero behavior change.

2. **Add completion flow E2E test** — 14th sprint where this is recommended. Use Playwright `page.clock.install()` + `page.clock.fastForward('25m')` or use a 1-second custom timer duration injected via URL param / test fixture. Verify: modal appears, tags are clickable, save advances to break mode.

3. **Update `s.md`** — set "Current Sprint: #14", add Sprint #14 history entry (sounds, wake lock, PWA manifest), move Sprint #15 to "current."

4. **Update CLAUDE.md Timer.tsx description** — change "Core timer logic + UI + completion modal" to "Core timer logic + UI + completion modal + sounds (Web Audio) + vibration + wake lock."

5. **Fix `--help-llm` version** — sync `apom.mjs` line 183 to `"0.2.0"` matching `package.json`.

6. **Add `console.debug` in catch blocks for dev mode** — `catch (e) { if (import.meta.env.DEV) console.debug('[audio]', e); }` in the four empty catches.

7. **Extract wake lock to `useWakeLock` hook** — lower priority than sounds extraction since wake lock is only ~13 lines, but completes the single-responsibility cleanup.
