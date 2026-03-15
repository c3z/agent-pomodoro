# Performance Review — Agent Pomodoro (Sprint #14)

**Reviewer:** Performance
**Date:** 2026-03-15
**Previous scores:** Sprint #1: 5.4, Sprint #2: 6.6, Sprint #3: 7.2, Sprint #5: 7.2, Sprint #6: 7.6, Sprint #7: 7.8, Sprint #8: 8.2
**Files reviewed:** `app/components/Timer.tsx`, `app/routes/timer.tsx`, `public/sw.js`, `public/manifest.json`, `vite.config.ts`, `package.json`, `app/lib/retryQueue.ts`, `app/routes/layout.tsx`

---

## Sprint #14 Changes Evaluated

1. **Web Audio API sounds** (`app/components/Timer.tsx`) — New `makeNote()` helper creates oscillator+gain nodes per note. Work completion plays 5 oscillators across two "strikes". Break-end plays 4 ascending oscillators. Module-level `audioCtx` singleton with lazy init and `onended` cleanup.

2. **Wake Lock API** (`app/components/Timer.tsx`) — `navigator.wakeLock.request('screen')` acquired on timer start/resume, released on pause/stop/completion. Re-acquired on `visibilitychange` when tab returns to foreground. `WakeLockSentinel` stored in a ref.

3. **PWA manifest updates** (`public/manifest.json`) — Added `id`, `scope`, `categories`, `orientation`, and a maskable icon entry reusing `icon-512.png`.

---

## Scores

| # | Subcategory | Score | Prev (S8) | Delta | Notes |
|---|-------------|-------|-----------|-------|-------|
| 1 | Timer Accuracy | 8/10 | 8 | 0 | Wall-clock anchor unchanged. Wake lock improves reliability on mobile. |
| 2 | Initial Load | 8/10 | 8 | 0 | Zero new deps, zero new network requests. Audio is pure Web Audio API. |
| 3 | Bundle Size | 9/10 | 8 | +1 | Sounds implemented with zero dependencies. No audio files to download. |
| 4 | State Management | 8/10 | 8 | 0 | Wake lock ref managed correctly. No new state variables leak into render. |
| 5 | Offline Capability | 9/10 | 9 | 0 | Web Audio works offline. Wake lock is a browser API — no network needed. |

**Overall: 8.4 / 10** (prev 8.2, delta +0.2)

---

## 1. Timer Accuracy — 8/10 (unchanged)

No changes to the timer mechanism. The wall-clock anchor pattern (`endTimeRef.current = Date.now() + secondsLeft * 1000`, 250ms polling with `Math.ceil`) remains correct.

The Wake Lock addition is a net positive for timer accuracy on mobile. Without wake lock, Android and iOS can suspend the screen after a timeout, which on some devices throttles or pauses JavaScript timers. With the screen kept awake, the 250ms `setInterval` tick runs reliably throughout the session.

The `visibilitychange` handler (line 276) correctly re-acquires the wake lock when the tab becomes visible again, covering the case where the OS releases the lock automatically when the tab is backgrounded.

### P3-PERF-14: 250ms tick interval (unchanged, OPEN)
Still 4 state updates per second where 1 would suffice. Wall-clock correction means accuracy is identical at 1000ms. Not a regression, just unrealized optimization.

---

## 2. Initial Load — 8/10 (unchanged)

Sprint #14 adds zero network requests to initial load. The audio implementation uses the Web Audio API exclusively — no audio file downloads, no `<audio>` elements, no external sound libraries. The `AudioContext` is created lazily on first user interaction (timer completion), not at page load.

The PWA manifest additions (`id`, `scope`, `categories`, `orientation`, maskable icon) are metadata-only. They don't affect load time — the manifest is fetched once during install and cached.

### P3-PERF-03: Font loading — external, not SW-cached (unchanged, OPEN)
Still loading from `fonts.googleapis.com`.

### P3-PERF-20: JetBrains Mono preload redundant (unchanged, OPEN)
No change.

---

## 3. Bundle Size — 9/10 (improved from 8)

This is the sprint's most impressive performance decision. Sounds were implemented using zero external dependencies — no Howler.js, no Tone.js, no audio sprite sheets, no `.mp3`/`.ogg` files. The entire audio system is ~50 lines of code using the Web Audio API's `OscillatorNode` and `GainNode`.

For comparison:
- Howler.js: ~30kB minified
- Tone.js: ~150kB minified
- Even a simple `.mp3` sound pack: 10-50kB per sound file

Instead, the implementation weighs approximately **0 bytes** of additional bundle size beyond the application code itself (~50 lines, <1kB gzipped). This is the optimal approach for a simple chime/bell use case.

Production dependency profile (unchanged):
- `react` + `react-dom`: ~45kB gz
- `@clerk/*`: ~80kB gz
- `convex`: ~35kB gz
- `react-router`: ~25kB gz
- App code: ~9kB total (up from ~8kB — the audio code)
- **Total estimated: ~194kB gzipped** (negligible increase)

### P3-PERF-04: Clerk could be lazy-loaded (unchanged, OPEN)
Still the largest optimization opportunity (~80kB gz savings).

---

## 4. State Management — 8/10 (unchanged)

The audio and wake lock systems were correctly implemented without adding any new `useState` calls that would trigger re-renders.

**Audio:** Module-level singleton `audioCtx` (line 31) lives outside the React component tree. No state, no context, no re-renders. `makeNote()` is a pure imperative function. The `onended` callback on each oscillator (line 58) disconnects both the oscillator and gain node — this is correct cleanup that prevents the `AudioContext`'s internal graph from growing unbounded.

**Wake Lock:** `wakeLockRef` (line 139) uses `useRef`, not `useState`. Acquiring and releasing the lock triggers zero re-renders. The `requestWakeLock` and `releaseWakeLock` functions are plain async/sync helpers, not event-driven state transitions.

No new render-cycle overhead from Sprint #14 changes.

### P3-PERF-13: SVG progress ring transition overlap (unchanged, OPEN)
`transition-all duration-300` still applied where `transition-[stroke-dashoffset]` would be more precise.

### P3-PERF-17: Completion modal re-renders entire Timer (unchanged, OPEN)
Still present, still imperceptible.

---

## 5. Offline Capability — 9/10 (unchanged)

All Sprint #14 features work fully offline:

- **Web Audio API:** Generates sound programmatically in the browser. No network requests, no audio file fetches. Works identically offline.
- **Wake Lock API:** A pure browser/OS API. No network dependency.
- **Vibration API:** Same — direct hardware access, no network.
- **PWA manifest:** Already cached at install time. The new fields (`id`, `scope`, `categories`) are read from the cached manifest.

The service worker caching strategy remains unchanged and continues to function correctly.

### P2-PERF-18: Pre-cached SSR routes serve stale inline data (unchanged, OPEN)
Still caching full SSR HTML at install time.

---

## New Issues

### P2-PERF-25 (NEW): AudioContext `resume()` is fire-and-forget

**Location:** Lines 65, 81 in `Timer.tsx`

```typescript
if (ctx.state === "suspended") ctx.resume();
```

`AudioContext.resume()` returns a Promise. The code calls it without `await` and immediately schedules oscillator notes at `ctx.currentTime`. On mobile browsers (especially iOS Safari and Chrome on Android), the context may still be in `suspended` state when `makeNote()` executes. The notes are scheduled at the pre-resume `currentTime`, and depending on how the browser handles the queue, they may play late, play all at once in a burst, or not play at all.

The fix is straightforward: `await ctx.resume()` before scheduling notes, which means `playWorkCompleteSound` and `playBreakEndSound` should be `async` and `playCompletionSound` should `await` them.

**Severity: P2** — On desktop, this rarely manifests because `AudioContext` is typically in `running` state after the first user gesture. On mobile, where the completion sound is most important (phone under a desk, screen locked), the `suspended` state is common and the sound may fail silently.

### P2-PERF-26 (NEW): Wake lock not released on component unmount

**Location:** `Timer.tsx` — no cleanup effect for wake lock

If the user navigates away from the `/timer` route while the timer is running (e.g., clicks "Dashboard" or "History"), the Timer component unmounts. `isRunning` becomes irrelevant because the component is destroyed, but `wakeLockRef.current` still holds an active `WakeLockSentinel`. The lock is only released on `pause()`, `stop()`, or timer completion — none of which fire on unmount.

The browser will eventually release the lock when the page is navigated away or closed, but within a single-page app (React Router), route changes don't trigger page unload. The screen stays awake indefinitely until the user returns to `/timer` and stops the timer, or closes the tab.

Fix: Add a cleanup return in a `useEffect` that calls `releaseWakeLock()` on unmount:

```typescript
useEffect(() => {
  return () => releaseWakeLock();
}, []);
```

**Severity: P2** — Screen staying awake when the user has navigated away from the timer is a battery drain and unexpected behavior. On mobile this is the exact platform where wake lock matters most.

### P3-PERF-27 (NEW): Maskable icon reuses standard icon

**Location:** `public/manifest.json`, line 27-28

```json
{ "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
```

The maskable icon uses the same `icon-512.png` as the standard icon. Maskable icons require a "safe zone" — the inner 80% of the icon — because the OS applies various shaped masks (circle, squircle, rounded rectangle) that crop the outer 10% on each side. If the standard icon has content extending to the edges, it will be clipped when displayed on Android home screens.

This doesn't affect performance, but it affects the PWA install experience. Worth verifying with [maskable.app](https://maskable.app) that the icon looks correct when masked.

**Severity: P3** — No performance impact, purely visual. But it's a PWA polish item and this sprint is explicitly about PWA polish.

### P3-PERF-28 (NEW): 5 simultaneous oscillators — mobile audio budget

**Location:** `playWorkCompleteSound()`, lines 68-73

The work completion sound creates 5 `OscillatorNode` instances: 3 in the first strike (t+0, t+0.05, t+0.1) and 2 in the second strike (t+1.2, t+1.25). The first 3 overlap for approximately 2 seconds.

On modern desktop browsers and most mobile devices (iPhone 8+, 2018+ Android), this is well within the audio processing budget. The Web Audio API is designed for this workload. However, on very low-end Android devices (budget phones with <2GB RAM, older WebView versions), 3 simultaneous sine wave oscillators with gain ramps can occasionally cause audio glitches — clicks, pops, or dropped notes.

Mitigation is simple but likely unnecessary: reduce the first strike from 3 to 2 oscillators (drop the G5 overtone at 0.08 volume — it's barely audible anyway), or stagger the start times by 100ms instead of 50ms to reduce peak overlap.

**Severity: P3** — Affects only the lowest-end devices. 5 oscillators (3 simultaneous peak) is conservative by Web Audio standards. Tone.js demos routinely run 20+ simultaneous oscillators. The gain values (0.25, 0.15, 0.08) are low enough to avoid clipping. No action needed unless user reports glitches on a specific device.

### P3-PERF-29 (NEW): Empty catch blocks in audio functions

**Location:** Lines 74, 88 in `Timer.tsx`

```typescript
} catch {}
```

`playWorkCompleteSound()` and `playBreakEndSound()` wrap their entire body in a try/catch that silently swallows all errors. If the `AudioContext` creation fails, or `resume()` rejects, or `createOscillator()` throws, the user gets no feedback and no diagnostic information.

Adding a `console.warn` inside the catch would not affect performance but would make debugging significantly easier, especially when testing the "phone under a plant" scenario from the sprint spec.

**Severity: P3** — Silent failure is acceptable for audio (the timer still works), but a `console.warn` is free and helpful.

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
| P2-PERF-11 | ~~P2~~ | ~~No retry queue for failed mutations~~ | **FULLY RESOLVED** Sprint 7/8 |
| P2-PERF-21 | ~~P2~~ | ~~Complete/interrupt mutations not queued~~ | **RESOLVED** Sprint 8 |
| P3-PERF-22 | ~~P3~~ | ~~Flush race on concurrent online events~~ | **RESOLVED** Sprint 8 |
| P2-PERF-25 | **P2** | AudioContext `resume()` fire-and-forget on mobile | **NEW** |
| P2-PERF-26 | **P2** | Wake lock not released on component unmount | **NEW** |
| P2-PERF-18 | P2 | Pre-cached SSR routes may serve stale inline data | OPEN |
| P3-PERF-03 | P3 | Font loading — external, not SW-cached | OPEN |
| P3-PERF-04 | P3 | Clerk could be lazy-loaded (~80kB savings) | OPEN |
| P3-PERF-13 | P3 | SVG progress ring: transition-all overlap | OPEN |
| P3-PERF-14 | P3 | 250ms tick interval — 4x more renders than needed | OPEN |
| P3-PERF-17 | P3 | Completion modal re-renders entire Timer on keystroke | OPEN |
| P3-PERF-19 | P3 | SW registration error silently swallowed | OPEN |
| P3-PERF-20 | P3 | JetBrains Mono preload redundant with immediate stylesheet | OPEN |
| P3-PERF-23 | P3 | No queue size limit or TTL | OPEN |
| P3-PERF-24 | P3 | Queued complete/interrupt depends on sessionId availability | OPEN |
| P3-PERF-27 | P3 | Maskable icon reuses standard icon — may clip | **NEW** |
| P3-PERF-28 | P3 | 5 simultaneous oscillators — budget mobile concern | **NEW** |
| P3-PERF-29 | P3 | Empty catch blocks in audio functions | **NEW** |

**P1 count: 0** | **P2 count: 3** (1 carried, 2 new) | **P3 count: 12** (9 carried, 3 new)

---

## What Moved the Needle

The Sprint #14 decision to use the Web Audio API instead of audio file dependencies is the standout engineering choice. It adds sounds with effectively zero bundle cost, zero network requests, and full offline compatibility. This is the kind of decision that raises the Bundle Size score.

The `makeNote()` helper is well-designed: each oscillator/gain pair is self-cleaning via the `onended` callback, preventing the audio graph leak that was P3-PERF-12 (fixed in Sprint 6). The exponential gain ramp to 0.001 creates natural decay without abrupt cutoffs. The module-level `AudioContext` singleton avoids the Chrome limit of ~6 contexts per page.

The wake lock implementation is mostly correct — acquired on start, released on pause/stop/completion, re-acquired on visibility change. The missing unmount cleanup (P2-PERF-26) is the only gap.

---

## What's Missing for 8.5+

The path from 8.4 to 8.5+ requires fixing the two new P2 issues, which are both straightforward:

### Must-do (to reach 8.5)

1. **Await `ctx.resume()` before scheduling notes (P2-PERF-25).** Make `playWorkCompleteSound` and `playBreakEndSound` async. `await ctx.resume()` before the `makeNote()` calls. This ensures sound works reliably on mobile after the screen has been locked or the tab backgrounded.

2. **Release wake lock on unmount (P2-PERF-26).** Add a `useEffect(() => () => releaseWakeLock(), [])` to the Timer component. One line of code, prevents indefinite screen-on when navigating away.

### Nice-to-have (to reach 9.0)

3. **Self-host fonts (P3-PERF-03).** Still the most impactful P3 for offline experience.

4. **Lazy-load Clerk (P3-PERF-04).** Still ~80kB gz savings on initial load.

5. **Add `console.warn` to audio catch blocks (P3-PERF-29).** Free diagnostic improvement.

---

## Verdict

Sprint #14 is a well-executed feature sprint. The three additions — sounds, wake lock, PWA manifest — are all implemented using zero external dependencies, which is the optimal approach for a lightweight productivity app.

The audio architecture deserves specific praise: module-level singleton context, self-cleaning oscillator nodes, proper gain ramping, and a helper function that encapsulates the create-connect-schedule-cleanup lifecycle. This is how Web Audio should be used for simple notification sounds. The previous AudioContext leak issue (P3-PERF-12 from Sprint 6) has not regressed — the `onended` cleanup pattern is correctly applied to every oscillator.

The two new P2 issues are both lifecycle gaps rather than architectural problems. The `resume()` fire-and-forget on mobile (P2-PERF-25) could cause silent audio failures on the exact platform where sounds matter most. The wake lock unmount leak (P2-PERF-26) could keep screens awake unnecessarily. Both are one-line fixes.

At 8.4 with zero P1 issues for eight consecutive sprints, the app's performance profile continues to mature. The jump from 8.2 to 8.4 is modest, reflecting that the sprint added new features (which introduce new issues) rather than fixing existing ones. Resolving the two P2s would bring this to 8.6 — the highest score in the project's history.
