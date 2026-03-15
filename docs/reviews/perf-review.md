# Performance Review — Agent Pomodoro (Sprint #15)

**Reviewer:** Performance
**Date:** 2026-03-15
**Previous scores:** S1: 5.4, S2: 6.6, S3: 7.2, S5: 7.2, S6: 7.6, S7: 7.8, S8: 8.2, S14: 8.4
**Files reviewed:** `convex/http.ts`, `packages/apom/bin/apom.mjs`, `app/components/Timer.tsx`, `app/lib/sounds.ts`, `public/sw.js`, `vite.config.ts`, `package.json`, `convex/sessions.ts`, `convex/apiKeys.ts`, `convex/schema.ts`, `app/routes/timer.tsx`, `app/lib/retryQueue.ts`, `e2e/timer-completion.spec.ts`

---

## Sprint #15 Changes Evaluated

1. **3 POST endpoints** (`convex/http.ts`) — `/api/sessions/start`, `/api/sessions/complete`, `/api/sessions/interrupt`. Each is an `httpAction` that authenticates via API key hash lookup, validates the JSON body, then delegates to the existing Convex mutation (`sessions.start`, `sessions.complete`, `sessions.interrupt`).

2. **CLI `apiPost()` function** (`packages/apom/bin/apom.mjs`) — New HTTP POST helper mirroring the existing `apiCall()` GET helper. Used by three new CLI commands: `start`, `stop`, `interrupt`. Local session tracking via `~/.agent-pomodoro.json`.

3. **12 new E2E tests** (`e2e/timer-completion.spec.ts`) — Timer completion flow using Playwright `page.clock.install()` and `page.clock.fastForward()`. Covers work completion modal, tag toggling, Skip/Save, break auto-advance, long break cycle, keyboard shortcuts (Escape, Cmd+Enter), and graceful degradation of sound/wake lock in headless.

4. **No frontend changes** — `Timer.tsx` and `sounds.ts` unchanged from Sprint #14.

---

## Scores

| # | Subcategory | Score | Prev (S14) | Delta | Notes |
|---|-------------|-------|------------|-------|-------|
| 1 | Timer Accuracy | 8/10 | 8 | 0 | No timer changes. POST endpoints don't affect frontend clock. |
| 2 | Initial Load | 8/10 | 8 | 0 | Zero new frontend deps. POST endpoints are server-side only. |
| 3 | Bundle Size | 9/10 | 9 | 0 | No new client code. CLI is a separate package. |
| 4 | State Management | 9/10 | 8 | +1 | P2-PERF-26 resolved (wake lock unmount cleanup). P2-PERF-25 partially resolved (await in sound functions). |
| 5 | Offline Capability | 9/10 | 9 | 0 | Retry queue already covers mutations. SW unchanged. |

**Overall: 8.6 / 10** (prev 8.4, delta +0.2)

---

## 1. Timer Accuracy — 8/10 (unchanged)

Sprint #15 adds no changes to the frontend timer. The wall-clock anchor pattern (`endTimeRef`, 250ms polling, `Math.ceil`) remains correct. The POST endpoints execute entirely on the Convex server and do not interact with the browser timer.

The new E2E tests in `timer-completion.spec.ts` validate the timer completion flow using Playwright's clock mocking — `page.clock.install()` freezes the system clock, then `page.clock.fastForward("25:00")` advances it. This is a solid approach that avoids real-time waits and validates the wall-clock anchor pattern end-to-end. The tests correctly verify that the completion modal appears, mode transitions work, and the pomodoro counter increments.

### P3-PERF-14: 250ms tick interval (unchanged, OPEN)
Still 4 state updates per second. Not a regression.

---

## 2. Initial Load — 8/10 (unchanged)

Sprint #15 adds zero client-side code to the main bundle. The three POST endpoints live in `convex/http.ts` (server-only). The CLI changes are in `packages/apom/bin/apom.mjs` (a separate npm package, not bundled with the web app). The E2E tests run in Playwright, not in the browser.

No new network requests, no new imports, no new lazy chunks.

### P3-PERF-03: Font loading — external, not SW-cached (unchanged, OPEN)
### P3-PERF-20: JetBrains Mono preload redundant (unchanged, OPEN)

---

## 3. Bundle Size — 9/10 (unchanged)

The Sprint #15 changes are entirely server-side and CLI-side. The web app's production bundle is byte-identical to Sprint #14.

### P3-PERF-04: Clerk could be lazy-loaded (~80kB savings) (unchanged, OPEN)

---

## 4. State Management — 9/10 (improved from 8)

Two Sprint #14 P2 issues have been addressed:

**P2-PERF-26 (RESOLVED):** Wake lock unmount cleanup is now present at line 84 of `Timer.tsx`:
```typescript
useEffect(() => () => releaseWakeLock(), []);
```
This correctly releases the wake lock when navigating away from `/timer`, preventing indefinite screen-on in the SPA.

**P2-PERF-25 (PARTIALLY RESOLVED):** The `await ctx.resume()` is now correctly used inside `playWorkCompleteSound()` and `playBreakEndSound()` in `sounds.ts` (lines 37, 51). However, `playCompletionSound()` (line 60-65) calls these async functions without `await`:
```typescript
export function playCompletionSound(mode: TimerMode) {
  if (mode === "work") {
    playWorkCompleteSound(); // no await
  } else {
    playBreakEndSound();     // no await
  }
```
The `await` inside the functions means the `resume()` resolves before `makeNote()` runs, which is the important fix. The caller not awaiting the outer promise is acceptable — the timer completion logic should not block on sound playback. Downgrading to P3.

### P3-PERF-13: SVG progress ring transition overlap (unchanged, OPEN)
### P3-PERF-17: Completion modal re-renders entire Timer (unchanged, OPEN)

---

## 5. Offline Capability — 9/10 (unchanged)

The retry queue in `app/lib/retryQueue.ts` already covers `start`, `complete`, and `interrupt` mutations (as implemented in Sprint #7/8). When the frontend calls these mutations and they fail (offline), they are enqueued to `localStorage` and flushed when the browser comes back online.

The new POST endpoints are for agent/CLI access, not browser access. The CLI (`apom.mjs`) does not have offline retry — if `fetch()` fails, it exits with an error. This is appropriate for a CLI tool: the agent can simply retry the command.

The service worker correctly skips cross-origin requests (line 29 of `sw.js`), so it will not interfere with the Convex HTTP endpoints.

---

## New Issues

### P2-PERF-30 (NEW): POST endpoints perform SHA-256 hash + DB query per request (auth overhead)

**Location:** `convex/http.ts`, `authenticateRequest()` (lines 35-62)

Every POST request to the session management endpoints performs:
1. `crypto.subtle.digest("SHA-256", ...)` — hash the API key
2. `ctx.runQuery(internal.apiKeys.validateByHash, { keyHash })` — DB index lookup
3. `ctx.runMutation(internal.apiKeys.touchLastUsed, { keyId })` — fire-and-forget write

This is the same authentication flow as the GET endpoints (introduced in Sprint #9), but the GET endpoints are read-only and called infrequently (agent checks a few times per day). The POST endpoints will be called in tighter loops — `start` at the beginning of a session, `complete`/`interrupt` at the end. In a CLI workflow like `agent-pomodoro start work 25 && sleep 1500 && agent-pomodoro stop`, this is still two requests 25 minutes apart, so the overhead is negligible in practice.

However, the `touchLastUsed` fire-and-forget mutation (line 59) runs on every single request, including the POST endpoints. This means every `start`/`complete`/`interrupt` call generates a secondary write mutation just to update `lastUsedAt`. For a pomodoro app with ~20 sessions/day, this doubles the write count to ~40 mutations/day (20 session mutations + 20 `touchLastUsed`). Convex free tier allows 1M function calls/month, so this is well within budget, but it is architecturally wasteful.

Consider debouncing `touchLastUsed` — e.g., only touch if `lastUsedAt` is more than 1 hour old. This would reduce the secondary writes from 20/day to 1-2/day.

**Severity: P2** — No real-world performance problem today, but it doubles mutation count per API request. At scale (multiple agents, frequent polling), this becomes a cost concern on Convex's metered billing.

### P2-PERF-31 (NEW): POST endpoint input validation gaps — no length limits on notes/tags

**Location:** `convex/http.ts`, lines 139-237 and `convex/sessions.ts`, lines 37-56

The `/api/sessions/start` endpoint validates `type` (must be one of 3 values) and `durationMinutes` (1-120 range). Good.

The `/api/sessions/complete` endpoint validates `sessionId` (required), but passes `body.notes` and `body.tags` directly to the Convex mutation without any length or type validation:

```typescript
await ctx.runMutation(api.sessions.complete, {
  sessionId: body.sessionId,
  userId: auth.userId,
  notes: body.notes,   // unbounded string
  tags: body.tags,      // unbounded array of unbounded strings
});
```

The Convex schema (`v.optional(v.string())` for notes, `v.optional(v.array(v.string()))` for tags) provides type validation but no length limits. An authenticated agent could send:
- `notes`: a 10MB string
- `tags`: an array of 100,000 strings

Convex has its own document size limits (~1MB per document), so this won't crash the database, but it will waste bandwidth and processing time. The frontend `Timer.tsx` already limits notes to 500 characters (`maxLength={500}`) and tags to the 6 `QUICK_TAGS` options, but the API bypasses these UI constraints.

Fix: Add validation in the HTTP handler before calling the mutation:
```typescript
if (body.notes && (typeof body.notes !== "string" || body.notes.length > 1000)) {
  return jsonResponse({ error: "notes must be a string, max 1000 chars" }, 400);
}
if (body.tags && (!Array.isArray(body.tags) || body.tags.length > 10 || body.tags.some(t => typeof t !== "string" || t.length > 50))) {
  return jsonResponse({ error: "tags must be an array of up to 10 strings, each max 50 chars" }, 400);
}
```

**Severity: P2** — An authenticated agent can write oversized data to the database. The API key requirement limits the blast radius (only the key owner's data is affected), but it's still unbounded input flowing into persistent storage.

### P2-PERF-32 (NEW): No idempotency protection on `/api/sessions/start`

**Location:** `convex/http.ts`, lines 139-172 and `convex/sessions.ts`, lines 11-35

The `sessions.start` mutation unconditionally inserts a new document. If the CLI sends the same `start` request twice (network retry, agent retry, double-click in a script), two session documents are created. The CLI stores `activeSession` locally (line 188-196 of `apom.mjs`), but:
1. If the first request succeeds but the response is lost (network timeout), the CLI retries and creates a duplicate.
2. If two agents use the same API key and both call `start`, two overlapping sessions are created.

For a pomodoro app this is low-severity — the user can see duplicate sessions and manually clean up. But for agent reliability (the core use case of Sprint #15), duplicate sessions create confusion in stats and summaries.

Mitigation options:
- Add a `clientRequestId` field to the POST body; `sessions.start` checks for an existing session with the same `clientRequestId` and returns the existing ID.
- Check for an already-active (not completed, not interrupted) session for the same user before inserting; return a 409 Conflict if one exists.

**Severity: P2** — Duplicate sessions corrupt statistics. For an agent that automates start/stop, network retries are common. The fix is straightforward (active session check).

### P3-PERF-33 (NEW): CLI `apiPost()` duplicates error handling from `apiCall()`

**Location:** `packages/apom/bin/apom.mjs`, lines 51-100

The `apiPost()` function (lines 74-100) is a near-copy of `apiCall()` (lines 51-72), differing only in the `method` and `body`/`Content-Type` header. The error handling block (lines 88-96 vs 60-68) is identical. This is a maintenance risk — if the error format changes, both functions need updating.

Refactor to a single `apiFetch(method, path, data?)` function:
```javascript
async function apiFetch(method, path, data) {
  const apiKey = requireApiKey();
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;
  const headers = { Authorization: `Bearer ${apiKey}` };
  const opts = { method, headers };
  if (data) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(data);
  }
  const res = await fetch(url, opts);
  if (!res.ok) { /* shared error handling */ }
  return res.json();
}
```

**Severity: P3** — Code duplication in a CLI tool. No runtime performance impact.

### P3-PERF-34 (NEW): `playCompletionSound()` does not await async sound functions

**Location:** `app/lib/sounds.ts`, lines 60-65

As noted in the State Management section, `playCompletionSound()` calls `playWorkCompleteSound()` and `playBreakEndSound()` without `await`. Since the inner functions now correctly `await ctx.resume()`, the sound scheduling happens after resume completes — but the Promise returned to the caller is not awaited. The caller in `Timer.tsx` (line 134) also does not await it.

In practice, this works fine because:
1. The `resume()` resolves quickly (~0ms on desktop, ~50ms on mobile).
2. The `makeNote()` calls schedule oscillators at absolute times on the AudioContext timeline, not relative to JavaScript execution.
3. The timer completion logic should not block on sound playback.

Downgraded from P2-PERF-25 to P3 because the critical fix (awaiting `resume()` before scheduling) is now in place. The missing outer `await` is cosmetic.

**Severity: P3** — Replaces P2-PERF-25. The important `await` is in the right place now.

### P3-PERF-35 (NEW): CLI stores API key in plaintext in local config

**Location:** `packages/apom/bin/apom.mjs`, lines 21-22, 274

```javascript
config.apiKey = key;
saveConfig(config);
// File created with mode: 0o600
```

The config file (`~/.agent-pomodoro.json`) is created with `0o600` permissions (owner read/write only), which is good. But the API key is stored in plaintext JSON. If the file is accidentally committed, copied, or read by another process, the key is exposed.

This is standard practice for CLI tools (AWS CLI, GitHub CLI, etc. all store tokens in plaintext config files). The `0o600` permissions are the correct mitigation. Noting for completeness, not recommending a change.

**Severity: P3** — Standard CLI pattern with correct file permissions. No performance impact.

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
| P2-PERF-11 | ~~P2~~ | ~~No retry queue for failed mutations~~ | **RESOLVED** Sprint 7/8 |
| P2-PERF-21 | ~~P2~~ | ~~Complete/interrupt mutations not queued~~ | **RESOLVED** Sprint 8 |
| P3-PERF-22 | ~~P3~~ | ~~Flush race on concurrent online events~~ | **RESOLVED** Sprint 8 |
| P2-PERF-25 | ~~P2~~ | ~~AudioContext `resume()` fire-and-forget~~ | **RESOLVED** Sprint 14/15 (downgraded to P3-PERF-34) |
| P2-PERF-26 | ~~P2~~ | ~~Wake lock not released on unmount~~ | **RESOLVED** Sprint 15 |
| P2-PERF-30 | **P2** | `touchLastUsed` doubles mutation count per API call | **NEW** |
| P2-PERF-31 | **P2** | No length limits on notes/tags in POST endpoints | **NEW** |
| P2-PERF-32 | **P2** | No idempotency protection on `/api/sessions/start` | **NEW** |
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
| P3-PERF-27 | P3 | Maskable icon reuses standard icon — may clip | OPEN |
| P3-PERF-28 | P3 | 5 simultaneous oscillators — budget mobile concern | OPEN |
| P3-PERF-29 | P3 | Empty catch blocks in audio functions | OPEN |
| P3-PERF-33 | P3 | CLI `apiPost()` duplicates error handling from `apiCall()` | **NEW** |
| P3-PERF-34 | P3 | `playCompletionSound()` does not await async sound functions | **NEW** (replaces P2-PERF-25) |
| P3-PERF-35 | P3 | CLI stores API key in plaintext in config | **NEW** (informational) |

**P1 count: 0** | **P2 count: 4** (1 carried, 3 new) | **P3 count: 14** (11 carried, 3 new)

---

## What Moved the Needle

**Two Sprint #14 P2s resolved.** The wake lock unmount cleanup (P2-PERF-26) is now in place at line 84 of `Timer.tsx`. The AudioContext `resume()` fire-and-forget (P2-PERF-25) is fixed — `await ctx.resume()` now executes before note scheduling in both sound functions. These two fixes directly move State Management from 8 to 9.

**POST endpoint architecture is clean.** The three new endpoints follow the exact same pattern as the existing GET endpoints: `authenticateRequest()` -> validate input -> delegate to existing Convex mutation -> return JSON. No new abstractions, no new middleware, no new dependencies. The Convex mutation layer handles the actual write, which means the HTTP action is a thin shell around validated input. This is the correct architecture for Convex — keep the HTTP layer stateless and let the mutation handle consistency.

**E2E timer-completion tests are excellent.** Using Playwright's clock mocking (`page.clock.install()` + `page.clock.fastForward()`) is the right approach for testing a 25-minute timer without waiting 25 minutes. The tests cover the full completion flow: modal appearance, tag toggling, Save/Skip, mode transitions, pomodoro counter, long break cycle, and keyboard shortcuts. The "graceful degradation" tests (no console errors in headless for sound and wake lock) are a smart guard against regressions. These 12 tests close the "Completion flow E2E test" item from the backlog.

**The CLI local session tracking is a pragmatic choice.** Storing `activeSession` in `~/.agent-pomodoro.json` means `stop` and `interrupt` don't need the sessionId as an argument — the CLI remembers it. This makes the agent workflow natural: `agent-pomodoro start work 25` followed by `agent-pomodoro stop --notes "done"`. The alternative (requiring the agent to capture and pass the sessionId) would be error-prone and agent-unfriendly.

---

## What's Missing for 8.8+

### Must-do (to reach 8.8)

1. **Add input length validation for notes and tags in POST endpoints (P2-PERF-31).** The frontend caps notes at 500 chars and limits tags to 6 predefined options. The API should enforce similar limits. This is 5 lines of code in `convex/http.ts`.

2. **Add active session check to `/api/sessions/start` (P2-PERF-32).** Before inserting a new session, check if the user already has an active (not completed, not interrupted) session. Return 409 Conflict with the existing sessionId. This prevents duplicate sessions from network retries and makes the agent workflow idempotent.

### Nice-to-have (to reach 9.0)

3. **Debounce `touchLastUsed` (P2-PERF-30).** Only update `lastUsedAt` if the current value is more than 1 hour old. Halves the mutation count per API call.

4. **Refactor CLI `apiCall`/`apiPost` into single `apiFetch` (P3-PERF-33).** Clean code, zero runtime impact.

5. **Self-host fonts (P3-PERF-03).** Still the biggest P3 for offline experience.

6. **Lazy-load Clerk (P3-PERF-04).** Still ~80kB gz savings.

---

## Verdict

Sprint #15 is a backend-focused sprint that adds write capability to the REST API without touching the frontend. This is the ideal sprint profile for performance — new server-side functionality with zero client-side regression risk.

The POST endpoints are well-structured. Input validation on `/api/sessions/start` is solid (type enum, duration range). The authentication flow reuses the proven `authenticateRequest()` middleware. Error handling returns structured JSON with appropriate HTTP status codes (400 for validation, 401 for auth, 201 for created). The CORS preflight routes are correctly registered for all new paths.

The three new P2 issues are all about hardening write operations — input length limits, idempotency, and mutation efficiency. None of them cause user-visible performance degradation today, but they represent gaps in the "agent writes to the database" trust boundary. Sprint #15's core contribution is enabling agents to write data, so these write-path validations should be prioritized.

The 12 new E2E tests are a significant quality investment. They close the long-standing "Completion flow E2E test" backlog item and establish a pattern for testing time-dependent UI with Playwright's clock API. The graceful degradation tests are a smart regression guard for the audio and wake lock features from Sprint #14.

At 8.6 with zero P1 issues for nine consecutive sprints, the app's performance profile is the strongest it has been. The delta from 8.4 to 8.6 reflects the P2 resolutions from Sprint #14 rather than Sprint #15's new features — which is exactly what you want from a backend-focused sprint: resolve existing frontend issues while adding server capabilities without introducing client-side regressions.
