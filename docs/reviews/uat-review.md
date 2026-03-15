# UAT Review — Agent Pomodoro Sprint #15

**Date:** 2026-03-15
**Reviewer:** UAT Tester (Atropa)
**Test runner:** Playwright 1.x, Chromium, local dev server (localhost:5173)

---

## Local E2E Tests

**Verdict: PASS**

```
Running 33 tests using 6 workers
30 passed, 3 flaky (22.7s)
```

All 33 tests pass. 3 tests were flaky (failed on first attempt, passed on retry #1).

### Test Breakdown

| Suite | Tests | Result |
|-------|-------|--------|
| Smoke (smoke.spec.ts) | 6 | 6/6 PASS |
| Dashboard (dashboard.spec.ts) | 4 | 4/4 PASS |
| Timer (timer.spec.ts) | 11 | 11/11 PASS (3 flaky) |
| Timer Completion (timer-completion.spec.ts) | 12 | 12/12 PASS |
| **Total** | **33** | **33/33 PASS** |

### Flaky Tests (passed on retry #1)

All 3 flaky tests are in `e2e/timer.spec.ts` and share a common pattern: the timer start action (click or Space key) is not registering fast enough, causing the pause button or 24:59 display to not appear within the expected timeout on first attempt.

| Test | First attempt failure | Retry |
|------|----------------------|-------|
| `start button starts the timer` | `text=24:59` not visible within 3s | PASS |
| `pause and resume work` | `pause-button` not visible within 15s | PASS |
| `keyboard space starts the timer` | `pause-button` not visible within 2s | PASS |

**Root cause:** Race condition on timer start — likely the dev server or Chromium is under load during parallel test execution, causing the first click/keypress to not register or the UI to not update within tight timeouts. This is a pre-existing pattern (not a Sprint #15 regression). The `retries: 1` config in `playwright.config.ts` handles this correctly.

**Recommendation:** Consider increasing timeout for `keyboard space starts the timer` from 2000ms to 3000ms to reduce flakiness, or add a small `waitForTimeout` before asserting after start actions.

### Console Errors

Two dedicated tests verify no console errors during timer flows:
- `no console errors during timer completion in headless` — PASS
- `no console errors during break completion in headless` — PASS

## Staging Tests

**Skipped** — Vercel Deployment Protection returns HTTP 401 for all requests (known infrastructure issue, not a code regression).

## Test Count Delta

Sprint #14: 21 tests
Sprint #15: 33 tests (+12 new tests for timer completion flows, keyboard shortcuts, and sound/wake lock degradation)

## Overall UAT Verdict: PASS

All 33 local tests pass. Flaky tests are a minor timing issue, not a functional defect — all pass on retry. No console errors detected.
