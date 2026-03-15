# End-User Review: Agent Pomodoro

**Reviewer:** End-user perspective (daily Pomodoro user)
**Date:** 2026-03-15
**Commit:** `60d1547`
**Scope:** UI/UX, daily usability, mobile readiness, agent queryability

---

## Subcategory Scores

| # | Category | Score | Notes |
|---|----------|-------|-------|
| 1 | First Impression | 6/10 | Clean dark theme, clear layout, but feels static and cold. No personality beyond the tagline. |
| 2 | Timer UX | 5/10 | Core loop works (start/pause/reset), but no audio feedback that actually works, no keyboard shortcuts, no browser tab title countdown. |
| 3 | Data Visibility | 6/10 | Stats cards are well-designed with color coding, but history is a flat unsorted list with no filtering or grouping. |
| 4 | Mobile Usability | 4/10 | No PWA manifest, no viewport meta considerations beyond Tailwind defaults, nav will cramp on narrow screens. |
| 5 | Agent Integration | 7/10 | Convex queries are clean, `stats` and `todayByUser` provide good agent-queryable surfaces. Missing a dedicated agent endpoint. |

**Weighted Average: 5.6 / 10**

---

## Detailed Assessment

### 1. First Impression (6/10)

The dark theme with pomored/breakgreen accent colors is well-chosen for a focus tool. JetBrains Mono gives it a dev-tool feel that suits the target user. The dashboard layout (stats -> CTA -> today's sessions) is logical.

What holds it back: there is no loading state for the dashboard -- stats and sessions flash from empty defaults to real data. No onboarding for first-time use. The "No sessions yet" empty state is functional but uninspiring. The app does not feel like it *wants* me to come back -- no streak encouragement, no daily goal, no motivational element.

### 2. Timer UX (5/10)

**What works:**
- Progress ring is visually satisfying with smooth CSS transitions
- Mode selector (Focus/Break/Long Break) is clean
- Pomodoro counter dots (4-cycle visualization) is a nice touch
- Auto-transition from work to break mode

**What does not work:**
- **P1: Audio notification is broken.** The base64 WAV data (`UklGRl9vT19teleWQVZFZm10...`) is clearly truncated/invalid. Timer completions are silent. For a Pomodoro app, this is a critical failure -- the whole point is the bell.
- **P1: No browser notification.** When the tab is in the background (which it will be 100% of the time during a focus session), the user gets zero feedback that the timer ended. No `Notification` API, no title change, nothing.
- **P2: No tab title countdown.** Standard for timer apps -- show `12:34 - FOCUS` in the browser tab so the user can glance at it.
- **P2: No keyboard shortcuts.** Space for start/pause, R for reset -- expected for a power-user tool.
- **P3: Timer state is lost on page navigation.** Navigate to Dashboard or History, come back -- timer resets. The timer state lives in React component state, not in a global store or URL param. This is a fundamental architectural gap.
- **P3: "Resume" button label uses ref state.** `startedRef.current` is read during render to decide button text, but ref changes do not trigger re-renders. The button may show "Start" when it should show "Resume" after a pause.

### 3. Data Visibility (6/10)

**What works:**
- Stats cards are compact and well-designed
- Color-coded values (streak colors, "since last" urgency coloring) provide at-a-glance meaning
- Completion rate with fraction sublabel (`3/5`) is useful
- "Since Last" card is perfect for the agent-monitoring use case

**What does not work:**
- **P2: History page is a flat list.** 100 sessions rendered identically with no date grouping, no day separators, no weekly summary. After a week of use this becomes an undifferentiated wall of rows.
- **P2: No date filtering.** Cannot look at "last week" or "this month." Only option is the last 100 sessions.
- **P3: Stats are hardcoded to 7 days.** No way to see monthly or all-time stats from the UI. The backend supports `sinceDaysAgo` but the frontend does not expose it.
- **P3: No notes input.** The schema supports `notes` and `tags` on sessions, and the backend `complete` mutation accepts them, but the UI never provides a way to add notes. The SessionList renders notes if present, but they can never be present from the UI.

### 4. Mobile Usability (4/10)

- **P1: No PWA manifest.** No `manifest.json`, no service worker, no "Add to Home Screen" capability. For a timer app, mobile installability is table stakes.
- **P2: Nav layout will break on small screens.** The nav has logo + 3 links + Clerk button in a single flex row with no responsive wrapping or hamburger menu. On a 320px screen, items will overflow.
- **P2: Timer ring is fixed at `w-64` (256px).** No responsive sizing. On a narrow phone this takes up most of the width with no breathing room.
- **P3: No touch considerations.** Buttons are adequately sized (py-3) but there is no haptic feedback, no swipe gestures for mode switching.
- **Positive:** Tailwind's grid (`grid-cols-2 md:grid-cols-4`) on stats cards does handle narrow screens reasonably.

### 5. Agent Integration (7/10)

**What works:**
- `stats` query returns a rich summary: streak, completion rate, hours since last session, avg sessions/day. An agent can call this single query and get a full picture.
- `todayByUser` is exactly what an agent needs for "did c3z work today?"
- `hoursSinceLastSession` enables the "scold him when he doesn't use it" use case directly.
- Schema has good indexes (`by_user_date`, `by_completed`) for efficient queries.

**What does not work:**
- **P2: No dedicated agent query.** There is no `agentSummary` or `usageReport` query that returns a pre-formatted text summary. The agent has to interpret raw numbers. A query returning "c3z completed 3/5 pomodoros today, streak is 2 days, last session 4.2 hours ago" as a string would be immediately useful.
- **P3: No webhook or push notification.** Agent cannot subscribe to events (session completed, streak broken). Polling is the only option.
- **P3: Break sessions are tracked but not surfaced in stats.** Stats filter to `type === "work"` only. An agent might want to know if breaks are being taken properly.

---

## Issue Summary

### P1 (Must fix)

| # | Issue | Component |
|---|-------|-----------|
| 1 | Audio notification is broken (truncated base64 WAV) | `Timer.tsx:82-87` |
| 2 | No browser Notification API -- timer completion is invisible when tab is backgrounded | `Timer.tsx` |
| 3 | No PWA manifest -- cannot install on mobile home screen | Project root |

### P2 (Should fix)

| # | Issue | Component |
|---|-------|-----------|
| 4 | No tab title countdown during active timer | `Timer.tsx` |
| 5 | No keyboard shortcuts (Space = start/pause, R = reset) | `Timer.tsx` |
| 6 | History is a flat list with no date grouping or filtering | `history.tsx`, `SessionList.tsx` |
| 7 | Notes/tags cannot be added from UI despite backend support | `timer.tsx`, `Timer.tsx` |
| 8 | Nav breaks on narrow mobile screens (no responsive menu) | `layout.tsx` |
| 9 | Timer ring not responsive (fixed w-64) | `Timer.tsx` |
| 10 | No agent-friendly summary query returning formatted text | `sessions.ts` |

### P3 (Nice to have)

| # | Issue | Component |
|---|-------|-----------|
| 11 | Timer state lost on page navigation | `Timer.tsx` (state architecture) |
| 12 | Resume button label may not update (ref read during render) | `Timer.tsx:203` |
| 13 | Stats period hardcoded to 7d in frontend | `home.tsx` |
| 14 | No streak encouragement or daily goal UI | `home.tsx` |
| 15 | Break session stats not surfaced | `sessions.ts` |

---

## Verdict

The foundation is solid -- clean architecture, good color system, well-structured Convex backend with proper indexes. The stats design shows thoughtful consideration of what matters (streak, completion rate, time since last session).

But as a daily-use tool it has two fatal gaps: the timer is silent and invisible when backgrounded (P1 #1-2), which defeats the core Pomodoro mechanic. And there is no mobile install story (P1 #3), which matters because you want to use this on your phone between meetings.

Fix the three P1s and this goes from a 5.6 to a solid 7. Add keyboard shortcuts, tab title countdown, and date-grouped history, and it becomes genuinely pleasant to use daily.

**Current score: 5.6 / 10**
**P1 count: 3**
**Stop condition met: No** (score < 7.0, P1 > 0)
