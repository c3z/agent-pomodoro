# End-User Review: Agent Pomodoro (Sprint #2)

**Reviewer:** End-user perspective (daily Pomodoro user)
**Date:** 2026-03-15
**Previous Score:** 5.6/10 (Sprint #1)
**Scope:** UI/UX, daily usability, mobile readiness, agent queryability

---

## Sprint #2 Changes Evaluated

- Wall-clock timer (replaces setInterval drift)
- visibilitychange handler for background tab recovery
- Real audio notification (Web Audio API two-tone chime)
- Browser Notification API with permission request
- Tab title shows countdown (e.g. `12:34 — FOCUS`)
- Keyboard shortcuts: Space = start/pause, Escape = reset
- Responsive timer ring (`w-48 sm:w-64`)
- Error handling on Convex mutations (offline resilience)
- `isPaused` state for correct Resume/Start label

---

## Subcategory Scores

| # | Category | Sprint #1 | Sprint #2 | Delta | Notes |
|---|----------|-----------|-----------|-------|-------|
| 1 | First Impression | 6 | 7 | +1 | Tab title countdown and keyboard hint at bottom give it a power-tool feel. Still no loading skeleton or onboarding. |
| 2 | Timer UX | 5 | 8 | +3 | All three Sprint #1 P1/P2 timer issues resolved. Wall-clock is correct engineering. Completion flow is solid. |
| 3 | Data Visibility | 6 | 6 | 0 | No changes here. History still flat, notes still inaccessible, stats still 7d-only. |
| 4 | Mobile Usability | 4 | 5 | +1 | Responsive ring helps. Still no PWA, still no responsive nav. |
| 5 | Agent Integration | 7 | 7 | 0 | No changes. Still good foundations, still no agent summary query. |

**Weighted Average: 6.6 / 10** (weights: Timer UX 30%, First Impression 20%, Data Visibility 20%, Mobile 15%, Agent 15%)

---

## Detailed Assessment

### 1. First Impression (7/10)

The keyboard shortcut hint (`Space = start/pause . Esc = reset`) at the bottom of the timer signals "this tool respects your time." The tab title updating to `12:34 — FOCUS` while running makes the app feel alive even when it is not the active tab. The paused state showing a pause icon in the title (`[paused]`) is a nice touch.

**Still missing:**
- Dashboard still flashes from empty defaults to real data on load. No skeleton/shimmer.
- No first-use onboarding or guidance.
- No streak encouragement or motivational element. The "Since Last" card turns red after 24h which is good implicit pressure, but there is no explicit "keep going" moment.

### 2. Timer UX (8/10)

This is where Sprint #2 delivered the most value. Going through the previous P1/P2 issues:

**Sprint #1 P1 #1 (Audio broken) -- FIXED.** The Web Audio API two-tone chime (830Hz + 1046Hz sine waves with gain ramps) is a clean solution. No external audio file dependency, no base64 encoding issues. The `try/catch` wrapper handles browsers that block AudioContext. Sound is pleasant -- rising two-tone, not jarring.

**Sprint #1 P1 #2 (No browser notification) -- FIXED.** Notification API properly implemented: permission requested on first timer start (not on page load, which is correct UX), notifications sent on completion with contextual messages ("Focus session complete!" / "Break is over!"). Falls back gracefully when permission denied.

**Sprint #1 P2 #4 (No tab title countdown) -- FIXED.** Title updates every tick with format `12:34 — FOCUS`. Paused state shows `[paused] 12:34 — FOCUS`. Resets to "Agent Pomodoro" when idle. Cleanup in useEffect return is correct.

**Sprint #1 P2 #5 (No keyboard shortcuts) -- FIXED.** Space toggles start/pause, Escape resets. Input/textarea elements are correctly excluded from shortcut handling. The hint text below the controls teaches the shortcuts without being intrusive.

**Sprint #1 P2 #9 (Timer ring not responsive) -- FIXED.** Ring is now `w-48 sm:w-64`, scaling from 192px to 256px. Reasonable for most viewports.

**Wall-clock timer** is the right architectural decision. `endTimeRef` anchors to `Date.now()` + remaining seconds, and the 250ms interval recalculates from the wall clock each tick. No drift accumulation. The `visibilitychange` handler recalculates when the tab regains focus, so returning after 10 minutes of backgrounding shows the correct remaining time (or triggers completion).

**`isPaused` state** correctly drives the Resume/Start button label. This was a Sprint #1 P3 about ref reads during render -- now properly solved with dedicated state.

**Error handling** on Convex mutations (try/catch with console.warn fallback) means the timer keeps working even if the backend is unreachable. Sessions are logged but timer UX is not blocked by network failures.

**Remaining issues with Timer UX:**
- Timer state is still lost on navigation. Go to Dashboard, come back, timer resets. This is still an architectural gap (component state vs global store), but for a single-page-at-a-time workflow it is tolerable.
- No visual countdown animation when approaching zero (last 10 seconds). The ring just reaches full circle.
- Completion detection logic is convoluted: `completedRef.current` is armed in `start()`, checked in a separate useEffect watching `secondsLeft === 0 && !isRunning`. The inline comment in the wall-clock tick says "handleComplete logic inline" but the actual completion fires in a different effect. This works but is fragile -- a future refactor could easily break the ordering.
- The keyboard shortcut effect has no dependency array (line 227), so it re-registers on every render. Should have `[isRunning]` as dependency. Functionally it works because closures capture current `isRunning`, but it creates/destroys event listeners unnecessarily.

### 3. Data Visibility (6/10)

No changes in Sprint #2. All Sprint #1 issues remain:

- History is a flat list with no date grouping or day separators.
- No date filtering. Cannot view "this week" or "last month."
- Stats hardcoded to 7 days in the frontend.
- Notes/tags cannot be added from the UI despite full backend support (`complete` mutation accepts `notes` and `tags`, `SessionList` renders notes if present -- but no input exists).
- Session list does not show date for sessions older than today, just time (`HH:MM`). In history view with 100 sessions, you cannot tell which day a session belongs to without mental math.

### 4. Mobile Usability (5/10)

The responsive timer ring (`w-48 sm:w-64`) is an improvement. On a 375px iPhone screen the ring now takes a reasonable 192px instead of a cramped 256px.

**Still missing:**
- **No PWA manifest.** Still cannot install to home screen. For a timer app used between meetings on a phone, this remains the single biggest mobile gap.
- **Nav still breaks on narrow screens.** Logo + 3 links + Clerk button in a single flex row. On 320px viewports, items will overflow or cramp. No hamburger menu or bottom nav.
- **No touch gestures.** Swipe to switch modes, long-press for options -- none of this exists. Buttons are adequately sized though (py-3 padding).

### 5. Agent Integration (7/10)

No changes in Sprint #2. The Convex backend remains well-structured for agent queries:
- `stats` query returns streak, completion rate, hours since last session.
- `todayByUser` answers "did c3z work today?"
- `hoursSinceLastSession` enables the scolding use case.

Still missing a dedicated `agentSummary` query returning a pre-formatted text string, and still no webhook/push notification capability.

---

## Issue Summary

### P1 (Must fix)

| # | Issue | Component | Status |
|---|-------|-----------|--------|
| 1 | ~~Audio notification broken~~ | `Timer.tsx` | FIXED in Sprint #2 |
| 2 | ~~No browser notification~~ | `Timer.tsx` | FIXED in Sprint #2 |
| 3 | No PWA manifest -- cannot install on mobile | Project root | **OPEN** |

### P2 (Should fix)

| # | Issue | Component | Status |
|---|-------|-----------|--------|
| 4 | ~~No tab title countdown~~ | `Timer.tsx` | FIXED in Sprint #2 |
| 5 | ~~No keyboard shortcuts~~ | `Timer.tsx` | FIXED in Sprint #2 |
| 6 | History is a flat list, no date grouping or filtering | `history.tsx`, `SessionList.tsx` | OPEN |
| 7 | Notes/tags cannot be added from UI despite backend support | `timer.tsx`, `Timer.tsx` | OPEN |
| 8 | Nav breaks on narrow mobile screens | `layout.tsx` | OPEN |
| 9 | ~~Timer ring not responsive~~ | `Timer.tsx` | FIXED in Sprint #2 |
| 10 | No agent-friendly summary query returning formatted text | `sessions.ts` | OPEN |
| 11 | Session history shows only time, no date -- unusable beyond today | `SessionList.tsx` | NEW |

### P3 (Nice to have)

| # | Issue | Component | Status |
|---|-------|-----------|--------|
| 12 | Timer state lost on page navigation | `Timer.tsx` (architecture) | OPEN |
| 13 | ~~Resume button label incorrect~~ | `Timer.tsx` | FIXED in Sprint #2 (isPaused state) |
| 14 | Stats period hardcoded to 7d in frontend | `home.tsx` | OPEN |
| 15 | No streak encouragement or daily goal UI | `home.tsx` | OPEN |
| 16 | Break session stats not surfaced | `sessions.ts` | OPEN |
| 17 | No loading skeleton on dashboard | `home.tsx` | NEW |
| 18 | Keyboard shortcut effect missing dependency array | `Timer.tsx:227` | NEW |
| 19 | Completion detection logic is fragile (completedRef + multiple effects) | `Timer.tsx:156-187` | NEW |

---

## Sprint #2 Scorecard

| Metric | Value |
|--------|-------|
| Sprint #1 P1s resolved | 2 of 3 |
| Sprint #1 P2s resolved | 3 of 7 |
| New issues found | 4 (1 P2, 3 P3) |
| Remaining P1 count | 1 (PWA manifest) |
| Remaining P2 count | 5 |

---

## Verdict

Sprint #2 addressed exactly the right things. The timer -- the core product -- went from broken to solid. Wall-clock timing, Web Audio chime, browser notifications, tab title countdown, keyboard shortcuts, responsive ring, pause/resume labels -- these are all real improvements that a daily user would notice and appreciate. The error handling on Convex mutations shows mature thinking about offline resilience.

The single remaining P1 is the PWA manifest. For a timer app that lives in a browser tab, mobile installability matters. Everything else is P2/P3.

The biggest untouched gap is data visibility: history is still a flat wall of rows with no dates, no grouping, no filtering. After a week of actual use, this page becomes useless. And notes/tags -- a feature fully built in the backend -- remain inaccessible from the UI. These should be Sprint #3 priorities.

**Previous score: 5.6 / 10**
**Current score: 6.6 / 10**
**P1 count: 1**
**Stop condition met: No** (score < 7.0, P1 > 0)

**To reach stop condition (>= 7.0, P1 = 0):** Fix the PWA manifest (kills last P1) and improve history with date grouping (moves Data Visibility from 6 to 7+). That alone should push the weighted average past 7.0.
