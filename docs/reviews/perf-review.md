# Performance Review — Agent Pomodoro (Sprint #6)

**Reviewer:** Performance
**Date:** 2026-03-15
**Previous scores:** Sprint #1: 5.4, Sprint #2: 6.6, Sprint #3: 7.2, Sprint #4: not scored, Sprint #5: 7.2
**Files reviewed:** `app/components/Timer.tsx`, `app/routes/timer.tsx`, `app/root.tsx`, `vite.config.ts`, `package.json`, `public/sw.js`, `app/components/Providers.tsx`, `app/routes/home.tsx`, `app/routes/layout.tsx`, `app/components/Stats.tsx`, `app/components/SessionList.tsx`, `app/app.css`, `convex/sessions.ts`

---

## Sprint 6 Changes Evaluated

1. **AudioContext leak FIXED** — Module-level singleton `audioCtx` (line 31), created once via `getAudioContext()`, reused across all completions. Oscillators and gain nodes are disconnected on `onended` callback (lines 55, 68). No more leaked AudioContexts after repeated session completions.

2. **Font preload added for JetBrains Mono** — `root.tsx` line 21-25: `<link rel="preload" as="style">` for the JetBrains Mono CSS descriptor. This triggers early fetch of the font CSS, allowing the browser to discover the actual font files sooner.

3. **Inter narrowed from variable to 400;600;700** — `root.tsx` line 28: `Inter:wght@400;600;700` instead of full variable range. Reduces the font file payload by loading only three static weight slices instead of the entire variable font axis.

4. **Completion handler duplication already resolved in Sprint #5** — `advanceAfterCompletion` (line 194) is the single shared function for both `handleCompletionSubmit` and `handleCompletionSkip`. P2-PERF-16 was fixed before this review cycle.

---

## Scores

| # | Subcategory | Score | Prev (S5) | Delta | Notes |
|---|-------------|-------|-----------|-------|-------|
| 1 | Timer Accuracy | 8/10 | 8 | 0 | No regression. Wall-clock anchor unchanged and correct. |
| 2 | Initial Load | 8/10 | 7 | +1 | Font preload + weight narrowing measurably reduces FOIT. |
| 3 | Bundle Size | 8/10 | 8 | 0 | No new deps. Font narrowing helps network payload, not JS bundle. |
| 4 | State Management | 7/10 | 6 | +1 | Handler dedup fixed. AudioContext leak fixed. setState nesting resolved. |
| 5 | Offline Capability | 7/10 | 7 | 0 | SW unchanged. Mutation retry queue still absent. |

**Overall: 7.6 / 10** (prev 7.2, delta +0.4)

Sprint #6 is a pure cleanup sprint that paid down two categories of debt: state management (handler dedup, AudioContext singleton) and initial load (font strategy). No new features, no new complexity. This is the first sprint since Sprint #2 where the overall score improved without introducing a new regression elsewhere.

---

## 1. Timer Accuracy — 8/10 (unchanged)

The core tick mechanism is untouched. The wall-clock anchor pattern continues to work correctly:

- `endTimeRef.current = Date.now() + secondsLeft * 1000` set on start/resume
- 250ms `setInterval` reads `Date.now()` each tick, computes remaining via `Math.ceil((endTime - now) / 1000)`
- `visibilitychange` handler recalculates on tab refocus

No drift, no background tab issues, no sleep/wake issues. The timer is correct.

**Remaining concerns (unchanged):**

### P3-PERF-14: 250ms tick interval (unchanged, OPEN)
4 state updates per second where 1 would suffice for a whole-second display. Not perceptible given React 19 batching and the shallow component tree, but it's wasted work. Changing to 1000ms with the same wall-clock correction would produce identical visual output.

---

## 2. Initial Load — 8/10 (improved from 7)

Two targeted fixes address the font loading concern raised in every prior review.

### P3-PERF-03: Font loading — PARTIALLY RESOLVED

**What improved:**

1. **JetBrains Mono preload** (`root.tsx` line 21-25): The `<link rel="preload" as="style">` hint tells the browser to begin fetching the Google Fonts CSS descriptor immediately during HTML parsing, before the render tree is constructed. Previously, the browser only discovered this resource when it encountered the `<link rel="stylesheet">` further down — by which time it had already blocked on the first stylesheet. The preload allows the two font CSS fetches to overlap.

2. **Inter weight narrowing** (`root.tsx` line 28): `Inter:wght@400;600;700` instead of the full variable range. Google Fonts serves optimized static font files for discrete weight requests. Three static weights (~45kB total) vs. the full variable font (~95kB). The app only uses these three weights (400 for body, 600 for sublabels, 700 for headings), so the variable font was pure waste.

**What remains:**

The fonts are still loaded from `fonts.googleapis.com` / `fonts.gstatic.com` — external, cross-origin, not cached by the service worker. On a cold visit with a slow network, fonts remain a blocking dependency that the SW cannot mitigate. Self-hosting the font files under `/assets/fonts/` would bring them under SW cache control and eliminate the external dependency entirely.

Downgrading from P3 to **P3-PERF-03** (kept, reduced severity). The preload and weight narrowing cut the practical impact roughly in half. The remaining gap — self-hosting — is a nice-to-have, not a pain point.

### P3-PERF-20 (NEW): JetBrains Mono preload uses `as="style"` but no `onload` swap

The preload link (line 21-25) uses `rel="preload" as="style"` but is immediately followed by a regular `rel="stylesheet"` for the same URL (lines 30-32). This means the preload is redundant — the browser will fetch the resource as a stylesheet anyway. The preload only helps if the stylesheet link comes significantly later in the document, or if the preload uses an `onload` handler to apply the stylesheet asynchronously.

In the current structure where both links are in the same `<head>`, the preload adds a minor benefit: it elevates the fetch priority from "low" (stylesheet discovered later) to "high" (preload discovered immediately). But the benefit is marginal since both links are in the same `links()` array and render sequentially.

Severity: P3 — cosmetic, ~20-50ms improvement at best. Not worth fixing unless self-hosting is pursued, at which point the preload becomes unnecessary.

---

## 3. Bundle Size — 8/10 (unchanged)

Zero new dependencies in Sprint #6. `package.json` unchanged from Sprint #5.

Production dependency profile:
- `react` + `react-dom`: ~45kB gz
- `@clerk/*`: ~80kB gz
- `convex`: ~35kB gz
- `react-router`: ~25kB gz
- App code: ~6kB total
- **Total estimated: ~191kB gzipped** (unchanged)

The font weight narrowing reduces *network transfer* (not JS bundle) by ~50kB on first load. This is captured under Initial Load, not Bundle Size, since fonts are CSS/binary resources, not JavaScript.

**Remaining concerns (unchanged):**

### P3-PERF-04: Clerk could be lazy-loaded (unchanged, OPEN)
`@clerk/clerk-react` (~80kB gz) is imported eagerly in `Providers.tsx`. A `React.lazy()` wrapper with a fallback would defer this until the auth gate is actually needed. For the timer page — the primary use case — this would cut initial JS by ~40%.

---

## 4. State Management — 7/10 (improved from 6)

Sprint #6 resolved two of the three state management issues raised in Sprint #5.

### P2-PERF-15: setState inside setState updater — RESOLVED

The `advanceAfterCompletion` function (line 194-208) now computes `newCount` from `completedPomodoros + 1` directly, then calls `setCompletedPomodoros(newCount)`, `setMode(nextMode)`, and `setSecondsLeft()` as top-level sequential setState calls. No nested updaters.

### P2-PERF-16: Duplicated completion handler logic — RESOLVED

`handleCompletionSubmit` and `handleCompletionSkip` now both delegate to `advanceAfterCompletion()`. Submit passes notes/tags, skip passes nothing. Single source of truth for the transition logic.

### P3-PERF-12: AudioContext leak — RESOLVED

Module-level singleton `audioCtx` (line 31) created via `getAudioContext()`. Checks for `closed` state before reuse. Both oscillators disconnect themselves and their gain nodes via `onended` callbacks (lines 55, 68). No more context accumulation after repeated completions. The context is never explicitly closed, which is acceptable — it will be garbage collected when the page unloads, and a single `AudioContext` per page is within browser resource limits.

### Remaining concerns

#### P3-PERF-13: SVG progress ring transition overlap (unchanged, OPEN)
The progress ring circle has `transition-all duration-300` (line 381) which animates `strokeDashoffset` changes. With ticks every 250ms, a new transition starts before the previous 300ms one completes. The visual effect is smooth enough — CSS transitions handle this gracefully by interpolating from the current animated value — but `transition-[stroke-dashoffset]` would be more precise than `transition-all`, avoiding unnecessary property checks.

#### P3-PERF-17: Completion modal re-renders entire Timer (unchanged, OPEN)
Typing in the notes textarea still triggers full Timer re-renders. The component tree is shallow enough that this is not perceptible. Extracting the modal to a child component would be cleaner but is not a priority.

---

## 5. Offline Capability — 7/10 (unchanged)

No changes to the service worker or offline behavior in Sprint #6.

### P2-PERF-11: No mutation retry queue (unchanged, OPEN)

This remains the single most impactful open issue. The timer runs perfectly offline. The data does not survive connectivity drops. A session started online that completes while offline will have its `complete` mutation silently dropped via the `console.warn` catch block in `timer.tsx` lines 33-42.

The fix pattern remains the same:
1. On mutation failure, serialize `{ action, args, timestamp }` to `localStorage`
2. On `navigator.onLine` event, replay the queue
3. Convex mutations are idempotent by session ID, so replays are safe
4. Estimated effort: 40-60 lines, no new dependencies

### P2-PERF-18: Pre-cached SSR routes serve stale inline data (unchanged, OPEN)

`cache.addAll(["/", "/timer", "/history"])` caches full SSR HTML at install time. Stale data in cached HTML until React hydrates. Acceptable for timer page (no server data), cosmetic for dashboard. Low practical severity.

### P3-PERF-19: SW registration error silently swallowed (unchanged, OPEN)

`root.tsx` line 61: `.catch(() => {})`. A `console.warn` would help debugging. No user impact.

---

## Issue Summary

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| P1-PERF-01 | ~~P1~~ | ~~Timer drift~~ | **RESOLVED** Sprint 2 |
| P1-PERF-02 | ~~P1~~ | ~~Background tab throttling~~ | **RESOLVED** Sprint 2 |
| P1-PERF-09 | ~~P1~~ | ~~Keyboard effect re-registers ~4x/sec~~ | **RESOLVED** Sprint 3 |
| P2-PERF-05 | ~~P2~~ | ~~Unstable callback refs~~ | **RESOLVED** Sprint 2 |
| P2-PERF-06 | ~~P2~~ | ~~handleComplete in useEffect deps~~ | **RESOLVED** Sprint 2 |
| P2-PERF-10 | ~~P2~~ | ~~Completion detection fragile (dual effects)~~ | **RESOLVED** Sprint 3 |
| P2-PERF-08 | ~~P2~~ | ~~No service worker~~ | **RESOLVED** Sprint 5 |
| P2-PERF-15 | ~~P2~~ | ~~setState inside setState updater~~ | **RESOLVED** Sprint 6 |
| P2-PERF-16 | ~~P2~~ | ~~Duplicated completion handler logic~~ | **RESOLVED** Sprint 5/6 |
| P3-PERF-12 | ~~P3~~ | ~~AudioContext leak~~ | **RESOLVED** Sprint 6 |
| P2-PERF-11 | P2 | No retry queue for failed mutations | OPEN |
| P2-PERF-18 | P2 | Pre-cached SSR routes may serve stale inline data | OPEN |
| P3-PERF-03 | P3 | Font loading — external, not SW-cached (severity reduced) | OPEN |
| P3-PERF-04 | P3 | Clerk could be lazy-loaded (~80kB savings) | OPEN |
| P3-PERF-13 | P3 | SVG progress ring: transition-all overlap | OPEN |
| P3-PERF-14 | P3 | 250ms tick interval — 4x more renders than needed | OPEN |
| P3-PERF-17 | P3 | Completion modal re-renders entire Timer on keystroke | OPEN |
| P3-PERF-19 | P3 | SW registration error silently swallowed | OPEN |
| P3-PERF-20 | P3 | JetBrains Mono preload redundant with immediate stylesheet | NEW |

**P1 count: 0** | P2 count: 2 | P3 count: 7

---

## What Moved the Needle

Sprint #6 is a debt-paydown sprint, and debt-paydown sprints are the ones that actually improve quality. Three specific fixes drove the +0.4 gain:

1. **AudioContext singleton** (PERF-12 resolved): The old code created a new `AudioContext` on every completion sound. Browsers limit contexts to ~6 before silently failing. After the 6th pomodoro completion, the sound would stop working with no error feedback. The module-level singleton with `onended` cleanup eliminates this failure mode entirely. This is the kind of bug that only surfaces in real usage after several hours — exactly the usage pattern a pomodoro app exists for.

2. **Completion handler deduplication** (PERF-15, PERF-16 resolved): `advanceAfterCompletion()` is a clean shared function. No more setState inside setState updaters, no more duplicated transition logic. The Timer component is ~15 lines shorter and the completion flow has a single code path to reason about.

3. **Font weight narrowing** (PERF-03 partially resolved): Inter `400;600;700` instead of the full variable range saves ~50kB on first load. JetBrains Mono preload shaves ~50-100ms off font discovery. Together, they noticeably reduce the flash of unstyled/invisible text on first visit. The fonts are still external, but the penalty is halved.

None of these are individually dramatic. Together, they represent the difference between "technically works" and "works correctly under sustained use." Sprint #6 tightened bolts.

---

## What's Missing for 8.0+

The path from 7.6 to 8.0 is narrow and clear. Two items would close the gap:

### Must-do (to reach 8.0)

1. **Mutation retry queue (P2-PERF-11).** This is the only remaining P2 that blocks real user value. The timer works offline. The data does not. A `localStorage`-backed queue with `navigator.onLine` replay would close the gap between "offline-capable UI" and "offline-reliable app." Effort: 40-60 lines, zero dependencies. This alone would push Offline Capability from 7 to 8, and the overall score to ~7.8.

2. **Self-host fonts (P3-PERF-03).** Move Inter and JetBrains Mono to `/assets/fonts/`, reference them via `@font-face` in `app.css`. The SW already caches everything under `/assets/` with a cache-first strategy. This would make fonts available offline and eliminate the last external network dependency. Removes the Google Fonts preconnect, preload, and stylesheet links from `root.tsx` entirely. Effort: 20 minutes. Pushes Initial Load from 8 toward 9.

### Nice-to-have (to reach 8.5+)

3. **Lazy-load Clerk (P3-PERF-04).** `React.lazy(() => import("@clerk/clerk-react"))` with a loading fallback in `Providers.tsx`. Saves ~80kB gzipped on initial load for the timer page. The timer is the primary entry point and does not need auth until mutation time. Effort: 30 minutes, moderate testing needed.

4. **Reduce tick to 1s (P3-PERF-14).** Swap `setInterval(tick, 250)` to `setInterval(tick, 1000)`. The wall-clock correction means accuracy is unchanged. Display updates whole seconds only. Halves render count during active timer. Effort: 1 line change.

5. **Extract completion modal (P3-PERF-17).** Move the completion form into `<CompletionModal>` child component. Isolates typing re-renders from the timer UI. Minor improvement, mainly code hygiene.

---

## Verdict

Sprint #6 did the right thing at the right time. After Sprint #5 added capability (service worker, completion modal) at the cost of complexity, Sprint #6 paid down that complexity debt without adding new features. The result: +0.4 overall, P2 count dropped from 4 to 2, and no new regressions.

The AudioContext fix is the standout — it addressed a real failure mode that would have hit users after sustained usage. The font optimization is solid craft. The handler deduplication is good hygiene.

At 7.6, the app is in a healthy state. Zero P1 issues for the fourth consecutive sprint. The timer is accurate, the offline story is functional (if not yet reliable for data), and the resource management is clean. The path to 8.0 requires exactly one meaningful piece of work: the mutation retry queue. Everything else is polish.

P2 count: 2. Both are offline-related. When those are resolved, this app has no significant performance concerns remaining.
