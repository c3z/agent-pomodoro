# Performance Review — Agent Pomodoro

**Reviewer:** Performance
**Date:** 2026-03-15
**Files reviewed:** `app/components/Timer.tsx`, `vite.config.ts`, `package.json`, `app/app.css`, `app/routes/timer.tsx`, `app/components/Providers.tsx`, `convex/sessions.ts`

---

## Scores

| # | Subcategory | Score | Notes |
|---|-------------|-------|-------|
| 1 | Timer Accuracy | 4/10 | `setInterval` drift, no wall-clock anchor |
| 2 | Initial Load | 7/10 | Lean deps, but no code-splitting or font optimization |
| 3 | Bundle Size | 8/10 | Minimal dependencies, nothing gratuitous |
| 4 | State Management | 5/10 | Unnecessary re-render cascade from `handleComplete` in useEffect deps |
| 5 | Offline Capability | 3/10 | Timer dies on network loss due to Convex/Clerk dependency at start |

**Overall: 5.4 / 10**

---

## 1. Timer Accuracy — 4/10

The timer uses `setInterval(fn, 1000)` with a simple `prev - 1` decrement (line 92-100 of `Timer.tsx`). This is the classic "drifting timer" anti-pattern.

**What goes wrong:**
- `setInterval` does not guarantee exactly 1000ms. Each tick can be delayed by JS event loop blocking, garbage collection, or tab throttling.
- Over a 25-minute pomodoro (1500 ticks), cumulative drift can reach 5-30 seconds depending on browser load.
- When the browser tab is backgrounded, Chrome/Safari throttle `setInterval` to once per second *at best*, and sometimes once per minute. A 25-minute pomodoro running in a background tab will be wildly inaccurate.
- There is no wall-clock reference. The timer never checks `Date.now()` to correct itself.

**P1 issues:**
- **P1-PERF-01: Timer drifts under load.** Replace `setInterval` + decrement with a wall-clock approach: store `targetEndTime = Date.now() + secondsLeft * 1000` on start, then on each tick compute `secondsLeft = Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000))`. This self-corrects every tick.
- **P1-PERF-02: Background tab throttling kills accuracy.** When the tab is backgrounded, browsers throttle timers aggressively. Use `document.visibilitychange` event to recalculate remaining time from the wall clock when the tab regains focus.

---

## 2. Initial Load — 7/10

The dependency list is lean: React 19, React Router 7, Convex, Clerk, Tailwind 4. No heavy charting libraries, no animation frameworks, no moment.js. This is good.

**Concerns:**
- JetBrains Mono and Inter are declared in the CSS theme but there is no visible `<link>` or `@font-face` with `font-display: swap`. If these load from Google Fonts or a CDN via the HTML template, they could block first paint.
- React Router 7 uses server-side rendering by default, which should give a fast first contentful paint. Good.
- No explicit code-splitting is visible. The timer, dashboard, and history routes appear to be in the same bundle. React Router 7 handles route-based splitting automatically via its file convention, so this is likely fine, but worth verifying with `npx vite-bundle-visualizer`.

**P3 issues:**
- **P3-PERF-03: Font loading strategy unverified.** Ensure `font-display: swap` or `optional` is set for custom fonts. If fonts are self-hosted, add `preload` hints. If not loaded at all yet (just declared in CSS), remove the declarations or add the actual font files.

---

## 3. Bundle Size — 8/10

Production dependencies:
- `react`, `react-dom` (~45kB gzipped) — unavoidable
- `react-router` + `@react-router/node` + `@react-router/serve` — framework, required
- `convex` (~30kB gzipped) — backend, required
- `@clerk/clerk-react` + `@clerk/react-router` (~80kB gzipped) — auth, required but heavy
- `isbot` (~2kB) — standard for SSR bot detection

No bloat. No lodash, no moment, no axios, no UI component library. This is about as lean as you can get with this stack.

**Clerk is the heaviest single dependency** (~80kB gzipped). This is a known tradeoff. If bundle size becomes critical, Clerk could be lazy-loaded only for authenticated routes, but this is not a real problem today.

**P3 issues:**
- **P3-PERF-04: Consider lazy-loading Clerk.** The `Providers.tsx` already gracefully handles missing `CLERK_KEY`, but for production, Clerk JS is always bundled. A dynamic `import()` for `@clerk/clerk-react` would shave ~80kB off the initial chunk for unauthenticated visitors.

---

## 4. State Management — 5/10

The `Timer` component has a subtle re-render problem caused by the `handleComplete` callback and its dependency chain.

**The issue (lines 58-105):**

```
const handleComplete = useCallback(() => { ... }, [mode, completedPomodoros, onSessionComplete]);

useEffect(() => {
  if (isRunning && secondsLeft > 0) {
    intervalRef.current = setInterval(() => { ... }, 1000);
  }
  return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
}, [isRunning, handleComplete]);
```

Every time `handleComplete` gets a new identity (because `completedPomodoros` changed, or `mode` changed), the `useEffect` tears down the interval and creates a new one. This happens at least once per completed pomodoro. But more importantly, if `onSessionComplete` is not stable (not wrapped in `useCallback` in the parent), this re-creates the interval on every parent render.

Looking at `timer.tsx` (the route), the callbacks are defined as inline arrow functions:
```
onSessionComplete={async () => { ... }}
```

This means every render of `TimerPage` creates new function references, which invalidates `handleComplete`, which re-creates the interval. During countdown, `setSecondsLeft` triggers a re-render of `TimerPage` (via the state update), but since the Timer component manages its own state and TimerPage doesn't depend on `secondsLeft`, React Router should not re-render TimerPage on every tick. So in practice, this is okay-ish, but the architecture is fragile.

**The bigger re-render problem:** Every second, `setSecondsLeft` triggers a full re-render of the Timer component. This re-renders the SVG progress ring, all buttons, the mode selector, and the pomodoro counter. For a simple timer, this is ~20 DOM elements re-evaluated per second. Not a performance crisis, but unnecessary.

**P2 issues:**
- **P2-PERF-05: Unstable callback references from parent.** Wrap `onSessionComplete`, `onSessionStart`, `onSessionInterrupt` in `useCallback` in `timer.tsx`, or use `useRef` to hold latest callback (a common pattern to break the dependency chain).
- **P2-PERF-06: Move `handleComplete` to a ref.** Store `handleComplete` in a ref so the interval effect doesn't depend on it. The interval callback reads from the ref, keeping the interval stable across renders:
  ```ts
  const handleCompleteRef = useRef(handleComplete);
  handleCompleteRef.current = handleComplete;
  // In useEffect: handleCompleteRef.current()
  ```

---

## 5. Offline Capability — 3/10

The timer is a pure client-side countdown. In theory, it should work offline. In practice:

- **Convex mutations fire on start/complete/interrupt.** If the network is down when a session starts, `startSession` will fail. The `timer.tsx` route does `await startSession(...)` — if this throws, the error is unhandled (no try/catch). The timer still starts locally because `Timer.tsx` doesn't wait for the callback, but the session is never recorded.
- **Convex mutations on completion will also fail offline.** The completed session is lost — no retry queue, no local storage fallback.
- **Clerk authentication may block the entire app.** If the Clerk JS SDK cannot reach its servers, the auth state may never resolve, potentially leaving the user on a loading screen.
- **No service worker.** No PWA manifest. The app cannot even load offline.

For a pomodoro timer, offline is not a nice-to-have — it is core. You use a pomodoro timer to focus, which often means airplane mode or flaky cafe wifi.

**P1 issues:**
- **P1-PERF-07: Timer should function fully offline.** The `Timer` component itself is pure local state — good. But the integration in `timer.tsx` should gracefully handle failed mutations (try/catch + queue for retry). Consider storing sessions in `localStorage` and syncing to Convex when connectivity returns.

**P2 issues:**
- **P2-PERF-08: Add a service worker / PWA manifest.** A pomodoro app is a perfect PWA candidate. `vite-plugin-pwa` would add this with minimal config. Cache the app shell so it loads offline.

---

## Issue Summary

| ID | Severity | Description |
|----|----------|-------------|
| P1-PERF-01 | P1 | Timer drift — replace setInterval decrement with wall-clock anchor |
| P1-PERF-02 | P1 | Background tab throttling — use visibilitychange to recalculate |
| P1-PERF-07 | P1 | Offline mutations fail silently — add error handling + local queue |
| P2-PERF-05 | P2 | Unstable callback references cause interval teardown |
| P2-PERF-06 | P2 | handleComplete in useEffect deps — use ref pattern |
| P2-PERF-08 | P2 | No service worker / PWA — app cannot load offline |
| P3-PERF-03 | P3 | Font loading strategy unverified |
| P3-PERF-04 | P3 | Clerk could be lazy-loaded to reduce initial bundle |

**P1 count: 3** | P2 count: 3 | P3 count: 2

---

## Verdict

The timer works for the happy path: foreground tab, stable network, short sessions. But a pomodoro timer that drifts in background tabs and cannot survive a network blip is fundamentally unreliable for its core use case. The P1s around timer accuracy and offline resilience need to be addressed before this can be trusted for real focus sessions.

Bundle size and initial load are solid — the stack choices are lean and appropriate. State management has some fragility but nothing that causes visible bugs today.

**Fix the wall-clock anchor first. Everything else follows.**
