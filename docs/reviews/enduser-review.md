# End-User Review: Agent Pomodoro (Sprint #7)

**Reviewer:** End-user perspective (daily Pomodoro user)
**Date:** 2026-03-15
**Previous Scores:** Sprint #1: 5.6, Sprint #2: 6.6, Sprint #3: 7.3, Sprint #5: 7.7, Sprint #6: 7.9
**Scope:** UI/UX, daily usability, mobile readiness, agent queryability

---

## Sprint #7 Changes Evaluated

1. **Stats period selector (7d / 30d / All)** -- Dashboard now has a 3-button toggle below the header. `PERIOD_OPTIONS` array maps labels to day counts (7, 30, 365). The `periodDays` state drives the `sinceDaysAgo` parameter passed to the `stats` query. Active button gets `bg-surface-lighter text-white`, inactive gets `text-gray-500 hover:text-gray-300`. Default: 7d.
2. **7 new E2E tests** -- `dashboard.spec.ts` (4 tests: period selector visible, 7d default selected, switching to 30d, stat cards visible) and new tests in `timer.spec.ts` (keyboard Space starts, Escape resets, keyboard hint visible). Total timer tests: 11.
3. **Mutation retry queue for offline resilience** -- `retryQueue.ts` provides localStorage-backed queue with `enqueue`, `getQueue`, `removeItem`, `clearQueue`. `timer.tsx` enqueues failed `start` mutations and flushes on `online` event.

---

## Overall Score: 8.2 / 10

| # | Category | Sprint #1 | Sprint #2 | Sprint #3 | Sprint #5 | Sprint #6 | Sprint #7 | Delta |
|---|----------|-----------|-----------|-----------|-----------|-----------|-----------|-------|
| 1 | First Impression | 6 | 7 | 7 | 7.5 | 7.5 | 8 | +0.5 |
| 2 | Timer UX | 5 | 8 | 8.5 | 9 | 9.5 | 9.5 | 0 |
| 3 | Data Visibility | 6 | 6 | 7 | 7.5 | 8 | 8.5 | +0.5 |
| 4 | Mobile Usability | 4 | 5 | 7 | 7 | 7 | 7 | 0 |
| 5 | Agent Integration | 7 | 7 | 7 | 7.5 | 7.5 | 8 | +0.5 |

**Average: (8 + 9.5 + 8.5 + 7 + 8) / 5 = 8.2**

---

## Detailed Assessment

### 1. First Impression (8.0/10)

The stats period selector is the first thing a returning user notices that's new. The 3-button toggle (`7d | 30d | All`) sits centered below the heading, above the stat cards. The visual language is consistent -- same `rounded-lg font-mono text-xs` as other pill buttons in the app. Active state uses `bg-surface-lighter text-white`, inactive `text-gray-500 hover:text-gray-300`. No visual noise, no confusion about what it does.

The skeleton loading state (4 pulsing cards) remains in place and now correctly covers the period-switch transition -- when the user clicks "30d", the stats query re-fires with the new `sinceDaysAgo` parameter and the skeleton shows while Convex responds. In practice, Convex is fast enough that the skeleton barely flashes, but the fallback is there.

The dashboard now tells a richer story at a glance: "This week you did X, this month you did Y." That's the difference between a current-state widget and a trends dashboard. For a user who has been running the app for weeks, this is the feature that makes the home page worth visiting instead of going straight to `/timer`.

**What still holds this back from 9:**
- No onboarding state for first-time users. The dashboard with zero data and zero context still greets a new user with a wall of "0" stats and "No sessions yet." A welcome card with a brief explanation and a direct "Start your first session" prompt would make the first 10 seconds meaningfully better.
- "All" maps to 365 days (`{ label: "All", days: 365 }`), not actual all-time. If c3z uses this app for more than a year, "All" silently drops older data. The backend's `stats` query could accept a sentinel value (e.g., `sinceDaysAgo: 0` or `sinceDaysAgo: undefined`) to mean "no time filter." Currently, it defaults to 7 if not provided, so the 365 cap is a frontend design choice, not a backend limitation per se -- but the backend does `Date.now() - since * 24 * 60 * 60 * 1000` which means passing 0 would return nothing. A backend change is needed to support true "all time."

**Score moves from 7.5 to 8.0.** The period selector was explicitly identified as the path to 8.0 in the Sprint #6 review, and it delivers.

### 2. Timer UX (9.5/10)

No functional changes to the timer in Sprint #7. The timer was already at 9.5 after Sprint #6's keyboard shortcut and AudioContext fixes.

What Sprint #7 adds is **confidence**: 7 new E2E tests validate the timer flow that was previously only manually tested. The keyboard shortcut tests (`keyboard space starts the timer`, `keyboard escape resets the timer`) and the `keyboard hint is visible` test mean that future sprints cannot accidentally regress the keyboard flow without the CI catching it. The mode-switching tests (`switching to break shows 05:00`, `switching to long break shows 15:00`) lock in the config values.

From an end-user perspective, this doesn't change the experience today, but it protects the experience tomorrow. The timer is the core product -- regressions here would be catastrophic for trust. The test coverage is proportional to the risk.

**Outstanding from Sprint #6:**
- Timer state still lost on page navigation (architectural, not sprint-scoped)
- No visual urgency in final 30 seconds
- No haptic feedback on mobile

**Holds at 9.5.** The E2E tests are valuable but invisible to the user.

### 3. Data Visibility (8.5/10)

The period selector is the biggest Data Visibility upgrade since tags were added in Sprint #6. It closes the gap flagged repeatedly since Sprint #3: "stats hardcoded to 7 days."

**How it works in practice:**
- User opens dashboard. Sees 7d stats by default (correct for daily check-in).
- Clicks "30d" -- stat cards update: streak might be longer, focus hours are higher, completion rate may differ. The user can now see monthly patterns.
- Clicks "All" -- the long view. "How much total focus time have I accumulated?"

The `period` field in `StatsData` (returned as `"7d"`, `"30d"`, `"365d"`) is shown as a sublabel under "Focus Time" (e.g., "3.5h" with sublabel "7d"). This contextualizes the number: you know the hours are scoped to the selected period. Smart use of an existing UI slot.

The stat cards themselves remain the right set of KPIs: Streak (behavioral consistency), Focus Time (volume), Completion % (quality), Since Last (recency/urgency). The color coding is unchanged and still effective.

**What still holds this back:**
- P1: History page caps at `limit: 100` with no pagination or "load more." After a few weeks of heavy use (6-8 sessions/day), a user cannot access sessions older than ~2 weeks. This is a real data visibility gap -- the user writes notes and tags on every session but physically cannot scroll back to read them.
- P2: `avgSessionsPerDay` is computed by the backend (`Math.round((workSessions.length / since) * 10) / 10`) but not displayed anywhere. This is a useful trend metric that's one `<StatCard>` away from being visible.
- P2: Notes in session list are still truncated at `max-w-48` with no expand mechanism. Detailed notes remain unreadable after writing.
- P2: No filtering by tag in history. Tags are displayed but not actionable as filters.

**Score moves from 8.0 to 8.5.** The period selector is exactly the feature the Sprint #6 review demanded. The remaining gaps are pagination and filtering, which are Sprint #8 territory.

### 4. Mobile Usability (7.0/10)

No mobile-specific changes in Sprint #7. The period selector buttons inherit the same mobile concerns as other small button elements:

- `px-3 py-1 rounded-lg font-mono text-xs` yields a tap target of roughly 56x28px. Width is fine (3 buttons in a centered row have plenty of horizontal space), but height is below the 44px iOS guideline. Tappable but not comfortably so.
- The period selector row is `flex justify-center gap-1`, so buttons don't crowd each other. Good.

The session list rows remain the biggest mobile concern. Each row packs icon + time + duration label + completion mark + tags + notes into a single `flex items-center gap-3` line. On a 375px screen with 16px side padding, that leaves ~343px of content width. A session with 2 tags and a note will overflow or wrap awkwardly. The `truncate max-w-48` on notes helps prevent the worst case, but the row layout needs a stacked variant for narrow viewports.

**Outstanding mobile issues:**
- Session list row overflow on narrow screens
- Period selector tap targets below 44px guideline
- No bottom nav bar for standalone PWA
- Completion modal keyboard shortcuts irrelevant on mobile (no meta keys for Cmd+Enter)
- No haptic feedback on timer completion

**Holds at 7.0.** No mobile work was done this sprint.

### 5. Agent Integration (8.0/10)

The mutation retry queue is an infrastructure feature that directly impacts agent integration reliability.

**Why it matters for the agent:** If c3z starts a Pomodoro while on a flaky connection (train, cafe, conference), the `start` mutation fails. Without the retry queue, the session never reaches Convex. The agent later queries `agentSummary` and sees zero sessions for today. It concludes c3z is slacking and fires off a scolding. In reality, c3z was working -- the data just didn't persist. False negatives in agent monitoring erode trust in the system.

The retry queue (`retryQueue.ts`) is a clean, minimal implementation:
- `enqueue()` adds a mutation to localStorage with a timestamp
- `getQueue()` reads and parses (with try/catch fallback to empty array)
- `removeItem()` splices a specific index
- The `online` event listener in `timer.tsx` triggers a flush that iterates the queue and replays mutations

**What works:**
- localStorage persistence survives tab close and browser restart. If c3z starts a session offline, closes the laptop, and opens it later when online, the `online` event fires and the queue flushes.
- The flush iterates backwards (`i = queue.length - 1; i >= 0`) which is safe for splice-on-success -- removing item `i` doesn't shift the indices of items `< i`.
- Failure during flush leaves the item in the queue for the next `online` event.

**Critical gap -- P2:**
- Only `start` mutations are enqueued. The `onSessionComplete` and `onSessionInterrupt` handlers in `timer.tsx` catch errors with `console.warn` but do NOT call `enqueue()`. If the network drops between session start and session completion (a 25-minute window where a lot can change), the completion is silently lost. The session persists in Convex as `completed: false, interrupted: false` forever -- a ghost session. The agent sees an incomplete session and cannot distinguish "still running" from "lost data."
- `agentSummary` remains hardcoded to a 7-day window. The user-facing stats now support period selection, but the agent cannot request a different period. Adding `sinceDaysAgo` to the `agentSummary` args would be a trivial backend change.
- No queue size limit. If the user stays offline for an extended period, stale mutations accumulate in localStorage without bound. Adding a TTL (e.g., drop items older than 24h) and a cap (e.g., max 50 items) would prevent pathological cases.

**Score moves from 7.5 to 8.0.** The retry queue is a meaningful reliability improvement for the agent data pipeline. The incomplete coverage (start only, not complete/interrupt) prevents it from being a full solution.

---

## Findings

### P1 (Must fix)

| # | Issue | Component | Status |
|---|-------|-----------|--------|
| 21 | History capped at 100 sessions, no pagination or "load more" | `history.tsx:10` | OPEN (Sprint #6) |

**Active P1 count: 1**

This is elevated from P2 to P1 this sprint. With the period selector encouraging users to think in 30-day and all-time windows, the 100-session hard cap is now a contradiction. The dashboard says "here's your all-time focus hours" but the history page can only show the last ~2 weeks of sessions. Users who tag and annotate sessions cannot access their own historical data. This is a data integrity issue from the user's perspective.

### P2 (Should fix)

| # | Issue | Component | Status |
|---|-------|-----------|--------|
| 8 | Nav breaks on narrow mobile screens (<360px) | `layout.tsx` | OPEN |
| 20 | Notification icon uses `/favicon.ico` instead of PWA icon | `Timer.tsx:80` | OPEN |
| 30 | Notes truncated with no expand mechanism | `SessionList.tsx:126` | OPEN |
| 31 | No tag filtering in history | `history.tsx`, `sessions.ts` | OPEN |
| 34 | **"All" period = 365 days, not actual all-time** -- `PERIOD_OPTIONS` maps "All" to `days: 365`. For users with >1 year of data, the label lies. Backend `stats` query uses `Date.now() - since * 24 * 60 * 60 * 1000` which needs a code path for "no time filter." | `home.tsx:12`, `sessions.ts:108` | **NEW** |
| 35 | **Retry queue only enqueues `start`, not `complete`/`interrupt`** -- `onSessionComplete` and `onSessionInterrupt` catch errors and log to console but never call `enqueue()`. Ghost sessions (started but neither completed nor interrupted) accumulate in the database when network drops mid-session. | `timer.tsx:56-79` | **NEW** |
| 36 | **`avgSessionsPerDay` computed but not displayed** -- Backend returns this field in the stats response but no `StatCard` renders it. A useful trend metric left invisible. | `Stats.tsx`, `sessions.ts:168` | **NEW** |
| 37 | **No retry queue size limit or TTL** -- localStorage queue grows unbounded. Stale mutations from days ago could replay incorrectly. | `retryQueue.ts` | **NEW** |

### P3 (Nice to have)

| # | Issue | Component | Status |
|---|-------|-----------|--------|
| 12 | Timer state lost on page navigation | `Timer.tsx` (architecture) | OPEN |
| 15 | No streak encouragement or daily goal UI | `home.tsx` | OPEN |
| 16 | Break session stats not surfaced | `sessions.ts` | OPEN |
| 23 | manifest theme_color differs from meta theme-color | `root.tsx`, `manifest.json` | OPEN |
| 26 | agentSummary does not include tag breakdown | `sessions.ts` | OPEN |
| 32 | Completion modal not dismissable by backdrop click | `Timer.tsx:451` | OPEN |
| 33 | No visual urgency at timer end (last 30s) | `Timer.tsx` | OPEN |
| 38 | **No first-time user onboarding state** -- Dashboard with zero data shows empty stats and "No sessions yet." A welcome card with a brief explanation would reduce bounce for new users. | `home.tsx` | **NEW** |
| 39 | **Period selector tap targets below 44px iOS guideline** -- `py-1` yields ~28px height. Functional but below mobile best practice. | `home.tsx:43` | **NEW** |
| 40 | **`agentSummary` hardcoded to 7d** -- User-facing stats now support period selection but agent API does not accept `sinceDaysAgo`. | `sessions.ts:178` | **NEW** |

---

## What Moved the Needle This Sprint

**Sprint #7 delivered the single feature most requested by the Sprint #6 review: the stats period selector.**

The Sprint #6 review concluded: "The app is one small feature away from 8.0: a stats period selector. The backend supports it. The frontend needs a toggle. This should be the first item in Sprint #7." It was, and it pushes the overall score past the 8.0 threshold.

The period selector is a small UI change with outsized impact. It transforms the dashboard from a "what happened this week" widget into a multi-scale trends view. The implementation is clean: a `useState` for `periodDays`, a `PERIOD_OPTIONS` constant, and the existing `sinceDaysAgo` query parameter. No over-engineering, no unnecessary abstraction. Ship it.

The **E2E test expansion** (7 new tests) does not change the user experience today, but it protects the two most important interaction patterns: keyboard shortcuts and dashboard stat rendering. The `dashboard.spec.ts` tests specifically validate the period selector UI -- that all three buttons render, that 7d is default-selected, and that clicking 30d switches the active state. If a future refactor breaks the period selector, CI will catch it. This is the kind of defensive testing that compound over time.

The **mutation retry queue** addresses a real failure mode (offline session starts) with a pragmatic localStorage solution. It's not a full offline-first architecture -- complete and interrupt mutations still silently fail -- but it covers the most common case: user starts a timer on a flaky connection, the start mutation fails, the queue holds it, and the next `online` event replays it. For agent integration, this means fewer ghost sessions and more accurate reporting.

---

## What's Still Missing for 8.5+

### 1. History pagination (P1 #21)
The most important gap. 100-session cap with no "load more" means historical data is inaccessible. Fix: add cursor-based pagination to `listByUser` query, "Load more" button in `history.tsx`. This alone would push Data Visibility to 9.0.

### 2. Complete/interrupt retry (P2 #35)
The retry queue is half-built. Adding `complete` and `interrupt` to the enqueue path closes the ghost session gap. Without it, the retry queue creates a new failure mode: sessions that start (from queue replay) but never complete (because the completion was lost).

### 3. Notes expand + tag filtering (P2 #30, #31)
These are the two "read-side" features that make tags and notes actually useful beyond write-and-forget. A click-to-expand on session rows and a tag filter bar above the history list would make the data collection investment pay off.

### 4. True "All" period (P2 #34)
Replace `days: 365` with a backend code path that queries without a time filter. Small change, prevents the "All" label from becoming a lie.

**Priority path to 8.5:** History pagination (#21) + complete/interrupt retry (#35).
**Path to 9.0:** + notes expand + tag filtering + true "All" + first-time onboarding.

---

## Sprint #7 Scorecard

| Metric | Value |
|--------|-------|
| Sprint #6 P2s resolved | 0 of 5 |
| Sprint #6 P3s resolved | 1 of 8 (#14 stats period -- was P3, now delivered) |
| New features delivered | 3 (period selector, E2E tests, retry queue) |
| New issues found | 7 (4 P2, 3 P3) |
| Active P1 count | **1** (elevated: history pagination) |
| Active P2 count | 8 |
| Active P3 count | 10 |

---

## Verdict

Sprint #7 crosses the 8.0 line. The stats period selector -- explicitly called out as the path to 8.0 in the Sprint #6 review -- is delivered cleanly and correctly. The E2E test expansion locks in the keyboard-driven flow and dashboard rendering. The retry queue is a meaningful start on offline resilience, though its incomplete coverage (start only) is a notable gap.

The score trajectory is healthy: 5.6 -> 6.6 -> 7.3 -> 7.7 -> 7.9 -> 8.2. Each sprint adds 0.3-0.7 points. The app is now genuinely usable as a daily focus tool with agent monitoring capabilities. The remaining gaps are in data access (pagination, filtering) and offline completeness -- not in core functionality.

The P1 elevation of history pagination reflects a real tension: the dashboard now encourages long-term thinking (30d, All views) but the history page can only show ~2 weeks. Resolving this contradiction should be Sprint #8's top priority.

**Previous score: 7.9 / 10**
**Current score: 8.2 / 10**
**P1 count: 1**

**Path to 8.5:** History pagination + complete/interrupt retry queue.
**Path to 9.0:** + notes expand + tag filtering + first-time onboarding + true "All" period.
