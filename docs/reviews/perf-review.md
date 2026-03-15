# Performance Review — Agent Pomodoro (Sprint #2)

**Reviewer:** Performance
**Date:** 2026-03-15
**Previous score:** 5.4/10
**Files reviewed:** `app/components/Timer.tsx`, `app/routes/timer.tsx`, `vite.config.ts`, `package.json`, `app/routes/layout.tsx`, `app/components/Providers.tsx`, `app/app.css`

---

## Sprint 2 Changes Evaluated

- Wall-clock anchor (`endTimeRef` + `Date.now()`) — resolves previous P1-PERF-01
- 250ms tick interval — resolves previous P1-PERF-01
- `visibilitychange` handler recalculates on tab focus — resolves previous P1-PERF-02
- Stable callback refs (`onCompleteRef`, `onInterruptRef`, `onStartRef`) — resolves previous P2-PERF-05, P2-PERF-06
- `isPaused` state separate from `isRunning` — cleaner state machine
- Web Audio API for completion sound — replaces broken base64 approach
- try/catch on Convex mutations in `timer.tsx` — partially resolves previous P1-PERF-07

---

## Scores

| # | Subcategory | Score | Prev | Delta | Notes |
|---|-------------|-------|------|-------|-------|
| 1 | Timer Accuracy | 8/10 | 4 | +4 | Wall-clock anchor + visibilitychange. Solid. |
| 2 | Initial Load | 7/10 | 7 | 0 | No change. Still lean, still no font optimization. |
| 3 | Bundle Size | 8/10 | 8 | 0 | No change. Dependencies unchanged. |
| 4 | State Management | 6/10 | 5 | +1 | Ref pattern fixes callback churn, but new issues introduced. |
| 5 | Offline Capability | 4/10 | 3 | +1 | try/catch added, but no retry queue or PWA. |

**Overall: 6.6 / 10** (prev 5.4, delta +1.2)

---

## 1. Timer Accuracy — 8/10

The wall-clock anchor is correctly implemented. `endTimeRef` stores the absolute end timestamp (line 244), and each tick computes remaining time via `Math.ceil((endTimeRef.current - Date.now()) / 1000)` (lines 128-131). This self-corrects on every tick regardless of JS event loop delays.

The 250ms tick interval is a good choice — fast enough that the display never visually lags by more than 250ms, but not so fast that it wastes cycles. The `visibilitychange` handler (lines 190-203) correctly recalculates remaining time when the tab regains focus, fixing the background-tab problem.

**What's good:**
- Wall-clock anchor eliminates cumulative drift entirely
- `visibilitychange` ensures correct display after tab switch
- Immediate first tick on line 146 prevents a 250ms delay on start
- Pause correctly freezes the remaining time from the wall clock (lines 253-256)

**Remaining concern:**
- The 250ms interval means 4 state updates per second, each causing a full re-render of the Timer component. This is fine on desktop but worth monitoring on low-end mobile devices. A 1-second interval with wall-clock correction would be equally accurate for display purposes (the display only shows whole seconds anyway).

**No P1 issues.** Previous P1-PERF-01 and P1-PERF-02 are resolved.

---

## 2. Initial Load — 7/10

No changes in Sprint 2. The dependency list remains lean. SSR is enabled.

**Remaining concerns (unchanged from Sprint 1):**
- JetBrains Mono and Inter are declared in CSS `@theme` (app.css lines 4-5) but no `@font-face` with `font-display: swap` is visible. If these fonts are not actually loaded, the declarations are harmless fallbacks. If they are loaded (e.g., via an HTML `<link>`), there could be a FOIT (flash of invisible text) blocking first paint.
- No `preload` hints for critical resources.

---

## 3. Bundle Size — 8/10

No changes in Sprint 2. The dependency list is identical. No new packages added. The Web Audio API is a browser built-in — zero bundle cost, good choice.

Clerk remains the heaviest dependency (~80kB gzipped) but is architecturally required.

---

## 4. State Management — 6/10

The stable callback ref pattern (lines 93-98) correctly eliminates the previous interval teardown problem. The tick effect now depends only on `[isRunning]` (line 153), meaning the interval is created once when the timer starts and destroyed once when it stops. This is correct.

**New issues introduced:**

### Keyboard effect re-registers on every render (P1)

The keyboard shortcut `useEffect` (lines 206-227) has **no dependency array**. This means:
- It runs after every render
- The 250ms tick causes a state update (`setSecondsLeft`) 4 times per second
- Each state update re-renders the Timer component
- Each re-render tears down the `keydown` listener and adds a new one
- Result: ~4 `addEventListener`/`removeEventListener` cycles per second during countdown

This is wasteful. The effect closes over `isRunning` to decide between `pause()` and `start()`, but `start` and `pause` are also recreated each render. The fix: use refs for `isRunning` (or for the `start`/`pause` functions) and add `[]` as the dependency array.

### Completion detection is fragile (P2)

The completion flow uses two separate mechanisms:
1. The tick effect (line 133-142) detects `remaining <= 0`, clears the interval, sets `isRunning = false`, plays sound, and sets `startedRef.current = false`
2. A separate `useEffect` (lines 164-187) watches `[secondsLeft, isRunning, mode]` and fires when `secondsLeft === 0 && !isRunning && completedRef.current`

The `completedRef` flag is armed in `start()` (line 241) and consumed in the completion effect (line 167). There's also a dead effect at lines 156-161 that does nothing (empty body). This two-phase completion detection works but is hard to reason about. If React batches the state updates differently in a future version, or if `completedRef` gets out of sync, the completion callback could be missed or double-fired.

### AudioContext created per completion (P3)

`playCompletionSound()` creates a new `AudioContext` on every call (line 33) and never calls `ctx.close()`. After the oscillators finish, the context stays allocated. Over many pomodoros, this leaks audio contexts. Most browsers limit the number of concurrent `AudioContext` instances (Chrome: 6). After 6 completed pomodoros, the sound could silently fail.

### SVG re-render on every tick (P3)

The progress ring SVG (lines 307-332) recalculates `strokeDashoffset` on every render. The SVG `transition-all duration-300` CSS class means the browser also animates the transition every 250ms. This creates overlapping CSS transitions — each tick starts a 300ms animation, but the next tick arrives 250ms later and starts a new one. The visual result is usually fine (smooth arc movement) but it's technically wasted GPU compositing work.

---

## 5. Offline Capability — 4/10

Sprint 2 added try/catch around all three Convex mutations in `timer.tsx` (lines 27-29, 33-35, 43-45). Failed mutations now log a warning instead of throwing. The timer continues to function locally even if the backend is unreachable. This is a meaningful improvement — the timer no longer breaks on network failure.

**Remaining gaps:**

- **No retry or local persistence.** When a `startSession` mutation fails, the session is simply lost. There's no localStorage fallback, no queue-and-retry. A user who does a focus session on a train with spotty wifi will have no record of it.
- **No service worker / PWA.** The app cannot load at all without a network connection. For a pomodoro timer — an app you want to open instantly, possibly in airplane mode — this is a significant gap.
- **Clerk dependency at app level.** If Clerk's CDN is unreachable, the auth provider may hang. The `Providers.tsx` gracefully handles missing `CLERK_KEY` (line 27-29) but not a Clerk SDK that loads but cannot reach its servers.
- **visibilitychange handler has a minor offline issue.** Line 192 checks `endTimeRef.current > 0` but not `isRunning`. If the timer was paused (endTimeRef still holds a stale value), regaining focus could incorrectly update `secondsLeft`. However, since pausing also calculates remaining time (line 253-256), this is unlikely to cause visible bugs in practice — the stale endTimeRef just produces a negative remaining, which gets clamped to 0 by `Math.max(0, ...)`. Still, it's imprecise.

---

## Issue Summary

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| P1-PERF-01 | ~~P1~~ | ~~Timer drift — wall-clock anchor~~ | **RESOLVED** in Sprint 2 |
| P1-PERF-02 | ~~P1~~ | ~~Background tab throttling — visibilitychange~~ | **RESOLVED** in Sprint 2 |
| P1-PERF-07 | ~~P1~~ | ~~Offline mutations fail silently~~ | **PARTIAL** — try/catch added, no retry queue |
| P2-PERF-05 | ~~P2~~ | ~~Unstable callback refs~~ | **RESOLVED** in Sprint 2 |
| P2-PERF-06 | ~~P2~~ | ~~handleComplete in useEffect deps~~ | **RESOLVED** in Sprint 2 |
| **P1-PERF-09** | **P1** | **Keyboard useEffect has no dependency array — re-registers listener ~4x/sec** | NEW |
| **P2-PERF-10** | **P2** | **Completion detection via dual effects + completedRef is fragile** | NEW |
| P2-PERF-08 | P2 | No service worker / PWA — app cannot load offline | OPEN (from Sprint 1) |
| **P2-PERF-11** | **P2** | **No retry queue for failed mutations — sessions lost on network failure** | NEW |
| **P3-PERF-12** | **P3** | **AudioContext leak — new context per completion, never closed** | NEW |
| **P3-PERF-13** | **P3** | **SVG progress ring: overlapping CSS transitions (300ms anim, 250ms tick)** | NEW |
| P3-PERF-03 | P3 | Font loading strategy unverified | OPEN (from Sprint 1) |
| P3-PERF-04 | P3 | Clerk could be lazy-loaded | OPEN (from Sprint 1) |

**P1 count: 1** | P2 count: 3 | P3 count: 4

---

## P1 Detail: P1-PERF-09 — Keyboard Effect Missing Dependency Array

**File:** `app/components/Timer.tsx` lines 206-227

The `useEffect` for keyboard shortcuts has no dependency array:

```ts
useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { ... };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
}); // <-- no dependency array
```

Without a dependency array, this effect runs after **every render**. During countdown, the Timer re-renders 4 times per second (250ms tick interval). Each re-render:
1. Removes the previous `keydown` listener
2. Creates a new closure capturing current `isRunning`
3. Adds the new listener

This is 8 DOM API calls per second (add + remove) for the entire duration of a pomodoro — ~12,000 unnecessary listener operations per 25-minute session.

**Fix:** Use refs for the handler dependencies and add `[]` as the dependency array:

```ts
const isRunningRef = useRef(isRunning);
isRunningRef.current = isRunning;

useEffect(() => {
  const handleKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === "Space") {
      e.preventDefault();
      if (isRunningRef.current) pause(); else start();
    } else if (e.code === "Escape") {
      e.preventDefault();
      stop();
    }
  };
  window.addEventListener("keydown", handleKey);
  return () => window.removeEventListener("keydown", handleKey);
}, []);
```

Note: `start`, `pause`, `stop` would also need to be stabilized (via refs or `useCallback` with stable deps) for this to work correctly. Alternatively, move the dispatch logic into refs as well.

---

## Verdict

Sprint 2 made the right calls. The two most critical P1s from Sprint 1 (timer drift and background-tab accuracy) are properly fixed. The wall-clock anchor implementation is clean and correct. The stable callback ref pattern eliminates the interval teardown churn. try/catch on mutations prevents crashes on network failure.

The score moves from 5.4 to 6.6 — a solid improvement driven entirely by timer accuracy gains (+4 points in that subcategory).

The new P1 (keyboard effect churn) is less severe than the old P1s — it wastes CPU cycles but doesn't produce incorrect behavior. Still, it should be fixed in the next sprint. The completion detection complexity (P2-PERF-10) and missing PWA support (P2-PERF-08) are the next priorities after that.

**Previous blockers resolved: 2/3.** Timer accuracy is no longer a concern. Offline resilience is partially addressed but still incomplete (no retry, no PWA).
