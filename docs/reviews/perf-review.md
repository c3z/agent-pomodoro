# Performance Review — Agent Pomodoro (Sprint #7)

**Reviewer:** Performance
**Date:** 2026-03-15
**Previous scores:** Sprint #1: 5.4, Sprint #2: 6.6, Sprint #3: 7.2, Sprint #4: not scored, Sprint #5: 7.2, Sprint #6: 7.6
**Files reviewed:** `app/lib/retryQueue.ts`, `app/routes/timer.tsx`, `app/components/Timer.tsx`, `public/sw.js`, `app/routes/home.tsx`, `app/components/Stats.tsx`, `app/components/Providers.tsx`, `app/routes/layout.tsx`, `app/root.tsx`, `convex/sessions.ts`, `vite.config.ts`, `package.json`

---

## Sprint 7 Changes Evaluated

1. **Mutation retry queue** (`app/lib/retryQueue.ts`) — localStorage-backed queue for failed mutations. Enqueue on catch, flush on mount and `online` event. Three exports: `enqueue()`, `getQueue()`, `removeItem()`, `clearQueue()`.

2. **Timer page integration** (`app/routes/timer.tsx`) — `onSessionStart` catch block calls `enqueue({ action: "start", args })`. `useEffect` runs `flush()` on mount and listens for `window.addEventListener("online", flush)`. Reverse-iteration during flush to safely `removeItem(i)` by index.

3. **Stats period selector** (`app/routes/home.tsx`) — `PERIOD_OPTIONS` array with 7d/30d/All. `useState(7)` drives `sinceDaysAgo` param to `api.sessions.stats`. No performance impact — Convex queries are already indexed by `by_user_date`.

---

## Scores

| # | Subcategory | Score | Prev (S6) | Delta | Notes |
|---|-------------|-------|-----------|-------|-------|
| 1 | Timer Accuracy | 8/10 | 8 | 0 | Unchanged. Wall-clock anchor remains correct. |
| 2 | Initial Load | 8/10 | 8 | 0 | No changes to font strategy or bundle. |
| 3 | Bundle Size | 8/10 | 8 | 0 | retryQueue.ts is ~30 lines, zero deps. Period selector is trivial. |
| 4 | State Management | 7/10 | 7 | 0 | Retry queue is clean. Minor concern: flush race condition (see below). |
| 5 | Offline Capability | 8/10 | 7 | +1 | The #1 open P2 is resolved. Failed starts now survive connectivity drops. |

**Overall: 7.8 / 10** (prev 7.6, delta +0.2)

Sprint #7 closes the single most impactful open issue from Sprint #6: the mutation retry queue (P2-PERF-11). The timer could already run offline; now the data survives too — at least for start mutations. The implementation is minimal, correct, and adds no dependencies.

---

## 1. Timer Accuracy — 8/10 (unchanged)

No changes to the timer mechanism. The wall-clock anchor pattern continues to function correctly:

- `endTimeRef.current = Date.now() + secondsLeft * 1000` set on start/resume
- 250ms `setInterval` reads `Date.now()` each tick, computes remaining via `Math.ceil((endTime - now) / 1000)`
- `visibilitychange` handler recalculates on tab refocus

No drift, no background tab issues.

**Remaining concerns (unchanged):**

### P3-PERF-14: 250ms tick interval (unchanged, OPEN)
4 state updates per second where 1 would suffice. Not perceptible given React 19 batching, but unnecessary work. 1000ms with the same wall-clock correction would produce identical visual output.

---

## 2. Initial Load — 8/10 (unchanged)

No changes to fonts, preloads, or asset loading strategy. Sprint #7 adds ~30 lines of application code across two files. No measurable impact on initial load.

**Remaining concerns (unchanged):**

### P3-PERF-03: Font loading — external, not SW-cached (unchanged, OPEN)
Fonts still loaded from `fonts.googleapis.com`. Self-hosting under `/assets/fonts/` would bring them under SW cache-first strategy and eliminate external dependency.

### P3-PERF-20: JetBrains Mono preload redundant (unchanged, OPEN)
Preload `as="style"` immediately followed by the same URL as `rel="stylesheet"`. Marginal benefit.

---

## 3. Bundle Size — 8/10 (unchanged)

`retryQueue.ts` is 31 lines, zero imports beyond native `localStorage`. The period selector in `home.tsx` adds a `useState`, three buttons, and one extra arg to the existing `useQuery` call. No new dependencies. `package.json` unchanged.

Production dependency profile (unchanged):
- `react` + `react-dom`: ~45kB gz
- `@clerk/*`: ~80kB gz
- `convex`: ~35kB gz
- `react-router`: ~25kB gz
- App code: ~7kB total (+1kB from retryQueue + period selector)
- **Total estimated: ~192kB gzipped** (negligible change)

**Remaining concerns (unchanged):**

### P3-PERF-04: Clerk could be lazy-loaded (unchanged, OPEN)
~80kB gz loaded eagerly in `Providers.tsx`. `React.lazy()` would defer until auth is actually needed.

---

## 4. State Management — 7/10 (unchanged)

The retry queue introduces new state management patterns. The implementation is mostly clean but has two concerns worth documenting.

### P2-PERF-11: Retry queue — PARTIALLY RESOLVED

The queue itself is well-designed: simple data structure, `localStorage` persistence, timestamp tracking. The integration in `timer.tsx` is correct for the `start` mutation.

**What's good:**
- Reverse iteration during flush (`for (let i = queue.length - 1; i >= 0; i--)`) — correctly handles `removeItem(i)` without index shift bugs
- Silent catch in flush — items stay in queue for next attempt, no data loss
- `useEffect` cleanup removes the `online` listener — no leaks
- Queue operations are synchronous (localStorage) — no async race with React state

**What's missing:**

### P2-PERF-21 (NEW): Complete and interrupt mutations not queued

Only `start` is enqueued on failure (timer.tsx line 53). The `onSessionComplete` catch block (line 66) logs and drops. The `onSessionInterrupt` catch block (line 77) logs and drops. This means:

- Start a pomodoro online (start mutation succeeds, `sessionIdRef.current` is set)
- Go offline
- Complete the pomodoro (complete mutation fails silently)
- Server has an orphaned session: started but never completed or interrupted

The `start` mutation is arguably the *least* critical one to queue — a missing start is a missing record, but a missing completion corrupts an existing record. The `complete` and `interrupt` mutations need the same enqueue treatment.

The fix requires storing `sessionIdRef.current` (the Convex document ID) alongside the queued action args. The pattern is identical to the existing `start` queue path. Estimated effort: 10-15 lines.

Severity: **P2** — data corruption (orphaned sessions) under a realistic scenario (online at start, offline at completion).

### P3-PERF-22 (NEW): Flush race on concurrent online events

`flush()` is async but not guarded against concurrent execution. If the browser fires multiple `online` events in rapid succession (which some browsers do — Chrome fires it on WiFi reconnect + on actual connectivity confirmation), two flush() calls could process the same queue item simultaneously:

1. flush-A reads queue, sees item at index 2
2. flush-B reads queue, sees same item at index 2
3. flush-A awaits `startSession(item.args)` — succeeds
4. flush-B awaits `startSession(item.args)` — succeeds (duplicate mutation)
5. Both call `removeItem(2)` — second call removes the wrong item

The Convex `start` mutation is not idempotent — it calls `ctx.db.insert()` every time. Two flushes of the same queued start create two session records.

Fix: a simple `isFlushing` boolean guard at the top of `flush()`. One line.

Severity: **P3** — unlikely in practice (requires overlapping `online` events AND slow network), but the fix is trivial.

### P3-PERF-23 (NEW): No queue size limit or TTL

The queue has no maximum size and no expiry. Theoretically, if a user goes offline for weeks and keeps starting timers, the queue grows unbounded. More practically, stale items from days ago should probably be discarded rather than replayed — a session "started" 3 days late has no useful meaning.

Fix: check `timestamp` age in `flush()`, discard items older than 24h. Add a max queue size (e.g., 50 items) in `enqueue()`.

Severity: **P3** — the realistic queue size is 1-3 items, not a practical concern.

**Other state management concerns (unchanged):**

### P3-PERF-13: SVG progress ring transition overlap (unchanged, OPEN)
`transition-all duration-300` on the progress ring. `transition-[stroke-dashoffset]` would be more precise.

### P3-PERF-17: Completion modal re-renders entire Timer (unchanged, OPEN)
Typing in notes textarea triggers full Timer re-renders. Shallow tree makes this imperceptible.

---

## 5. Offline Capability — 8/10 (improved from 7)

This is the sprint's headline improvement. The mutation retry queue directly addresses P2-PERF-11, the highest-priority open issue from every review since Sprint #5.

### P2-PERF-11: No retry queue for failed mutations — PARTIALLY RESOLVED

**What's resolved:** Failed `start` mutations are serialized to `localStorage` with `{ action: "start", args, timestamp }`. On page mount or `online` event, the queue is flushed by replaying mutations against Convex. Successful replays are removed from the queue; failures stay for the next flush attempt.

**What remains:** `complete` and `interrupt` mutations are not queued (see P2-PERF-21 above). The queue covers the beginning of a session lifecycle but not the end. This is the gap between "partially resolved" and "fully resolved."

The service worker (`sw.js`) correctly handles the offline-to-online transition for static assets. Navigation requests use network-first with cache fallback. Hashed assets under `/assets/` use cache-first. Convex WebSocket/API calls are correctly excluded from SW interception.

**Practical offline scenario analysis:**

| Scenario | Start | Complete | Data saved? |
|----------|-------|----------|-------------|
| Online throughout | Direct | Direct | Yes |
| Offline at start, online at end | Queued, flushed on online | Direct | Yes (new) |
| Online at start, offline at end | Direct | Dropped | **NO** (P2-PERF-21) |
| Offline throughout | Queued | Dropped | **Partial** (P2-PERF-21) |

The most common offline scenario is "online at start, offline at end" (user starts a 25-minute pomodoro, WiFi drops during the session). This is exactly the case that is NOT covered. Upgrading the score from 7 to 8 rather than 9 because of this gap.

**Remaining concerns:**

### P2-PERF-21: Complete/interrupt not queued (NEW, see above)

### P2-PERF-18: Pre-cached SSR routes serve stale inline data (unchanged, OPEN)
`cache.addAll(["/", "/timer", "/history"])` caches full SSR HTML at install time. Cosmetic concern — React hydration replaces stale content quickly.

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
| P2-PERF-11 | ~~P2~~ | ~~No retry queue for failed mutations~~ | **PARTIALLY RESOLVED** Sprint 7 |
| P2-PERF-21 | P2 | Complete/interrupt mutations not queued | NEW |
| P2-PERF-18 | P2 | Pre-cached SSR routes may serve stale inline data | OPEN |
| P3-PERF-03 | P3 | Font loading — external, not SW-cached | OPEN |
| P3-PERF-04 | P3 | Clerk could be lazy-loaded (~80kB savings) | OPEN |
| P3-PERF-13 | P3 | SVG progress ring: transition-all overlap | OPEN |
| P3-PERF-14 | P3 | 250ms tick interval — 4x more renders than needed | OPEN |
| P3-PERF-17 | P3 | Completion modal re-renders entire Timer on keystroke | OPEN |
| P3-PERF-19 | P3 | SW registration error silently swallowed | OPEN |
| P3-PERF-20 | P3 | JetBrains Mono preload redundant with immediate stylesheet | OPEN |
| P3-PERF-22 | P3 | Flush race on concurrent online events | NEW |
| P3-PERF-23 | P3 | No queue size limit or TTL | NEW |

**P1 count: 0** | P2 count: 2 | P3 count: 8

---

## What Moved the Needle

Sprint #7 delivered the single item that Sprint #6 said was required for 8.0: the mutation retry queue. The implementation is nearly right. The fact that it only covers `start` and not `complete`/`interrupt` is the difference between "nearly right" and "fully right," and between 7.8 and 8.0+.

The retry queue architecture is sound:

1. **Correct persistence layer.** `localStorage` is synchronous, survives page reloads, and has ~5MB capacity — more than enough for a queue that realistically holds 1-3 items. No IndexedDB complexity, no service worker message passing.

2. **Correct flush trigger.** Mount + `online` event covers both scenarios: returning to the page after closing it offline, and network reconnection while the page is open.

3. **Correct iteration order.** Reverse `for` loop during flush avoids the classic splice-while-iterating bug. Items are removed by index from the end, so earlier indices remain valid.

4. **Minimal API surface.** Four functions, 31 lines, zero dependencies. Nothing to tree-shake, nothing to bundle-analyze, nothing to debug.

The period selector in `home.tsx` is performance-neutral. Convex's `by_user_date` index means the `sinceDaysAgo` parameter change doesn't increase query cost — it just adjusts the range scan boundary. The three-button UI adds no meaningful DOM weight.

---

## What's Missing for 8.0+

The path from 7.8 to 8.0 is exactly one item.

### Must-do (to reach 8.0)

1. **Queue complete/interrupt mutations (P2-PERF-21).** The retry queue exists. It works. It just needs to cover the other two mutation types. The `complete` mutation needs `{ sessionId, userId, notes, tags }` queued. The `interrupt` mutation needs `{ sessionId, userId }` queued. The flush logic already handles dispatching by `item.action`. Add `"complete"` and `"interrupt"` cases to the `flush()` switch, and `enqueue()` calls to the catch blocks in `onSessionComplete` and `onSessionInterrupt`. Estimated effort: 15-20 lines. This closes P2-PERF-21 and fully resolves P2-PERF-11, pushing Offline Capability to 9 and overall to ~8.2.

### Nice-to-have (to reach 8.5+)

2. **Add isFlushing guard (P3-PERF-22).** One boolean, three lines. Prevents duplicate mutations on rapid `online` events.

3. **Add queue TTL (P3-PERF-23).** Discard items older than 24h in `flush()`. Prevents stale replays after prolonged offline periods.

4. **Self-host fonts (P3-PERF-03).** Move fonts to `/assets/fonts/`, bring under SW cache-first strategy. Eliminates last external dependency.

5. **Lazy-load Clerk (P3-PERF-04).** `React.lazy()` wrapper saves ~80kB gz on timer page initial load.

6. **Reduce tick to 1s (P3-PERF-14).** One line change, halves render count during active timer.

---

## Verdict

Sprint #7 delivered the right feature. The mutation retry queue was identified as the #1 priority in every review since Sprint #5, and this sprint built exactly that. The architecture is clean, minimal, and correct within its scope.

The scope is the problem. Queuing `start` but not `complete` or `interrupt` covers the least critical mutation — a missing start record is an absence, while a missing completion is a corruption (orphaned session). The most common real-world offline scenario (online at start, connectivity drops during a 25-minute focus session, offline at completion) hits exactly the uncovered case.

That said, the infrastructure is in place. Extending to cover `complete` and `interrupt` is 15 lines, not an architectural change. The foundation is solid; the coverage is incomplete.

At 7.8, this is the highest performance score in the project's history. Zero P1 issues for the fifth consecutive sprint. The app is reliable, the timer is accurate, the offline story is functional and partially persistent. One more flush of the retry queue — covering the remaining mutation types — and this review can award 8.0+ for the first time.

P2 count: 2. One is the retry queue gap (new, specific, actionable). One is the stale SSR cache (old, low practical impact). The former is worth fixing; the latter can wait.
