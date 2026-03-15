# End-User Review: Agent Pomodoro (Sprint #15)

**Reviewer:** End-user perspective (daily Pomodoro user)
**Date:** 2026-03-15
**Previous Scores:** #1: 5.6, #2: 6.6, #3: 7.3, #5: 7.7, #6: 7.9, #7: 8.2, #8: 8.3, #14: 8.8
**Scope:** Sprint #15 changes -- Agent write-back API (3 POST endpoints), CLI write commands (start/stop/interrupt), 12 new E2E tests (33 total), CLI v0.3.0

---

## Sprint #15 Changes Evaluated

1. **Agent write-back API** -- 3 new POST endpoints on Convex HTTP router: `/api/sessions/start` (accepts type + durationMinutes, returns sessionId, 201), `/api/sessions/complete` (sessionId + optional notes/tags), `/api/sessions/interrupt` (sessionId). Same Bearer API key auth as existing GET endpoints. CORS preflight added for all 7 paths. Input validation: type must be work/break/longBreak, durationMinutes 1-120, JSON body required.

2. **CLI write commands** -- `agent-pomodoro start [work|break|longBreak] [minutes]` creates a session on the server and saves `activeSession` (sessionId, type, startedAt) to `~/.agent-pomodoro.json`. `agent-pomodoro stop [--notes ...] [--tags ...]` completes the tracked session, reports elapsed time, clears activeSession. `agent-pomodoro interrupt` cancels the active session. Both `stop`/`complete` and `interrupt`/`cancel` are accepted as aliases. All commands support `--json` for machine-readable output.

3. **Completion flow in UI** -- Work sessions now show a completion modal ("Session complete!") with optional notes textarea (500 char limit), 6 quick tags (deep-work, meetings, code, writing, learning, admin), Save (Cmd+Enter) and Skip (Esc) buttons. Break sessions auto-advance to work mode without modal. 4th work session triggers long break (15:00). Pomodoro counter (dot indicators) tracks progress toward long break.

4. **E2E test coverage** -- 12 new tests in `e2e/timer-completion.spec.ts` covering: modal appearance after 25min, Save/Skip buttons, tag toggling, mode transitions (work->break, break->work, 4th session->longBreak), pomodoro counter increment, Escape and Cmd+Enter keyboard shortcuts, sound/wake lock graceful degradation (no console errors in headless). Total: 33 tests across 4 spec files.

5. **--help-llm update** -- JSON schema updated to v0.3.0 with start/stop/interrupt commands, parameters, response examples, and tips for start+stop workflow.

---

## Overall Score: 9.1 / 10

| # | Category | #1 | #2 | #3 | #5 | #6 | #7 | #8 | #14 | #15 | Delta |
|---|----------|-----|-----|-----|-----|-----|-----|-----|------|------|-------|
| 1 | First Impression | 6 | 7 | 7 | 7.5 | 7.5 | 8 | 8 | 8.5 | 8.5 | 0 |
| 2 | Timer UX | 5 | 8 | 8.5 | 9 | 9.5 | 9.5 | 9.5 | 9.5 | 9.5 | 0 |
| 3 | Data Visibility | 6 | 6 | 7 | 7.5 | 8 | 8.5 | 8.5 | 8.5 | 9.0 | +0.5 |
| 4 | Mobile Usability | 4 | 5 | 7 | 7 | 7 | 7 | 7.5 | 9.0 | 9.0 | 0 |
| 5 | Agent Integration | 7 | 7 | 7 | 7.5 | 7.5 | 8 | 8 | 8.5 | 9.5 | +1.0 |

**Average: (8.5 + 9.5 + 9.0 + 9.0 + 9.5) / 5 = 9.1**

---

## Category Breakdown

### 1. First Impression: 8.5 (no change)

Sprint #15 is a backend/CLI sprint. No visual changes to the landing page, nav, or overall look-and-feel. The app still opens to a clean dark dashboard with JetBrains Mono typography, four stat cards, today's sessions, and a big red "Start Pomodoro" CTA. Nothing regressed, nothing visually improved.

**Held steady because:** The completion modal (added in this sprint's codebase but integrated into the timer flow) is the only UI addition, and you only see it after completing a 25-minute session -- not on first load.

### 2. Timer UX: 9.5 (no change)

The core timer was already excellent. Sprint #15 adds the completion modal which enhances the post-session flow significantly:

- **Completion modal flow is thoughtful.** Notes textarea with 500-char limit, 6 quick tags as toggle pills, Save (Cmd+Enter) and Skip (Esc). The modal uses `autoFocus` on the textarea so you can immediately start typing. This is the right amount of friction -- enough to capture context, not enough to be annoying.
- **Break sessions skip the modal entirely.** Correct design decision. Nobody wants to annotate a 5-minute break.
- **4th session long break logic works.** The dot counter clearly shows progress toward long break.
- **Keyboard shortcuts still work during modal.** Esc to skip, Cmd+Enter to save. Space/Esc for timer are properly guarded against `<input>` and `<textarea>` elements.

**Why not higher:** The timer still resets on page navigation (noted in backlog). If I accidentally hit Dashboard then come back, my 18-minute session is gone. This is the single biggest UX pain point remaining.

### 3. Data Visibility: 9.0 (+0.5)

The +0.5 bump comes from the completion flow adding notes and tags to sessions. Before Sprint #15, sessions were just timestamped durations. Now:

- **Tags appear in SessionList** as small pills (`text-[10px]` rounded-full badges). Visible at a glance.
- **Notes appear truncated** (`max-w-48 truncate`) next to tags. Good space management.
- **CLI `sessions today` output includes tags** in brackets: `[code, deep-work]`.
- **Stats endpoint unchanged** but data is richer -- notes and tags are persisted and queryable.

**What would push this to 10:** Tag-based filtering (show me only "deep-work" sessions), weekly/monthly summary views, a simple chart or heatmap.

### 4. Mobile Usability: 9.0 (no change)

No PWA changes in Sprint #15 (those landed in #14). The completion modal is responsive (`max-w-md w-full p-4` with fixed inset overlay), so it works on phone. Quick tags are tap-friendly pill buttons. The textarea is usable on mobile keyboards.

**Held because:** The Sprint #14 PWA polish (wake lock, sounds, vibration, manifest, iOS meta tags) is still the most recent mobile-focused work. No regressions observed.

### 5. Agent Integration: 9.5 (+1.0)

This is the headline category for Sprint #15 and the score reflects a major capability jump. Before this sprint, agents could only *read* data. Now they can *control* the user's focus sessions.

**What works well:**

- **Full CRUD lifecycle via CLI.** `agent-pomodoro start work 25` -> do work -> `agent-pomodoro stop --notes "sprint review" --tags "code,writing"` is a clean, memorable workflow. An agent can script this in a Claude Skill or MCP tool with zero friction.
- **Local session tracking is smart.** Storing `activeSession` in `~/.agent-pomodoro.json` means `stop` and `interrupt` don't need a sessionId argument -- the CLI remembers. This is a UX win for both humans and agents.
- **Aliases are thoughtful.** `stop`/`complete` and `interrupt`/`cancel` both work. Agents won't fumble on verb choice.
- **Error messages are clear and actionable.** "No active session. Start one with: agent-pomodoro start" tells you exactly what to do next. Error responses from the API include the specific validation failure.
- **--json on all commands.** Every write command supports `--json` for machine-readable output. Start returns `{ sessionId, type, durationMinutes }`, stop returns `{ ok: true, type, elapsed }`. An agent can parse these without text extraction.
- **--help-llm updated.** The JSON schema at v0.3.0 includes start/stop/interrupt with parameters, response examples, and workflow tips. An LLM reading this schema has everything it needs to use the write API correctly on first try.
- **Convex real-time.** Sessions created via API show up immediately on the phone/browser via Convex subscriptions. Agent starts a session -> phone shows the timer counting. This is the "close the loop" moment.

**What's missing (prevents 10):**

- **No active session query.** There's no `GET /api/sessions/active` endpoint. An agent can check `status` but can't programmatically determine if a session is currently running (the `completed: false, interrupted: false` state). The CLI tracks locally but the API doesn't expose it.
- **No server-side timer.** The API creates a session record but doesn't track elapsed time server-side. If the agent starts a session via CLI and the user doesn't have the browser open, nothing happens when 25 minutes pass -- no notification, no auto-complete. The session stays "active" forever until explicitly stopped.
- **No conflict detection.** Starting a new session while one is already active (via browser) creates a second concurrent session. There's no "already running" guard on `POST /api/sessions/start`.

---

## Findings

### P1 (Must fix before release)

**P1-1: No duplicate session guard.** `POST /api/sessions/start` does not check if there's already an active session (completed=false, interrupted=false) for the user. An agent or user can accidentally create overlapping sessions. The CLI tracks `activeSession` locally, but a second CLI instance, a different agent, or the browser can all start sessions independently. The mutation `sessions.start` should check for existing active sessions and either reject or auto-interrupt the previous one.

**P1-2: CLI `stop` silently fails if session was already completed via browser.** If the user completes the session through the web UI (completion modal -> Save), the CLI still has `activeSession` in its local config. Running `agent-pomodoro stop` will call `POST /api/sessions/complete` on an already-completed session. The `sessions.complete` mutation doesn't check `session.completed` before patching, so it will succeed silently but overwrite the `completedAt` timestamp and potentially the notes/tags. Should reject with "Session already completed."

### P2 (Should fix)

**P2-1: No active session API endpoint.** An agent polling status to decide whether to start a pomodoro has no clean way to check "is there a session running right now?" The `agentSummary` query doesn't mention active sessions. Adding `GET /api/sessions/active` (returns the current running session or null) would complete the read-write loop for agents.

**P2-2: CLI elapsed time is purely local.** `agent-pomodoro stop` reports elapsed time as `Math.round((Date.now() - active.startedAt) / 60000)` using the locally stored `startedAt`. If the machine clock drifted or the CLI was run on a different machine than where `start` was called, elapsed time is wrong. Should use the server-side `startedAt` from the session record (returned by the start endpoint or fetched on stop).

**P2-3: `--notes` and `--tags` parsing is fragile.** The CLI does `args[notesIdx + 1]` which will grab the next argument. If `--notes` is the last argument, `args[notesIdx + 1]` is `undefined`, which gets sent as `notes: undefined` (fine, Convex ignores it). But `--tags` followed by nothing will crash: `undefined.split(",")` throws TypeError. Add a guard: `const tags = tagsIdx >= 0 && args[tagsIdx + 1] ? args[tagsIdx + 1].split(",")... : undefined`.

**P2-4: Sessions complete mutation doesn't validate session state.** `sessions.complete` and `sessions.interrupt` don't check if the session is already completed or interrupted. Both should check `session.completed || session.interrupted` and throw if the session is already finalized.

### P3 (Nice to have)

**P3-1: No `agent-pomodoro active` command.** Would complement the local tracking by also checking server-side. Useful when the agent has context from a previous conversation (different process) and doesn't have the local `~/.agent-pomodoro.json` state.

**P3-2: Start response could include `startedAt` timestamp.** The `POST /api/sessions/start` response returns `{ sessionId, type, durationMinutes }` but not `startedAt`. The CLI stores `Date.now()` locally, but the actual server timestamp may differ slightly. Including it in the response would be more correct.

**P3-3: No `--duration` flag alias for start.** `agent-pomodoro start work 25` works but `agent-pomodoro start work --duration 25` doesn't. Both should work for agent ergonomics (LLMs often prefer named flags).

**P3-4: Config file permissions are good but no warning on existing insecure files.** `saveConfig` uses `mode: 0o600` when writing, but if the file already exists with looser permissions (e.g., 0o644 from a manual edit), it doesn't fix or warn about the existing permissions.

**P3-5: E2E tests don't cover the completion flow with actual Convex persistence.** All 12 new tests run against the timer component in isolation (no backend). The completion modal works in the UI, but the round-trip "start via CLI -> complete via browser -> verify via CLI" isn't tested. Understandable for unit-level E2E, but an integration test would catch P1-2.

---

## Score Trajectory

| Sprint | Score | Delta | Key Driver |
|--------|-------|-------|------------|
| #1 | 5.6 | -- | Bare MVP |
| #2 | 6.6 | +1.0 | Timer polish |
| #3 | 7.3 | +0.7 | Stats + history |
| #5 | 7.7 | +0.4 | Session list |
| #6 | 7.9 | +0.2 | Period selector |
| #7 | 8.2 | +0.3 | Keyboard shortcuts |
| #8 | 8.3 | +0.1 | Tags + notes in list |
| #14 | 8.8 | +0.5 | Sounds + PWA |
| **#15** | **9.1** | **+0.3** | **Agent write-back** |

The +0.3 jump is driven almost entirely by Agent Integration (+1.0 in that subcategory). The app now has a complete agent-controlled focus workflow: start, track, complete with metadata. The P1 findings (duplicate sessions, idempotency) are real issues that would surface in production use, but the core capability is solid and the CLI ergonomics are excellent.

---

## Verdict

Sprint #15 delivers exactly what it promised: agents can now control pomodoro sessions, not just observe them. The CLI workflow (`start` -> `stop --notes --tags`) is clean, the API is well-authenticated and validated, and the `--help-llm` schema makes it trivial for an LLM to discover and use the new commands. The completion modal in the browser UI is a welcome addition that makes sessions more useful (notes + tags = searchable history).

Fix P1-1 (duplicate session guard) and P2-4 (state validation on complete/interrupt) before v1.0. These are the kind of bugs that surface exactly when the feature gets real use -- an agent starts a session while the user already has one running in the browser, and suddenly there are two overlapping sessions with corrupted data.

The app is close to v1.0 readiness. Agent Integration at 9.5 means the core differentiator ("pomodoro app that AI agents can control") is working. Timer UX at 9.5 means the human side is polished. The remaining gap is defensive server-side logic and the persistent backlog item of timer state surviving navigation.
