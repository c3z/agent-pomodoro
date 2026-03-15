# End-User Review: Agent Pomodoro (Sprint #14)

**Reviewer:** End-user perspective (daily Pomodoro user)
**Date:** 2026-03-15
**Previous Scores:** #1: 5.6, #2: 6.6, #3: 7.3, #5: 7.7, #6: 7.9, #7: 8.2, #8: 8.3
**Scope:** Sprint #14 changes -- completion sounds (singing bowl + ascending chime), Wake Lock API, Vibration API, PWA manifest polish, iOS meta tags

---

## Sprint #14 Changes Evaluated

1. **Completion sounds** -- Two distinct Web Audio API synthesized sounds. Work session end: singing bowl (396Hz G4 fundamental + 528Hz C5 + 792Hz G5 overtone, double-strike with 3s decay). Break end: ascending chime (E5 -> G5 -> B5 -> E6, 0.8s total). Selected via `playCompletionSound(mode)` which dispatches by mode type.
2. **Vibration API** -- `navigator.vibrate()` called on session completion. Work: `[200, 100, 200]` (double pulse). Break: `[150, 80, 150, 80, 150]` (triple pulse). Guarded by feature detection.
3. **Wake Lock API** -- `navigator.wakeLock.request("screen")` acquired on timer start/resume, released on pause/stop/completion. Re-acquired on `visibilitychange` when tab regains focus (wake locks are automatically released by the browser when a tab is hidden). Sentinel stored in `wakeLockRef`.
4. **PWA manifest polish** -- Added `id: "/"`, `scope: "/"`, `orientation: "portrait"`, `categories: ["productivity", "utilities"]`, maskable icon entry (reuses `icon-512.png`).
5. **iOS meta tags** -- `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`, `apple-mobile-web-app-title: "Pomodoro"` added to `root.tsx` `<head>`.

---

## Overall Score: 8.8 / 10

| # | Category | #1 | #2 | #3 | #5 | #6 | #7 | #8 | #14 | Delta |
|---|----------|-----|-----|-----|-----|-----|-----|-----|------|-------|
| 1 | First Impression | 6 | 7 | 7 | 7.5 | 7.5 | 8 | 8 | 8.5 | +0.5 |
| 2 | Timer UX | 5 | 8 | 8.5 | 9 | 9.5 | 9.5 | 9.5 | 9.5 | 0 |
| 3 | Data Visibility | 6 | 6 | 7 | 7.5 | 8 | 8.5 | 8.5 | 8.5 | 0 |
| 4 | Mobile Usability | 4 | 5 | 7 | 7 | 7 | 7 | 7.5 | 9.0 | +1.5 |
| 5 | Agent Integration | 7 | 7 | 7 | 7.5 | 7.5 | 8 | 8 | 8.5 | +0.5 |

**Average: (8.5 + 9.5 + 8.5 + 9.0 + 8.5) / 5 = 8.8**

---

## Detailed Assessment

### 1. First Impression (8.5/10)

The sound system transforms the feel of the app from "functional timer" to "intentional focus tool." The singing bowl on work completion is a genuinely pleasant surprise -- it feels meditative rather than alarming, which is the right call for a Pomodoro app. The ascending chime for break-end is distinct enough that you won't confuse the two. This is exactly the kind of sensory polish that makes a user think "this was built with care."

The PWA manifest improvements are invisible on first use but pay dividends at the "add to home screen" moment. The maskable icon entry, portrait orientation lock, and proper `scope`/`id` fields mean the install prompt and home screen icon will look correct on both Android and iOS. The iOS meta tags (`apple-mobile-web-app-capable`, `black-translucent` status bar) mean the app launches in standalone mode on iOS with the status bar blending into the dark UI. This is the difference between "a website bookmark" and "an app."

**What moves this from 8.0 to 8.5:**
- Sound gives the timer emotional weight. A silent timer that just resets feels disposable. A timer that chimes when you finish feels like an accomplishment.
- PWA install flow is now credible. A user who adds this to their home screen will get a proper standalone app experience, not a browser tab.

**What still holds this back from 9.0:**
- No first-time user onboarding state. A new user still sees four empty stat cards. The sounds won't help here because the user needs to complete a session before hearing them.
- No splash screen image in the manifest. Android supports a `splash_screen` via manifest icons + background_color, which already works with the current manifest. iOS splash screens require `apple-touch-startup-image` link tags with device-specific sizes, which are not present.

### 2. Timer UX (9.5/10)

The timer itself did not change structurally in Sprint #14. The sound and vibration are triggered at the completion boundary (when `remaining <= 0`), not within the timer interaction flow. Start, pause, resume, reset -- all remain identical.

The sound plays via `playCompletionSound(modeRef.current)` inside the tick effect when remaining hits zero. This is architecturally correct: it fires at the moment the timer expires, even if the tab was backgrounded (the wall-clock check fires on the next 250ms tick after the user returns).

The wake lock is a Timer UX feature that operates invisibly. When it works (Chrome, Edge, Samsung Internet -- anything Chromium), the user's screen stays on during a focus session. This is critical for the "phone on desk" use case: without wake lock, the screen dims and locks, and the user has to unlock to see remaining time. With wake lock, the timer stays visible. This is a significant usability improvement that the user will never consciously notice -- they'll just stop being annoyed that their screen turned off.

**The 9.5 holds because:**
- Sound adds satisfying feedback without changing any interaction flow.
- Wake lock removes a friction point (screen dimming) without requiring any user action.
- The core timer mechanics (wall-clock anchoring, keyboard shortcuts, progress ring, completion modal) remain strong.

**What would push to 10.0:**
- Timer state persistence on navigation (P3 #12). Still the biggest remaining gap.
- Visual urgency in final 30 seconds.
- Configurable timer durations.

### 3. Data Visibility (8.5/10)

No changes to data visibility in Sprint #14. The dashboard stats, session list, and history view are untouched. The sounds and wake lock are timer-side features that don't affect how data is presented.

**Outstanding issues unchanged:**
- Notes truncated at `max-w-48` with no expand mechanism (P2 #30).
- Tags are not clickable filters in history (P2 #31).
- `avgSessionsPerDay` computed but not displayed (P2 #36).

**Holds at 8.5.**

### 4. Mobile Usability (9.0/10)

This is the category where Sprint #14 delivers the most impact. The combination of three features -- wake lock, vibration, and PWA manifest polish -- directly addresses the phone use case.

**Wake Lock on mobile:** This is a game-changer for the "phone propped on desk" workflow. Before Sprint #14, a 25-minute focus session on a phone meant: start timer -> screen dims after 30s-2min (device setting) -> screen locks -> phone is useless as a timer display. The user's options were: (a) disable screen timeout globally in Settings (annoying, forgets to re-enable), or (b) keep tapping the screen every minute (defeats the purpose). Now the screen stays on automatically during an active timer and releases when the timer is paused, stopped, or completed. This is correct behavior.

The implementation handles the edge cases:
- **Tab hidden:** Wake lock is automatically released by the browser when a tab is hidden. The `visibilitychange` handler re-acquires it when the tab regains focus. This prevents the wake lock from persisting across app switches.
- **Pause/stop:** `releaseWakeLock()` is called in both `pause()` and `stop()` functions. No battery drain during paused state.
- **Completion:** Wake lock released in the tick effect when remaining hits zero. Clean.
- **Error handling:** Both `requestWakeLock` and `releaseWakeLock` silently swallow errors. This is correct -- wake lock is a progressive enhancement; failure should be invisible.

**Vibration:** Distinct patterns for work vs break completion. Work: double pulse (200-100-200ms). Break: triple pulse (150-80-150-80-150ms). This is a thoughtful touch -- when the phone is in a pocket or face-down, vibration is the primary notification channel. Different patterns let the user distinguish "focus done, take a break" from "break over, time to work" by feel alone.

**PWA manifest:**
- `id: "/"` -- Required for Chrome to consider this a unique PWA identity. Without it, Chrome uses `start_url` as the identifier, which can cause issues with updates.
- `scope: "/"` -- Defines the navigation scope for standalone mode. Pages outside this scope open in a browser tab. Correct for this app since all routes are under `/`.
- `orientation: "portrait"` -- Locks the PWA to portrait when installed. Right call for a timer app.
- `categories: ["productivity", "utilities"]` -- Used by app stores and PWA catalogs. Minimal effort, correct classification.
- Maskable icon: `icon-512.png` is reused with `"purpose": "maskable"`. This works but is not ideal (see P2 finding below).

**iOS meta tags:**
- `apple-mobile-web-app-capable: yes` -- Enables standalone mode on iOS Safari. Without this, "Add to Home Screen" opens a regular Safari tab with browser chrome. With it, the app opens in a standalone window. This is the single most important iOS PWA tag.
- `apple-mobile-web-app-status-bar-style: black-translucent` -- Status bar overlays the app content with a transparent background. This lets the dark `#0f172a` background color show through the status bar area, creating a seamless look. The alternative (`default` = white bar, `black` = black opaque bar) would create a jarring contrast.
- `apple-mobile-web-app-title: "Pomodoro"` -- The label under the home screen icon. Shorter than "Agent Pomodoro" which would truncate on narrow icon grids.

**What moves this from 7.5 to 9.0:**
- Wake lock solves the #1 mobile pain point (screen dimming during active session).
- Vibration provides tactile feedback when the phone is pocketed or face-down.
- PWA manifest + iOS tags make the install experience credible. The app now behaves like a native app when added to the home screen.
- These three features together transform the mobile experience from "a website you visit" to "an app you install and use daily."

**What still holds this back from 9.5+:**
- No iOS splash screen (`apple-touch-startup-image`). On iOS, PWA launch shows a white/blank screen for 1-2 seconds before the app renders. A splash image would show the app icon/name during this delay.
- Session list rows still use a single-line flex layout that crowds on narrow screens (P3 #41).
- Period selector tap targets remain at ~28px height, below the 44px iOS guideline (P3 #39).
- The maskable icon reuses `icon-512.png` without verifying it has the required safe zone (inset 10% from edges). If the icon has content near the edges, it will be clipped when displayed in a circle or rounded-square frame.

### 5. Agent Integration (8.5/10)

Sprint #14 does not add new agent-facing endpoints or CLI features. However, the PWA improvements indirectly benefit agent integration by making it more likely that the user actually uses the app on their phone daily. An agent that can query usage data is only useful if there IS usage data to query.

The wake lock + vibration + PWA install flow create a feedback loop: user installs PWA on phone -> phone becomes the primary timer -> more sessions logged -> agent has richer data to analyze and act on. This is indirect but meaningful.

The REST API (`/api/status`, `/api/stats`, `/api/sessions/today`, `/api/sessions`) and the CLI tool (`agent-pomodoro status/stats/sessions`) are unchanged and continue to work. The `agentSummary` query still provides a clean text summary for LLM consumption.

**What moves this from 8.0 to 8.5:**
- PWA-as-daily-driver increases data volume, which makes agent queries more useful. The agent can now expect the user to actually have sessions to report on, because the phone app is genuinely usable.
- Completion sounds + vibration reduce the chance of a user forgetting about a running timer and producing an interrupted/ghost session. Cleaner data for the agent.

**What still limits this category:**
- No agent write-back (Sprint #15 scope). The agent can read but not start/stop sessions.
- `agentSummary` still hardcoded to 7 days (P3 #40).
- `agentSummary` does not include tag breakdown (P3 #26).
- Stats API caps `sinceDaysAgo` at 365 (`http.ts:98` has `Math.min(days, 365)`) while the frontend uses 3650. Not a bug today but a silent data discrepancy if the agent and frontend query different time windows.

---

## Findings

### P1 (Must fix)

None.

**Active P1 count: 0**

### P2 (Should fix)

| # | Issue | Component | Status |
|---|-------|-----------|--------|
| 20 | Notification icon uses `/favicon.ico` instead of PWA icon | `Timer.tsx:110` | OPEN |
| 30 | Notes truncated with no expand mechanism | `SessionList.tsx:126` | OPEN |
| 31 | No tag filtering in history | `history.tsx`, `sessions.ts` | OPEN |
| 35 | Retry queue only enqueues `start`, not `complete`/`interrupt` | `timer.tsx` | OPEN -- **see note below** |
| 36 | `avgSessionsPerDay` computed but not displayed | `Stats.tsx`, `sessions.ts` | OPEN |
| 37 | No retry queue size limit or TTL | `retryQueue.ts` | OPEN |
| 42 | **Maskable icon reuses `icon-512.png` without safe zone verification** -- PWA maskable icons require content to be within the inner 80% circle (10% inset from each edge). If `icon-512.png` has the tomato icon near the edges, it will be clipped on Android adaptive icons. A dedicated maskable variant with extra padding should be provided, or the existing icon should be validated against the maskable icon spec. | `manifest.json:27` | **NEW** |
| 43 | **AudioContext may fail silently on iOS Safari first interaction** -- `getAudioContext()` creates the AudioContext lazily and resumes if suspended. However, iOS Safari requires the AudioContext to be created AND resumed inside a user gesture handler. The current code creates the AudioContext inside `playWorkCompleteSound()`/`playBreakEndSound()`, which are called from the timer tick effect -- NOT from a user gesture. If no prior user interaction has created/resumed the AudioContext (e.g., the user started the timer, walked away, and the timer completed while the tab was in the foreground), the sound may not play on iOS. Mitigation: create and resume the AudioContext inside the `start()` function (which IS a user gesture handler) to ensure iOS unlocks audio playback. | `Timer.tsx:31-38, 62-88` | **NEW** |

**Note on P2 #35:** Sprint #14's `timer.tsx` (the route) now correctly enqueues `complete` and `interrupt` mutations in the retry queue. Looking at the current code (lines 75-80, 88-91), both `completeSession` and `interruptSession` failures are caught and enqueued. This P2 appears to have been resolved at some point between Sprint #8 and Sprint #14. **Status: RESOLVED.**

### P3 (Nice to have)

| # | Issue | Component | Status |
|---|-------|-----------|--------|
| 12 | Timer state lost on page navigation | `Timer.tsx` (architecture) | OPEN |
| 15 | No streak encouragement or daily goal UI | `home.tsx` | OPEN |
| 16 | Break session stats not surfaced | `sessions.ts` | OPEN |
| 23 | ~~manifest theme_color differs from meta theme-color~~ | `root.tsx`, `manifest.json` | **RESOLVED** -- manifest now uses `#e74c3c` (pomored) for `theme_color` and `root.tsx` uses `#0f172a` for `<meta name="theme-color">`. These are intentionally different: `theme_color` in the manifest controls the title bar color in standalone mode (should match the brand accent), while the `<meta>` controls the browser chrome color (should match the page background). This is actually correct. |
| 26 | `agentSummary` does not include tag breakdown | `sessions.ts` | OPEN |
| 32 | Completion modal not dismissable by backdrop click | `Timer.tsx:501` | OPEN |
| 33 | No visual urgency at timer end (last 30s) | `Timer.tsx` | OPEN |
| 38 | No first-time user onboarding state | `home.tsx` | OPEN |
| 39 | Period selector tap targets below 44px iOS guideline | `home.tsx:43` | OPEN |
| 40 | `agentSummary` hardcoded to 7d | `sessions.ts` | OPEN |
| 41 | Session list rows overflow on narrow mobile | `SessionList.tsx:90` | OPEN |
| 44 | **No iOS splash screen** -- iOS PWAs show a blank white/black screen for 1-2s on launch. Adding `apple-touch-startup-image` link tags (device-specific sizes) would show a branded splash. Low priority since the app loads fast, but noticeable on slow connections. | `root.tsx` | **NEW** |
| 45 | **No user-facing sound/vibration settings** -- Sounds and vibration are always on with no way to disable or adjust volume. Users in shared workspaces or meetings may want to mute completion sounds without muting their entire device. A simple toggle in Settings (persisted to localStorage) would handle this. | `Timer.tsx` | **NEW** |
| 46 | **Wake Lock not indicated in UI** -- When wake lock is active, there is no visual indicator. Users have no way to know whether the screen is staying on because of the app or because of their device settings. A small lock icon or "screen on" badge near the timer would provide confidence. Low priority since the feature is working invisibly by design. | `Timer.tsx` | **NEW** |
| 47 | **Stats API caps `sinceDaysAgo` at 365 but frontend sends 3650** -- `http.ts:98` clamps the API parameter to `Math.min(days, 365)`. The frontend `stats` query goes through Convex directly (not the HTTP API) so the cap doesn't affect the web app, but an agent calling `GET /api/stats?days=3650` would silently get 365-day data. The Convex query also caps at 365 (`sessions.ts:120`). This means neither the agent nor the frontend can actually get 3650 days of stats -- the Convex query itself caps at 365. The frontend workaround of sending 3650 is a no-op beyond 365 days. | `sessions.ts:120`, `http.ts:98` | **NEW** |

---

## What Moved the Needle This Sprint

**Sprint #14 is the most impactful mobile sprint to date.** The score jumps from 8.3 to 8.8 -- the largest single-sprint increase since Sprint #2. The +1.5 jump in Mobile Usability (7.5 -> 9.0) is the primary driver, with +0.5 contributions from First Impression and Agent Integration.

The three features -- sounds, wake lock, vibration -- are individually small but collectively transformative. They address the physical reality of using a timer on a phone:

1. **Screen stays on** (wake lock) -- so you can see the timer without touching the phone.
2. **You hear when it's done** (sounds) -- so you don't have to watch the last 30 seconds.
3. **You feel when it's done** (vibration) -- so it works even when the phone is face-down.

This is the "phone on desk during a focus session" workflow, fully supported. Before Sprint #14, the app was a timer you had to actively monitor. Now it's a timer that tells you when to act.

The sound design is notably good. The singing bowl for work completion is warm and non-intrusive -- it doesn't startle you out of flow state, it gently signals that flow state has reached its natural end. The ascending chime for break-end is brighter and more energetic, matching the "time to get back to work" energy. Having two distinct sounds means you can tell which transition happened without looking at the screen. This is the kind of design decision that separates a personal tool from a professional one.

The PWA manifest and iOS meta tags are invisible to the "use in browser" workflow but essential for the "install on phone" workflow. With `id`, `scope`, `orientation`, `categories`, `maskable` icon, and iOS standalone mode, the app now passes the baseline requirements for a credible PWA install on both Android and iOS. The `black-translucent` status bar choice shows attention to the dark-theme aesthetic.

**One concern:** The iOS AudioContext issue (P2 #43) could mean that sounds don't play on iOS Safari when the timer completes in the foreground without recent user interaction. This is a known iOS restriction and should be tested on a real device. The fix is straightforward (create/resume AudioContext in the `start()` handler), but if it's not addressed, iPhone users -- arguably the primary PWA target -- may never hear the sounds.

---

## What's Still Missing for 9.0+

### 1. iOS AudioContext fix (P2 #43)
Sounds are the headline feature of this sprint. If they don't play on iOS, 30-50% of mobile users get a degraded experience. Fix the AudioContext creation to happen inside a user gesture handler.

### 2. Timer state persistence on navigation (P3 #12)
Still the most impactful single UX issue. The app is now good enough to be someone's daily driver on their phone. Daily drivers get navigated -- a user will start a timer, check history mid-session, and lose their timer. This is more urgent now that the mobile experience is genuinely good.

### 3. Sound/vibration toggle (P3 #45)
Now that sounds exist, users need a way to mute them without muting their device. A boolean in localStorage + a speaker icon on the timer page would suffice.

### 4. Notes expand + tag filtering (P2 #30, #31)
The data investment (notes, tags on every session) still doesn't pay off on the read side. More important now that the app will generate more sessions (because it's a better mobile experience).

**Priority path to 9.0:** iOS AudioContext fix (#43) + timer state persistence (#12) + sound toggle (#45).
**Path to 9.5:** + notes expand (#30) + tag filtering (#31) + first-time onboarding (#38).

---

## Sprint #14 Scorecard

| Metric | Value |
|--------|-------|
| Sprint #8 P2s resolved | 1 of 7 (#35 retry queue -- verified fixed) |
| Sprint #8 P3s resolved | 1 of 11 (#23 theme_color -- re-evaluated as correct) |
| New features delivered | 3 (sounds, wake lock, vibration + PWA polish) |
| New issues found | 6 (P2: #42, #43. P3: #44, #45, #46, #47) |
| Active P1 count | **0** |
| Active P2 count | 7 |
| Active P3 count | 14 |

---

## Verdict

Sprint #14 delivers the first genuinely phone-ready experience. The app was already a good browser-based timer (8.3). Now it's a good phone app (8.8). The gap between "website you visit" and "app you install" has been closed by sounds that feel right, a screen that stays on, vibration that works in your pocket, and a manifest that makes the install prompt credible.

The score trajectory: 5.6 -> 6.6 -> 7.3 -> 7.7 -> 7.9 -> 8.2 -> 8.3 -> **8.8**. The +0.5 delta is the largest since the Sprint #2 timer overhaul, driven almost entirely by Mobile Usability. The app has crossed the threshold where I'd actually install it on my phone and use it daily, which is the bar for a Pomodoro app.

The main risk is the iOS AudioContext issue (P2 #43). If sounds don't play on iPhone, the headline feature of this sprint is broken for a significant user segment. This should be verified on a real iOS device before considering the sprint fully landed.

**Previous score: 8.3 / 10**
**Current score: 8.8 / 10**
**P1 count: 0**

**Path to 9.0:** iOS AudioContext fix + timer state persistence + sound toggle.
**Path to 9.5:** + notes expand + tag filtering + first-time onboarding.
