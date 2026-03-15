# Developer Experience Review — Sprint #15

**Date:** 2026-03-15
**Reviewer:** Developer Experience
**Previous Scores:** Sprint #8: 9.0, Sprint #14: 8.4
**Overall:** 9.0/10

## Scores

| Subcategory | Sprint #14 | Sprint #15 | Delta | Notes |
|-------------|------------|------------|-------|-------|
| CLI Buildability | 9/10 | 9/10 | 0 | Build pipeline unaffected by Sprint #15. Three new POST endpoints in `convex/http.ts` are server-side Convex actions — no impact on `npm run build` or SSR. New CLI commands in `apom.mjs` are zero-dependency Node with no build step. `npm run test` succeeds: 12 new E2E tests use Playwright clock mocking, no real timers, no external dependencies. The `webServer` config in `playwright.config.ts` is unchanged and still works with empty Clerk key for degraded mode. |
| Skill Integration | 8/10 | 9/10 | +1 | `pomodoro-check` skill now has write-path parity with the CLI: an agent can not only query (`status`, `stats`) but also start and stop sessions via `agent-pomodoro start work 25` / `agent-pomodoro stop --notes "sprint done"`. The `--help-llm` JSON schema documents all 7 commands with endpoint mappings, parameters, and usage examples. Version synced to 0.3.0 in both `package.json` and `--help-llm` output (fixing P3 from Sprint #14). However, `pomodoro-check/SKILL.md` and `agent-onboarding/SKILL.md` do not document the new `start`/`stop`/`interrupt` commands — agents using skills as their primary reference would not discover the write API. |
| Code Organization | 9/10 | 9/10 | +1 | Sprint #15 addressed Sprint #14's main regression. Audio code was extracted to `app/lib/sounds.ts` (per CLAUDE.md architecture). `convex/http.ts` grew from ~137 to ~240 lines but maintains clean structure: shared auth/CORS helpers at top, CORS preflight loop for all 7 paths, then one route block per endpoint. The 3 POST handlers follow the same pattern as existing GET handlers (authenticate, parse body, validate, call mutation, respond). No new file-level coupling introduced. `sessions.ts` mutations (`start`, `complete`, `interrupt`) are clean with proper auth verification and input validation. The CLI `apom.mjs` grew from ~300 to ~457 lines with consistent patterns (`apiPost` mirrors `apiCall`, command functions follow identical structure). |
| Test Coverage | 9/10 | 9/10 | +2 | The completion flow E2E gap — recommended since Sprint #5 — is finally closed. 12 new tests in `timer-completion.spec.ts` cover: completion modal appearance after 25min, Save/Skip buttons, tag toggle with class assertion, Skip advances to break (05:00), Save advances to break, pomodoro counter increment, break auto-advances to work (no modal), 4th session triggers long break (15:00), Escape keyboard shortcut skips, Cmd+Enter saves, and 2 sound/wake lock graceful degradation tests (no console errors during work/break completion). Tests use `page.clock.install()` + `page.clock.fastForward()` — no real waits, no flakiness. The `startAndComplete` helper with 500ms tick-then-forward pattern is a smart solution to the frozen-clock-interval problem. Total: 33 tests across 4 spec files. However, the 3 new POST API endpoints have zero E2E coverage — they cannot be tested in Playwright without a running Convex backend, but this gap should be noted. |
| Sprint Autonomy | 9/10 | 9/10 | +1 | CLAUDE.md accurately reflects Sprint #15 state: architecture tree lists `sounds.ts`, `http.ts` description includes POST endpoints, test count updated to 33, `apom.mjs` description includes "start/stop/interrupt". `s.md` has Sprint #15 plan with specific endpoint names and CLI commands. The `--help-llm` version is now correct (0.3.0). An agent starting Sprint #16 can read CLAUDE.md + s.md and know exactly what exists, where to find it, and what the next sprint contains (final polish + v1.0). Minor friction: `s.md` still says "Current Sprint: #14 (completed)" — Sprint #15 is not yet marked as current/completed in `s.md`. |

## Findings

### P1 (Blockers)

None.

### P2 (Should Fix)

1. **Skills not updated with write commands.** `pomodoro-check/SKILL.md` and `agent-onboarding/SKILL.md` only document read commands (`status`, `stats`, `sessions today`, `sessions`). They do not mention `start`, `stop`, or `interrupt`. An agent onboarding via the `agent-onboarding` skill would learn to query data but would not discover that it can start/stop sessions on behalf of the user — which is the core Sprint #15 feature. The `pomodoro-check` skill's "Response patterns" section says "Odpal timer. Teraz." but gives no instructions on how the agent would actually do that. Now it can: `APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro start work 25`. Both skills should be updated.

2. **No idempotency guard on `POST /api/sessions/start`.** An agent retrying a failed network request could create duplicate sessions. The CLI stores `activeSession` locally, but the API has no server-side check for an already-running session. If the CLI crashes between the POST response and `saveConfig()`, the local state is lost and the agent can start a second concurrent session. A server-side check in `sessions.start` that rejects if the user already has a non-completed, non-interrupted session from the last N minutes would prevent this. This is a data integrity concern for agent callers that may retry.

3. **`apiPost` and `apiCall` share 90% identical code.** Both functions in `apom.mjs` do: get API key, build URL, make fetch call, check `res.ok`, parse error body, exit on failure. The only difference is `method: "POST"` and `Content-Type`/`body` fields. This duplication means a future agent fixing error handling must change it in two places. Extract to a shared `apiFetch(method, path, data?)` function.

4. **`cmdStop` does not pass `--json` flag through to error output.** If an agent runs `agent-pomodoro stop --json` but there is no active session, the error is printed via `console.error` as plain text, not as JSON. The `--json` flag on `stop` and `interrupt` only affects success output. Agent callers parsing JSON would get unexpected plain-text on the error path. All commands should return `{"error": "..."}` when `--json` is present.

### P3 (Nice to Have)

1. **`s.md` sprint counter stale.** Shows "Current Sprint: #14 (completed)" but Sprint #15 work is done. Should be updated to reflect Sprint #15 completion with scores and history entry. Carried forward from Sprint #14 review (was P2 then).

2. **No `--sessionId` override on `stop`/`interrupt`.** If local state is corrupted (crashed agent, manual config edit), there is no way to complete/interrupt a specific session by ID. Adding `--session-id <id>` as an optional override would make the CLI more resilient for agent callers that track session IDs independently.

3. **POST endpoint URL design: `/api/sessions/complete` vs `/api/sessions/:id/complete`.** The `s.md` plan specified RESTful paths (`/api/sessions/:id/complete`) but the implementation uses flat paths with `sessionId` in the request body. The body approach works fine — it avoids path parameter parsing in Convex HTTP router (which doesn't support wildcards well) — but the divergence from `s.md` plan creates a documentation mismatch. Either update `s.md` or add a comment in `http.ts` explaining the design decision.

4. **`startedAt` stored as `Date.now()` in config, not ISO string.** `config.activeSession.startedAt` is a Unix timestamp (milliseconds). When an agent runs `agent-pomodoro config show`, the active session is not displayed at all — there is no "active session" section in `config show`. Adding active session display to `config show` would help agents debug state.

5. **`durationMinutes` validation differs between API and CLI.** The API (`http.ts` line 160) allows 1-120 minutes. The CLI (`apom.mjs` line 182) does not validate — `parseInt("999")` would pass through and be rejected by the API, giving a confusing error. Client-side validation matching the server constraint (1-120) would give clearer errors.

6. **HTTP body parsing has `any` type.** `convex/http.ts` lines 147, 188, 220 use `let body: any`. While Convex TypeScript does not require strict typing in HTTP actions, adding a minimal interface (`{ type: string; durationMinutes?: number }`) would help agents understand the expected shape without reading the validation code below.

7. **No automated test for CLI `--help` output accuracy.** As the CLI grows (now 7 commands + config subcommands), the `--help` text and `--help-llm` JSON could drift from actual behavior. A snapshot test or at minimum a smoke test (`node apom.mjs --help` exits 0, `node apom.mjs --help-llm | jq .commands` has expected count) would catch drift.

## Detailed Analysis

### CLI Buildability (9/10, unchanged)

Sprint #15 did not change the build pipeline. The three new Convex HTTP actions in `http.ts` are processed by the Convex compiler (`npx convex dev` / `npx convex deploy`), not by the Vite build. The CLI `apom.mjs` is a standalone script with no build step — it ships as-is via npm.

The 12 new E2E tests use Playwright's `page.clock.install()` API to mock the system clock, allowing them to fast-forward through 25-minute timers in milliseconds. This is the correct approach — no `waitForTimeout(25 * 60 * 1000)` waits that would make CI impractical. The `startAndComplete` helper pattern (click Start, advance 500ms for React state to settle, then fast-forward the full duration) is well-designed to avoid the common pitfall of frozen-clock tests where `setInterval` never fires.

Why not 10: same as Sprint #14 — no CI integration testing with Convex backend. The POST endpoints cannot be verified in CI without a Convex deployment. This remains an accepted gap.

### Skill Integration (9/10, +1 improvement)

Sprint #15 is the most significant skill integration improvement since Sprint #10 (CLI launch). The CLI now has full read-write capability:

**Read path (existing):** `status`, `stats`, `sessions today`, `sessions [limit]`
**Write path (new):** `start [type] [minutes]`, `stop [--notes --tags]`, `interrupt`

The `--help-llm` JSON schema is comprehensive: 7 commands with endpoints, parameters (type, default, enum), usage strings, and response examples. The `tips` array includes the start/stop workflow pattern. An LLM reading this schema has everything needed to drive the full lifecycle.

Active session tracking via `~/.agent-pomodoro.json` is pragmatic — it avoids needing a "get active session" API endpoint. The trade-off (local state can go stale if the web app completes a session the CLI started) is acceptable for v1.

Why not 10: the skill files themselves (`pomodoro-check/SKILL.md`, `agent-onboarding/SKILL.md`) are the primary entry point for agents using Claude Skills. These files do not document write commands. An agent using the `pomodoro-check` skill workflow would need to fall back to `--help` or `--help-llm` to discover write capabilities. Updating the skills is a documentation fix, not an architectural issue, but it is the gap between 9 and 10.

### Code Organization (9/10, +1 improvement)

Sprint #15 resolved the Timer.tsx bloat issue from Sprint #14 by extracting audio code to `app/lib/sounds.ts`. The CLAUDE.md architecture tree now lists `sounds.ts` as a separate module. This was the primary P2 recommendation from the Sprint #14 review.

The new code added in Sprint #15 follows established patterns:

**`convex/http.ts`** (240 lines): The 3 POST handlers are structurally identical to the 4 GET handlers — authenticate, parse input, validate, call Convex function, respond with JSON. The CORS preflight loop at line 67 was correctly extended to include all 7 paths. The `authenticateRequest` helper is reused cleanly by all handlers. Body parsing with try-catch for malformed JSON is consistent across all 3 POST endpoints.

**`packages/apom/bin/apom.mjs`** (457 lines): Three new command functions (`cmdStart`, `cmdStop`, `cmdInterrupt`) follow the same structure as existing commands. The `apiPost` helper mirrors `apiCall`. Command aliases (`stop`/`complete`, `interrupt`/`cancel`) are handled cleanly at the dispatch level (line 446-448). The active session tracking in `~/.agent-pomodoro.json` uses the existing `loadConfig`/`saveConfig` infrastructure.

**`convex/sessions.ts`**: The `start`, `complete`, and `interrupt` mutations are well-structured with `verifyUserId` auth checks, input validation, and clean Convex DB operations. No over-engineering.

Why 9 and not 10: The `apiPost`/`apiCall` duplication in `apom.mjs` is a minor code smell (P2 finding). The `let body: any` typing in `http.ts` is pragmatic but imprecise. Neither is a structural problem.

### Test Coverage (9/10, +2 improvement)

This is the most significant improvement in Sprint #15. The completion flow E2E gap — carried as a top recommendation through 9 sprint reviews — is now comprehensively covered.

**New coverage (12 tests in `timer-completion.spec.ts`):**

| Test | What it validates |
|------|------------------|
| Work completion modal after 25min | Timer -> 0 triggers modal |
| Save and Skip buttons visible | Modal has expected actions |
| Clickable tags with toggle | Tag selection UI works, `bg-pomored` class toggles |
| Skip advances to break (05:00) | Mode transition: work -> break |
| Save advances to break (05:00) | Save path also transitions correctly |
| Pomodoro counter increments | State: 0 done -> 1 done after completion |
| Break auto-advances to work | No modal for breaks, auto-transition |
| 4th session -> long break (15:00) | Full cycle: 4 work + 3 break sessions |
| Escape skips modal | Keyboard shortcut: Escape |
| Cmd+Enter saves | Keyboard shortcut: Meta+Enter |
| No console errors (work completion) | Sound + wake lock graceful degradation |
| No console errors (break completion) | Sound + wake lock graceful degradation |

The graceful degradation tests (lines 208-259) are a smart approach to testing sound/wake lock: instead of trying to verify that Web Audio played a note (impossible in headless), they verify that the code paths execute without throwing errors. This validates the try-catch guards work correctly.

The `startAndComplete` helper (lines 8-15) with the 500ms intermediate tick before the full fast-forward is a pattern worth documenting — it solves a real problem with Playwright clock mocking where `setInterval` callbacks don't fire if the clock jumps past them without ticking.

**Total test inventory (33 tests):**
- `smoke.spec.ts`: 6 tests (page loads, navigation)
- `timer.spec.ts`: 11 tests (display, mode switching, start/pause/reset, keyboard)
- `timer-completion.spec.ts`: 12 tests (completion flow, transitions, keyboard, degradation)
- `dashboard.spec.ts`: 4 tests (period selector, stat cards)

Why 9 and not 10: The 3 new POST API endpoints (`/api/sessions/start`, `/api/sessions/complete`, `/api/sessions/interrupt`) have no test coverage. These require a running Convex backend, so E2E testing in Playwright is not feasible without significant test infrastructure (mock Convex server or integration test harness). The CLI commands (`start`, `stop`, `interrupt`) are similarly untested — they make real HTTP calls. A mock-based unit test for the CLI would be possible with dependency injection on `fetch`, but the zero-dependency constraint makes this awkward.

### Sprint Autonomy (9/10, +1 improvement)

CLAUDE.md is now accurately up to date for Sprint #15:
- Architecture tree includes `sounds.ts` in `app/lib/`
- `http.ts` description: "REST API: GET (status, stats, sessions) + POST (start, complete, interrupt)"
- `apom.mjs` description: "Zero-dependency CLI: status/stats/sessions + start/stop/interrupt"
- `timer-completion.spec.ts` listed with "(12 tests)"
- Test count: "33 tests"

The `--help-llm` version is correctly synced at 0.3.0. An agent reading `--help-llm` gets the complete command surface with types, defaults, and usage examples.

An agent starting Sprint #16 (final polish + v1.0) has a clear path:
1. Read `s.md` for Sprint #16 plan
2. Read CLAUDE.md for architecture and commands
3. Run `npm run test` to verify baseline
4. Read previous reviews for P1/P2 findings to address

Why 9 and not 10: `s.md` still says "Current Sprint: #14 (completed)" without Sprint #15 history. The skills do not document write commands. A Sprint #16 agent would discover these through CLAUDE.md and `--help-llm`, but the skill files would give an incomplete picture.

## Comparison with Previous Sprint

| Subcategory | Sprint #8 | Sprint #14 | Sprint #15 | Delta (vs #14) |
|-------------|-----------|------------|------------|-----------------|
| CLI Buildability | 9 | 9 | 9 | 0 |
| Skill Integration | 8 | 8 | 9 | +1 |
| Code Organization | 9 | 8 | 9 | +1 |
| Test Coverage | 9 | 7 | 9 | +2 |
| Sprint Autonomy | 10 | 8 | 9 | +1 |
| **Overall** | **9.0** | **8.0** | **9.0** | **+1.0** |

Note: The Sprint #14 review file listed the overall as 8.6 in the header but the subcategory arithmetic mean was 8.0. The table above uses the arithmetic mean (8.0) for consistency. Sprint #15 restores the score to the Sprint #8 high-water mark of 9.0.

### What Moved the Needle (Upward)

- **Test Coverage +2:** The 12-test `timer-completion.spec.ts` closes the single largest quality gap carried through 9 sprint reviews. The clock-mocking approach is correct and non-flaky. The graceful degradation tests validate error handling without needing browser audio capabilities.

- **Skill Integration +1:** Full read-write CLI surface. An agent can now drive the complete pomodoro lifecycle: check status, start a session, complete it with notes/tags, or interrupt it. The `--help-llm` schema is comprehensive and version-accurate.

- **Code Organization +1:** Audio extraction to `sounds.ts` resolved the Sprint #14 regression. New code in `http.ts` and `apom.mjs` follows established patterns without introducing new structural problems.

- **Sprint Autonomy +1:** CLAUDE.md accurately reflects Sprint #15 state. Architecture tree, endpoint descriptions, CLI description, and test count are all current.

### What Held Steady

- **CLI Buildability at 9/10:** Stable across 9 sprints. No new build complications.

### Path to 9.5+

1. **Skill files updated with write commands** -> Skill Integration 10/10 (+0.2 overall)
2. **`s.md` sprint counter and history updated** -> Sprint Autonomy 10/10 (+0.2 overall)
3. **API idempotency guard (reject duplicate active sessions)** -> improves agent reliability, indirect Test Coverage and Skill Integration uplift
4. **CLI error output respects `--json` flag** -> Skill Integration improvement for automated agent callers
5. **Extract `apiPost`/`apiCall` to shared `apiFetch`** -> Code Organization minor cleanup

## Recommendations (Priority Order)

1. **Update `pomodoro-check/SKILL.md` and `agent-onboarding/SKILL.md` with write commands.** Add `agent-pomodoro start work 25`, `agent-pomodoro stop --notes "text" --tags "a,b"`, and `agent-pomodoro interrupt` to both skill files. For `pomodoro-check`, update the "Response patterns" to show actual commands the agent can run. For `agent-onboarding`, add a "Session Control" section to the Available Commands table.

2. **Add server-side active session guard.** In `sessions.start` mutation, query for existing sessions by userId where `completed === false && interrupted === false && startedAt > (Date.now() - 4h)`. If found, reject with "Active session already exists (ID: xxx). Complete or interrupt it first." This prevents duplicate sessions from retry-happy agent callers.

3. **Make CLI error output respect `--json` flag.** In `cmdStop`, `cmdInterrupt`, and `requireApiKey`, check for `--json` in process.argv before writing to stderr. When present, output `{"error": "message"}` instead of plain text. This is essential for agent callers that parse stdout/stderr as JSON.

4. **Deduplicate `apiCall`/`apiPost` into `apiFetch`.** Single function: `async function apiFetch(method, path, data)` with conditional Content-Type and body. Reduces ~25 lines of duplication and ensures error handling changes apply uniformly.

5. **Update `s.md` with Sprint #15 completion.** Set "Current Sprint: #15 (completed)", add Sprint #15 history entry with scores, move Sprint #16 to current.

6. **Add `--session-id` override to `stop` and `interrupt`.** Optional flag that bypasses local active session lookup. Useful for agents that track session IDs independently or when local state is corrupted.

7. **Add client-side duration validation to CLI.** In `cmdStart`, validate that duration is 1-120 before making the API call. Gives a clearer error than the API's generic 400 response.
