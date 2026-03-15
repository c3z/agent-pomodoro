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

# Convex prod deploy
npx convex deploy --yes

# Type check
npm run typecheck
```

## Architecture

```
app/
├── routes/          # React Router file routes
│   ├── layout.tsx   # Nav + Providers wrapper
│   ├── home.tsx     # Dashboard (stats + period selector + today's sessions)
│   ├── timer.tsx    # Pomodoro timer + retry queue integration
│   ├── history.tsx  # Session history with pagination
│   ├── settings.tsx # API key management for agent access
│   └── sign-in.tsx  # Clerk sign-in
├── components/      # React components
│   ├── Timer.tsx    # Core timer logic + UI + completion modal + wake lock
│   ├── Stats.tsx    # Statistics cards
│   ├── SessionList.tsx  # Session list with date groups + tags
│   ├── AuthGate.tsx     # Clerk sign-in gate
│   └── Providers.tsx    # Clerk + Convex providers
└── lib/
    ├── sounds.ts        # Web Audio completion sounds (singing bowl + chime) + vibration
    ├── useUserId.ts     # User ID hook (Clerk/dev)
    └── retryQueue.ts    # localStorage-based offline mutation retry

convex/
├── schema.ts        # pomodoroSessions + apiKeys tables
├── sessions.ts      # CRUD mutations + queries + stats + agentSummary + activeUserId
├── apiKeys.ts       # API key CRUD + hash validation
├── http.ts          # REST API: GET (status, stats, sessions) + POST (start, complete, interrupt)
├── auth.config.ts   # Clerk JWT config
└── tsconfig.json    # Convex-specific TS config

packages/apom/       # CLI tool (npm install -g agent-pomodoro)
├── bin/apom.mjs     # Zero-dependency CLI: status/stats/sessions + start/stop/interrupt
└── package.json     # npm package config

public/
├── sw.js            # Service worker (network-first nav, cache-first assets)
├── manifest.json    # PWA manifest
└── icon-*.png       # PWA icons

e2e/
├── smoke.spec.ts              # Critical pages load (6 tests)
├── timer.spec.ts              # Timer interaction + keyboard shortcuts (11 tests)
├── timer-completion.spec.ts   # Completion flow, mode transitions, sounds (12 tests)
└── dashboard.spec.ts          # Dashboard period selector + stats (4 tests)

.claude/skills/
├── sprint/            # Sprint cycle (build → test → audit → PR)
├── site-audit/        # Multi-reviewer quality audit (Agent Access = 70% primary)
├── pomodoro-check/    # Agent checks c3z's usage (prefers agent-pomodoro CLI)
└── agent-onboarding/  # Guides new agents through setup + interpretation
```

## Conventions

- **Components:** PascalCase, one component per file
- **Routes:** lowercase, React Router v7 file convention
- **CSS:** Tailwind 4 with custom theme vars (pomored, breakgreen, surface)
- **Font:** JetBrains Mono (monospace), Inter (sans)
- **Tests:** Playwright E2E in `e2e/`, must pass before PR (33 tests)

## Quality Tracking

Sprint cycle: brief → build → test → staging → audit → triage → compare → PR.
Session summary and priorities in `s.md`.

Current consolidated score: **8.5/10** (Sprint #8).

Agent Access is the primary quality driver (70% weight). Old reviewers at 10% each (regression guard).

## Environment Variables

```bash
# .env.local
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_JWT_ISSUER_DOMAIN=https://xxx.clerk.accounts.dev
CONVEX_DEPLOYMENT=dev:xxx
```

## Convex Deployments

- **Dev:** `first-curlew-203` (CONVEX_DEPLOYMENT in .env.local)
- **Prod:** `efficient-wolf-51` (deploy with `npx convex deploy --yes`)

## Sprint Rules

1. One sprint = one branch (`sprint/N`)
2. Max 3 items per sprint
3. E2E tests MUST pass before PR
4. Staging deploy before audit
5. No prod deploy without c3z approval
6. Read `s.md` before starting any sprint
