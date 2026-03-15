# Performance Review — Agent Pomodoro (Sprint #5)

**Reviewer:** Performance
**Date:** 2026-03-15
**Previous scores:** Sprint #1: 5.4, Sprint #2: 6.6, Sprint #3: 7.2, Sprint #4: not scored
**Files reviewed:** `app/components/Timer.tsx`, `app/routes/timer.tsx`, `app/root.tsx`, `vite.config.ts`, `package.json`, `public/sw.js`, `public/manifest.json`, `app/components/Providers.tsx`, `app/routes/home.tsx`

---

## Sprint 5 Changes Evaluated

1. **Service worker added** (`public/sw.js`) — network-first for navigation requests, cache-first for hashed `/assets/` paths. Pre-caches `/`, `/timer`, `/history` on install. Cleans old caches on activate. Skips Convex and cross-origin requests.
2. **SW registration in `root.tsx`** — registered via `useEffect` in the `App` component, with `.catch(() => {})` error swallow.
3. **Notes/tags completion modal in Timer** — new state variables (`showCompletion`, `completionNotes`, `completionTags`), modal UI with textarea + tag toggle buttons, `handleCompletionSubmit` / `handleCompletionSkip` handlers.
4. **Convex prod deployment fixed** (infrastructure, no perf impact on client code).

---

## Scores

| # | Subcategory | Score | Prev (S3) | Delta | Notes |
|---|-------------|-------|-----------|-------|-------|
| 1 | Timer Accuracy | 8/10 | 8 | 0 | No regression. Wall-clock anchor unchanged. |
| 2 | Initial Load | 7/10 | 7 | 0 | SW pre-cache helps repeat visits. Font strategy unchanged. |
| 3 | Bundle Size | 8/10 | 8 | 0 | Zero new dependencies. Completion modal is pure React — negligible. |
| 4 | State Management | 6/10 | 7 | -1 | Three new state vars + modal logic added coupling. Batching concern in completion handlers. |
| 5 | Offline Capability | 7/10 | 5 | +2 | Service worker is the single biggest perf improvement since Sprint 1. |

**Overall: 7.2 / 10** (prev 7.2, delta +0.0)

The zero net delta is deceptive — offline jumped +2 but state management regressed -1. Sprint 5 traded complexity for capability. The right trade, but the state debt needs paying.

---

## 1. Timer Accuracy — 8/10

No changes to the core tick mechanism in Sprint 5. The wall-clock anchor pattern remains:
- `endTimeRef.current = Date.now() + secondsLeft * 1000` set on start/resume
- 250ms `setInterval` reads `Date.now()` each tick, computes remaining via `Math.ceil((endTime - now) / 1000)`
- `visibilitychange` handler recalculates on tab refocus

This approach is immune to `setInterval` drift, background tab throttling, and sleep/wake cycles. Accuracy is bounded by `Date.now()` precision (~1ms), which is more than sufficient for a 1-second display resolution.

**Remaining concern (unchanged):**
- P3-PERF-14: 250ms tick = 4 `setSecondsLeft` calls/sec. Since display shows whole seconds, a 1-second interval with the same wall-clock correction would produce identical visual output with 75% fewer state updates. Not impactful in practice — React batches these efficiently and the component tree is shallow.

---

## 2. Initial Load — 7/10

The service worker improves *repeat* visit load times significantly — cache-first for `/assets/*` means hashed JS/CSS bundles are served from the SW cache without hitting the network. First visit is unchanged since the SW only activates after initial load.

**Positive:** Pre-caching of `/`, `/timer`, `/history` on install means the app shell is available from cache immediately after first visit. Navigation between routes is instant from cache.

**Remaining concerns (unchanged):**

### P3-PERF-03: External Google Fonts (unchanged)
Two Google Fonts loaded via `<link rel="stylesheet">` in `root.tsx` lines 14-27. These are render-blocking external requests. The fonts themselves (`Inter`, `JetBrains Mono`) are served from `fonts.gstatic.com` with long cache headers, but the CSS descriptor file from `fonts.googleapis.com` is fetched fresh. On slow networks, this adds 100-500ms of FOIT/FOUT.

The service worker does NOT cache these because they're cross-origin (`url.origin !== self.location.origin` check on line 29 of `sw.js`). This is correct behavior for the current SW implementation but means fonts remain a network dependency even when the rest of the app is cached.

### P3-PERF-04: Clerk eager-loading (unchanged)
`@clerk/clerk-react` (~80kB gzipped) is loaded eagerly via `Providers.tsx`. Could be dynamically imported for unauthenticated first paint.

---

## 3. Bundle Size — 8/10

Zero new `dependencies` or `devDependencies` added in Sprint 5. `package.json` is identical to Sprint 3.

The completion modal (notes textarea + tag buttons) is pure JSX with no external libraries — no rich text editor, no tag input library, no form library. The `QUICK_TAGS` array is a static constant. The modal adds maybe 2kB unminified to `Timer.tsx`, which compresses to effectively nothing.

Production dependency profile unchanged:
- `react` + `react-dom`: ~45kB gz
- `@clerk/*`: ~80kB gz
- `convex`: ~35kB gz
- `react-router`: ~25kB gz
- App code: ~6kB total (marginal increase from modal)
- **Total estimated: ~191kB gzipped**

The `sw.js` file itself is ~60 lines, served as a static file — no bundling overhead.

**No new issues.**

---

## 4. State Management — 6/10 (regression from 7)

Sprint 5 adds three new `useState` hooks to `Timer`:
- `showCompletion` (boolean)
- `completionNotes` (string)
- `completionTags` (string[])

These are only relevant when the timer completes, but they exist in the component throughout its entire lifecycle. More critically, the completion handlers introduce patterns that are suboptimal.

### P2-PERF-15 (NEW): setState inside setState updater

`handleCompletionSubmit` and `handleCompletionSkip` (lines 181-219) both call `setMode()` and `setSecondsLeft()` inside the `setCompletedPomodoros()` updater function:

```tsx
setCompletedPomodoros((prev) => {
  const newCount = prev + 1;
  const nextMode = newCount % DEFAULT_CONFIG.longBreakInterval === 0
    ? "longBreak" : "break";
  setMode(nextMode);          // setState inside setState updater
  setSecondsLeft(DEFAULT_CONFIG[nextMode] * 60);  // another one
  return newCount;
});
```

Calling `setMode` and `setSecondsLeft` inside a `setCompletedPomodoros` updater is an anti-pattern. React 19 batches all state updates within event handlers, so there is no practical benefit to nesting them. The nesting makes it harder to reason about render order and could produce unexpected behavior if React changes its batching semantics in future versions.

The correct approach: compute `newCount` from `completedPomodoros + 1`, then call all three `setState` calls at the top level of the handler.

### P2-PERF-16 (NEW): Duplicated completion handler logic

`handleCompletionSubmit` and `handleCompletionSkip` are nearly identical — same `setShowCompletion(false)`, `setCompletionNotes("")`, `setCompletionTags([])`, and the exact same `setCompletedPomodoros` updater. The only difference is whether `notes` and `tags` are passed to `onCompleteRef.current`. This is 40 lines of duplicated logic (lines 181-219) that should be a single function with an optional parameter.

### P3-PERF-17 (NEW): Completion modal re-renders during typing

When the user types notes in the completion textarea, `setCompletionNotes(e.target.value)` triggers a re-render of the entire `Timer` component on every keystroke. This re-renders the SVG progress ring, the pomodoro counter dots, and all buttons — even though the timer is stopped and none of that UI is changing.

In practice this is not perceptible (the component tree is small), but it would be cleaner to extract the completion modal into its own component to isolate the typing re-renders.

### Existing state issues (unchanged)

- P3-PERF-12: AudioContext leak — new context per completion, never closed
- P3-PERF-13: SVG transition-all overlap with 250ms ticks

---

## 5. Offline Capability — 7/10 (major improvement from 5)

This is the headline improvement of Sprint 5. The service worker directly addresses P2-PERF-08, which was the top priority recommendation from Sprint 3.

### What's implemented well

**Install phase** (lines 4-9): Pre-caches three navigation routes (`/`, `/timer`, `/history`). Uses `skipWaiting()` for immediate activation — correct for an app with a single active client.

**Activate phase** (lines 11-22): Deletes old caches by filtering on `CACHE_NAME !== key`. Uses `clients.claim()` to take control of existing tabs without requiring a reload.

**Fetch strategy** (lines 24-58):
- Cross-origin and non-GET requests are correctly skipped
- Convex WebSocket/API calls are correctly excluded
- Navigation requests: network-first with cache fallback. On failure, falls back to cached response or root (`/`) as ultimate fallback. This is the correct strategy for an SPA — ensures users get fresh content when online, cached content when offline.
- Hashed assets (`/assets/*`): cache-first. Correct — these are content-hashed by Vite and immutable.

**Timer works offline:** The timer is entirely client-side after initial load. Once the SW caches the app shell, navigating to `/timer` and running a full 25-minute pomodoro works without any network access. This is the core use case and it works.

### P2-PERF-18 (NEW): Pre-cached routes may return HTML, not app shell

`STATIC_ASSETS` on line 2 lists `/`, `/timer`, `/history`. During the `install` event, `cache.addAll()` fetches these URLs and caches the server-rendered HTML responses. However, React Router 7 SSR means these cached responses contain the full HTML document with inline data. If the Convex/Clerk data changes between install and offline use, the cached HTML will show stale data until React hydrates and the client takes over.

This is acceptable for the timer page (which has no server data in the initial render) but could show stale stats on the dashboard. Low severity since hydration corrects it within seconds when online, and offline users expect some staleness.

### P2-PERF-11 (unchanged): No mutation retry queue

Failed Convex mutations (start/complete/interrupt) in `timer.tsx` are caught and logged with `console.warn` but never retried. A session started online that completes while offline will have its `complete` mutation silently dropped. The pomodoro time is lost.

This is the most impactful remaining offline gap. The timer *runs* offline perfectly, but the *data* doesn't survive connectivity drops. A simple pattern would fix this:
1. On mutation failure, save to `localStorage` with a queue key
2. On `navigator.onLine` event or next successful mutation, replay the queue
3. Convex mutations are idempotent by session ID, so replays are safe

### P3-PERF-19 (NEW): SW registration error silently swallowed

`root.tsx` line 56: `navigator.serviceWorker.register("/sw.js").catch(() => {})`. If registration fails (e.g., invalid SW syntax, HTTPS issue), there is no feedback. A `console.warn` in the catch would help debugging without affecting users.

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
| P2-PERF-08 | ~~P2~~ | ~~No service worker — app cannot load offline~~ | **RESOLVED** Sprint 5 |
| P2-PERF-11 | P2 | No retry queue for failed mutations | OPEN |
| P2-PERF-15 | P2 | setState inside setState updater (completion handlers) | NEW |
| P2-PERF-16 | P2 | Duplicated completion handler logic | NEW |
| P2-PERF-18 | P2 | Pre-cached SSR routes may serve stale inline data | NEW |
| P3-PERF-12 | P3 | AudioContext leak — new context per completion, never closed | OPEN |
| P3-PERF-13 | P3 | SVG progress ring: overlapping CSS transitions | OPEN |
| P3-PERF-14 | P3 | 250ms tick interval — 4x more renders than needed | OPEN |
| P3-PERF-03 | P3 | Font loading strategy — external Google Fonts, no preload | OPEN |
| P3-PERF-04 | P3 | Clerk could be lazy-loaded (~80kB savings) | OPEN |
| P3-PERF-17 | P3 | Completion modal re-renders entire Timer on keystroke | NEW |
| P3-PERF-19 | P3 | SW registration error silently swallowed | NEW |

**P1 count: 0** | P2 count: 4 | P3 count: 7

---

## What Moved the Needle

The service worker is the single most impactful Sprint 5 change from a performance perspective. It resolves the longest-standing P2 issue (PERF-08, open since Sprint 1) and fundamentally changes what the app can do:

- **Repeat visit TTI drops to near-zero** for cached assets. Hashed JS/CSS bundles served from SW cache bypass the network entirely.
- **True offline timer operation.** The core use case — start a pomodoro and focus for 25 minutes — now works without network after first visit.
- **PWA installability + offline = real app feel.** The manifest (Sprint 3) plus the SW (Sprint 5) together make this a fully installable, offline-capable PWA.

The implementation is clean and conservative: no heavy dependencies (no Workbox, no vite-plugin-pwa), just 60 lines of hand-written SW with correct strategies for each request type. The code is readable and does exactly what it should.

---

## What's Missing for 8.0+

To break past 7.2, the following would need to happen:

### Must-do (to reach 8.0)

1. **Fix mutation retry queue (P2-PERF-11).** The timer works offline but data is lost. This is the gap between "offline-capable" and "offline-reliable." A localStorage queue with online/offline event listeners would close it. Estimated effort: 30-50 lines.

2. **Clean up completion handler state (P2-PERF-15, P2-PERF-16).** Extract completion modal to its own component. Deduplicate submit/skip logic. Move setState calls out of updater functions. This reduces Timer.tsx complexity and isolates re-renders. Estimated effort: 30 minutes.

3. **Self-host fonts or add font-display/preload (P3-PERF-03).** Either bundle Inter and JetBrains Mono as local assets (the SW would then cache them), or add `<link rel="preload">` hints for the Google Fonts CSS. The current setup means fonts are the one remaining network dependency that the SW cannot help with.

### Nice-to-have (to reach 8.5+)

4. **Lazy-load Clerk (P3-PERF-04).** Dynamic `import()` for `@clerk/clerk-react` would drop initial JS by ~80kB for the unauthenticated shell.

5. **Reduce tick interval to 1s (P3-PERF-14).** Halves render count during active timer. Pure cleanup.

6. **Reuse AudioContext (P3-PERF-12).** Module-level singleton, `close()` on page unload. Prevents silent failure after 6+ completions.

---

## Verdict

Sprint 5 delivered the right thing: the service worker was the #1 recommendation from Sprint 3 and it's implemented correctly. The offline capability score jumped from 5 to 7, which is the biggest single-subcategory improvement in the project's history.

The completion modal introduction is fine functionally but introduced minor state management debt — nested setState, duplicated handlers, and whole-component re-renders during typing. None of these are P1 or user-facing, but they pulled the state management score down by one point, exactly offsetting the offline gains in the overall average.

The overall 7.2 holds steady. This is not a plateau — it reflects a real capability gain (offline) balanced against real complexity growth (modal state). The path to 8.0 is clear: mutation retry queue + completion handler cleanup + font optimization. All three are low-effort, high-impact items that could be done in a single sprint.

Zero P1 issues for the third consecutive sprint. The timer is production-grade.
