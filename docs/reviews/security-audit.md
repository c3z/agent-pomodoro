# Security Audit — Agent Pomodoro

**Date:** 2026-03-15
**Auditor:** Silent Failure Hunter Agent

## Critical Findings

### 1. No Server-Side Auth on Convex Functions
**Severity: CRITICAL**
All mutations/queries accept `userId` as client argument. No `ctx.auth.getUserIdentity()` check.
Any user can read/write any other user's data via browser console.

### 2. Auth Bypass When Clerk Not Configured  
**Severity: CRITICAL**
`AuthGate`, `Providers`, `useUserId` silently fall through when CLERK_KEY missing.
App looks functional but has zero auth. `"dev-user"` shared identity.

### 3. No Ownership Check on complete/interrupt
**Severity: CRITICAL**
Mutations blindly patch any sessionId without verifying ownership.

## High Findings

### 4. Empty catch in playCompletionSound
### 5. Mutation failures silently swallowed (console.warn only)
### 6. agentSummary query unauthenticated
### 7. Hardcoded "dev-user" leaks to production

## Medium Findings

### 8. No range validation on durationMinutes
### 9. No length limits on notes/tags
### 10. Silent no-op when userId is null (timer runs, session not saved)
### 12. Convex provider silently skipped when URL missing

## Positive
- No XSS vectors (no dangerouslySetInnerHTML)
- No secrets in client-side code
- .env properly gitignored
- Convex schema provides type safety

## Priority: Fix 1, 2, 3 before real multi-user deployment
