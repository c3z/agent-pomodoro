# CLAUDE.md — Agent Pomodoro

## What Is This

Pomodoro technique app for c3z. Built to be monitored by AI agents (Atropa).
The agent can check if c3z actually uses it and scold him when he doesn't.

**Stack:** React Router 7 + Convex + Clerk + Tailwind 4 + Playwright

## Commands

```bash
# Dev server
npm run dev

# Build
npm run build

# E2E tests (local)
npm run test

# E2E tests (staging)
STAGING_URL=https://xxx.vercel.app npm run test

# Smoke only
npm run test:smoke

# Staging deploy
npm run build && npx vercel --yes

# Production deploy (REQUIRES c3z approval)
npx vercel --prod --yes

# Convex dev (backend)
npx convex dev

# Type check
npm run typecheck
```

## Architecture

```
app/
├── routes/          # React Router file routes
│   ├── layout.tsx   # Nav + Providers wrapper
│   ├── home.tsx     # Dashboard (stats + today's sessions)
│   ├── timer.tsx    # Pomodoro timer
│   ├── history.tsx  # Session history
│   └── sign-in.tsx  # Clerk sign-in
├── components/      # React components
│   ├── Timer.tsx    # Core timer logic + UI
│   ├── Stats.tsx    # Statistics cards
│   ├── SessionList.tsx  # Session list
│   └── Providers.tsx    # Clerk + Convex providers
└── lib/
    └── convex.ts    # Convex client

convex/
├── schema.ts        # pomodoroSessions table
├── sessions.ts      # CRUD mutations + queries + stats
└── auth.config.ts   # Clerk JWT config

e2e/
├── smoke.spec.ts    # Critical pages load
└── timer.spec.ts    # Timer interaction flow

.claude/skills/
├── sprint/          # Sprint cycle (build → test → audit → PR)
├── site-audit/      # Multi-reviewer quality audit
└── pomodoro-check/  # Agent checks c3z's usage
```

## Conventions

- **Components:** PascalCase, one component per file
- **Routes:** lowercase, React Router v7 file convention
- **CSS:** Tailwind 4 with custom theme vars (pomored, breakgreen, surface)
- **Font:** JetBrains Mono (monospace), Inter (sans)
- **Tests:** Playwright E2E in `e2e/`, must pass before PR

## Quality Tracking

Sprint cycle: brief → build → test → staging → audit → triage → compare → PR.
Session summary and priorities in `s.md`.

| Reviewer | #1 |
|----------|-----|
| End-user (PRIMARY) | — |
| Developer Experience | — |
| Performance | — |

End-user is the main quality driver. Stop condition: >= 7.0/10, P1 = 0.

## Environment Variables

```bash
# .env.local
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_JWT_ISSUER_DOMAIN=https://xxx.clerk.accounts.dev
CONVEX_DEPLOYMENT=dev:xxx
```

## Sprint Rules

1. One sprint = one branch (`sprint/N`)
2. Max 3 items per sprint
3. E2E tests MUST pass before PR
4. Staging deploy before audit
5. No prod deploy without c3z approval
6. Read `s.md` before starting any sprint
