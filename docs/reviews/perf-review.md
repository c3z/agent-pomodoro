# Performance Review — Agent Pomodoro (Sprint #3)

**Reviewer:** Performance
**Date:** 2026-03-15
**Previous score:** 6.6/10
**Files reviewed:** `app/components/Timer.tsx`, `app/routes/timer.tsx`, `vite.config.ts`, `package.json`, `public/manifest.json`

---

## Sprint 3 Changes Evaluated

- Keyboard effect now uses refs (`isRunningRef`, `startRef`, `pauseRef`, `stopRef`) + empty dependency array `[]` — registers listener once, reads current state via refs. Resolves P1-PERF-09.
- Completion detection simplified: removed dead `useEffect`, uses `modeRef` for stable mode access, `completedRef` flag armed in `start()` and consumed in completion effect. Resolves P2-PERF-10.
- PWA manifest added (`public/manifest.json`) with icon declarations, linked from `root.tsx`. Partially addresses P2-PERF-08.

---

## Scores

| # | Subcategory | Score | Prev | Delta | Notes |
|---|-------------|-------|------|-------|-------|
| 1 | Timer Accuracy | 8/10 | 8 | 0 | No regression. Wall-clock anchor remains solid. |
| 2 | Initial Load | 7/10 | 7 | 0 | Manifest link added — negligible load impact. Font loading still not optimized. |
| 3 | Bundle Size | 8/10 | 8 | 0 | No new dependencies. Clean. |
| 4 | State Management | 7/10 | 6 | +1 | Keyboard ref pattern fixes the churn. Completion flow is cleaner. |
| 5 | Offline Capability | 5/10 | 4 | +1 | Manifest enables installability. Still no service worker or retry queue. |

**Overall: 7.0 / 10** (prev 6.6, delta +0.4)

---

## 1. Timer Accuracy — 8/10

No changes to the timer tick mechanism in Sprint 3. The wall-clock anchor (`endTimeRef` + `Date.now()`) and 250ms interval continue to work correctly. `visibilitychange` handler correctly recalculates on tab focus.

**Remaining concern (unchanged):**
- 250ms tick = 4 `setSecondsLeft` calls per second. Display only shows whole seconds, so a 1-second interval with wall-clock correction would be equally accurate visually and halve the render load. Not a P1 — works fine in practice.

---

## 2. Initial Load — 7/10

Sprint 3 added `<link rel="manifest">` in `root.tsx` (line 28). The browser fetches `manifest.json` asynchronously, so this has negligible impact on initial load. Icons (`icon-192.png`, `icon-512.png`) exist on disk and are only fetched by the browser when installing the PWA or painting the splash screen.

**Remaining concerns (unchanged):**
- Two Google Fonts loaded via external stylesheet (`fonts.googleapis.com`). No `font-display: swap` is specified in the CSS `@font-face` — it relies on Google's default (`swap` since 2019, but still an external network dependency). On slow connections, this adds a render-blocking external request.
- No `<link rel="preload">` for critical resources.
- React Router 7 provides route-based code splitting automatically — each route module is lazy-loaded. This is good and requires no additional config.

---

## 3. Bundle Size — 8/10

No new dependencies in Sprint 3. `package.json` is unchanged from Sprint 2.

Production dependency weight estimate:
- `react` + `react-dom`: ~45kB gzipped
- `@clerk/clerk-react` + `@clerk/react-router`: ~80kB gzipped (heaviest single dep)
- `convex` + `convex/react-clerk`: ~35kB gzipped
- `react-router`: ~25kB gzipped
- App code: ~5kB total (Timer, Stats, SessionList, Providers, routes)

Total estimated JS: ~190kB gzipped. Reasonable for an authenticated SPA.

**Remaining concern:**
- Clerk could be lazy-loaded (only needed after auth-gated routes). The `Providers.tsx` already has a `!CLERK_KEY` early return — extending this to dynamic `import()` would shave ~80kB off initial load for unauthenticated first paint. P3 priority.

---

## 4. State Management — 7/10

### P1-PERF-09 resolved: Keyboard effect

The keyboard `useEffect` (lines 209-230) now correctly:
1. Declares `isRunningRef` (line 203) and keeps it current (`isRunningRef.current = isRunning` on line 204)
2. Declares `startRef`, `pauseRef`, `stopRef` (lines 205-207) and assigns them after function declarations (lines 276-278)
3. Uses `[]` dependency array (line 230) — listener registers once, never re-registers

The handler reads all mutable state through refs, so it always has the current `isRunning`, `start`, `pause`, and `stop` values without needing to re-bind. This eliminates the ~12,000 unnecessary `addEventListener`/`removeEventListener` calls per 25-minute session.

One subtlety: `startRef`, `pauseRef`, `stopRef` are assigned at the bottom of the component body (lines 276-278), outside any effect. This means they update synchronously during render, which is correct — by the time a keydown event fires, the refs already point to the latest function instances.

### P2-PERF-10 resolved: Completion detection

The completion flow is now cleaner:
1. Tick effect (line 133) detects `remaining <= 0`, clears interval, sets `isRunning = false`, plays sound
2. `completedRef` is armed in `start()` (line 244) and consumed in the completion effect (line 163)
3. `modeRef` (line 157-158) provides stable access to the current mode without adding `mode` to the completion effect's dependency array
4. The completion effect (lines 160-184) depends only on `[secondsLeft, isRunning]` — clean and minimal

The previous dead `useEffect` is gone. The two-phase model (tick detects zero -> completion effect handles transition) remains, but `modeRef` eliminates the stale-closure risk that was the main fragility concern.

**Remaining concerns:**

### AudioContext leak (P3-PERF-12, unchanged)

`playCompletionSound()` (lines 31-57) still creates a new `AudioContext` per call and never closes it. Chrome limits concurrent `AudioContext` to 6. After 6 completed pomodoros, the 7th completion sound may silently fail.

Fix: reuse a single `AudioContext` stored in a module-level variable, or call `ctx.close()` after the oscillators finish.

### SVG transition overlap (P3-PERF-13, unchanged)

The progress ring has `transition-all duration-300` but ticks every 250ms — transitions overlap. Visually harmless; minor GPU compositing waste.

---

## 5. Offline Capability — 5/10

### Manifest added (P2-PERF-08 partially addressed)

`public/manifest.json` is properly structured:
- `display: standalone` — enables Add-to-Home-Screen
- Icons at 192x192 and 512x512 — meets Chrome's installability criteria
- `start_url: /` — correct
- `theme_color` and `background_color` set — splash screen will render

The manifest is linked from `root.tsx` via the `links` export (line 28). Both icon files exist on disk.

**However, the manifest alone does not enable offline capability.** A manifest makes the app *installable* but not *offline-capable*. Without a service worker:
- The installed PWA still requires network to load
- No assets are cached
- No offline fallback page exists

### What's still missing

1. **No service worker.** No `sw.js`, no Workbox config, no `vite-plugin-pwa`. The timer page — which is entirely client-side and needs zero network after initial load — could work perfectly offline with a simple cache-first service worker.

2. **No mutation retry queue.** Failed Convex mutations (start/complete/interrupt) are caught and logged (try/catch in `timer.tsx`) but never retried. A session started on a train that loses connectivity mid-pomodoro will have its completion silently dropped. LocalStorage or IndexedDB queue with retry-on-reconnect would fix this.

3. **Clerk offline fragility.** If the Clerk SDK loads but cannot reach its servers, the auth provider may block rendering. `Providers.tsx` handles missing `CLERK_KEY` but not a loaded-but-unreachable Clerk.

### Recommendation for next sprint

Add `vite-plugin-pwa` (or manual service worker registration) with a cache-first strategy for app shell assets. This would:
- Enable true offline loading for the installed PWA
- Require minimal config (~20 lines in `vite.config.ts`)
- Bump this subcategory to 7/10 immediately

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
| P2-PERF-08 | P2 | No service worker — app cannot load offline | **PARTIAL** — manifest added, no SW |
| P2-PERF-11 | P2 | No retry queue for failed mutations | OPEN |
| P3-PERF-12 | P3 | AudioContext leak — new context per completion, never closed | OPEN |
| P3-PERF-13 | P3 | SVG progress ring: overlapping CSS transitions | OPEN |
| P3-PERF-03 | P3 | Font loading strategy — external Google Fonts, no preload | OPEN |
| P3-PERF-04 | P3 | Clerk could be lazy-loaded (~80kB savings) | OPEN |

**P1 count: 0** | P2 count: 2 | P3 count: 4

---

## Verdict

Sprint 3 closed all P1 and P2 issues that were within reach. The keyboard effect fix (refs + `[]` dependency array) is correct and well-implemented — pattern is clean, no stale-closure risks. The completion detection simplification with `modeRef` removes the main fragility concern from Sprint 2.

The manifest addition is a meaningful step toward PWA support, but without a service worker it's installability without offline capability — a half measure. The gap between "manifest added" and "works offline" is small in implementation effort (add `vite-plugin-pwa`, configure cache-first for app shell) but large in user value.

Score moves from 6.6 to 7.0. The +0.4 delta is modest because Sprint 3 changes were primarily cleanup (fixing the P1 keyboard churn, simplifying completion detection) rather than adding new capability. The gains are real — zero P1 issues for the first time — but the ceiling is limited by offline gaps.

**Next priorities for performance:**
1. **P2-PERF-08** — Add service worker via `vite-plugin-pwa`. Highest ROI remaining item.
2. **P2-PERF-11** — Mutation retry queue (localStorage buffer, retry on `navigator.onLine` change).
3. **P3-PERF-12** — Reuse AudioContext or close after use.
