# UAT Review — Agent Pomodoro (Staging)

**Date:** 2026-03-15
**Staging URL:** https://agent-pomodoro-gv1qzk0if-itsgglobal.vercel.app
**Verdict: FAIL**

---

## Summary

All E2E tests failed. The staging deployment is blocked by **Vercel Deployment Protection** — every route returns HTTP 401 and renders the Vercel "Log in to Vercel" page instead of the application. No application content is accessible.

## Root Cause

The Vercel preview deployment has **Deployment Protection** enabled. All routes (`/`, `/timer`, `/history`) return HTTP 401 and redirect to Vercel's authentication gate. Playwright sees the Vercel login page, not Agent Pomodoro.

Screenshot evidence: the test failure screenshot shows "Log in to Vercel" with email/Google/GitHub/Apple sign-in options — not the app.

## Test Results

### Full E2E Suite (`npm run test`)

| Test | Result |
|------|--------|
| **Smoke: homepage loads** | FAIL — "Agent Pomodoro" text not found (Vercel login shown) |
| **Smoke: homepage has start button** | FAIL — `start-pomodoro-link` test ID not found |
| **Smoke: timer page loads** | FAIL — `start-button` test ID not found |
| **Smoke: history page loads** | FAIL — "Session History" heading not found |
| **Smoke: navigation works** | FAIL — "Timer" link not found (timeout 60s) |
| **Timer: displays 25:00 by default** | FAIL — "25:00" text not found |
| **Timer: mode buttons visible** | FAIL — FOCUS/BREAK/LONG BREAK buttons not found |
| **Timer: break mode shows 05:00** | FAIL — could not click BREAK (timeout) |
| **Timer: long break shows 15:00** | FAIL — could not click LONG BREAK (timeout) |
| **Timer: start button starts timer** | FAIL — could not click start-button (timeout) |
| **Timer: pause and resume** | FAIL — could not click start-button (timeout) |
| **Timer: reset stops timer** | FAIL — could not click start-button (timeout) |
| **Timer: pomodoro counter shows 0 done** | FAIL — "0 done" text not found |

**Result: 0/13 passed, 13/13 failed (all retries also failed)**

### Smoke Tests (`npm run test:smoke`)

| Test | Result |
|------|--------|
| homepage loads | FAIL |
| homepage has start button | FAIL |
| timer page loads | FAIL |
| history page loads | FAIL |
| navigation works | FAIL |

**Result: 0/5 passed, 5/5 failed (all retries also failed)**

## Errors Found

1. **CRITICAL — Deployment Protection (blocker):** Vercel Deployment Protection is enabled on this preview URL. All routes return HTTP 401. The app is completely inaccessible without Vercel authentication.

2. **Minor — Playwright trace artifact errors:** On retries, Playwright failed to save trace files (`ENOENT` errors for `.trace` and `.zip` artifacts). This is a secondary issue likely caused by concurrent test cleanup, not a product bug.

## Console / Network Issues

- All HTTP requests to the staging URL return **401 Unauthorized**
- Response content type is `text/html; charset=utf-8` (Vercel's login page HTML)
- No application JavaScript or API calls are executed

## Recommended Fix

To enable E2E testing against Vercel preview deployments, one of:

1. **Disable Deployment Protection** for this preview URL in Vercel project settings (Settings > Deployment Protection > Preview)
2. **Use Vercel Protection Bypass** — set the `x-vercel-protection-bypass` header or `_vercel_jwt` cookie in Playwright config using a bypass secret from Vercel
3. **Promote to production** where protection may not be enabled, and test there
4. **Use `vercel --prod`** for the staging deploy if production protection is off

## Conclusion

The staging deployment cannot be tested in its current state. This is an infrastructure/configuration issue, not a code issue. The application code and tests themselves appear correct — they just cannot reach the app behind Vercel's auth wall.
