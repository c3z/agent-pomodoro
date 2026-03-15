# Contributing to Agent Pomodoro

## Setup

```bash
git clone https://github.com/c3z/agent-pomodoro.git
cd agent-pomodoro
npm install
```

You'll need:
- Node.js 18+
- A Convex account (free at convex.dev)
- A Clerk account (free at clerk.com)

### Environment

Copy `.env.local.example` or create `.env.local`:

```bash
CONVEX_DEPLOYMENT=dev:your-deployment
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_JWT_ISSUER_DOMAIN=https://xxx.clerk.accounts.dev
```

### Dev workflow

```bash
npx convex dev    # Start Convex backend (separate terminal)
npm run dev       # Start frontend dev server
```

## Making Changes

1. Create a branch from `main`
2. Make your changes
3. Run checks:
   ```bash
   npm run typecheck    # TypeScript
   npm run build        # Production build
   npm run test         # E2E tests (21 tests must pass)
   ```
4. Commit with conventional prefix: `(feat)`, `(fix)`, `(refactor)`, `(test)`, `(docs)`
5. Open a PR against `main`

## Architecture

- `app/` — React Router 7 frontend
- `convex/` — Convex backend (schema, queries, mutations, HTTP API)
- `packages/apom/` — CLI tool (standalone, zero dependencies)
- `e2e/` — Playwright E2E tests
- `.claude/skills/` — Claude Code skills for agent integration

## Code Style

- Components: PascalCase, one per file
- Routes: lowercase, React Router v7 file convention
- CSS: Tailwind 4 with custom theme vars
- Font: JetBrains Mono (mono), Inter (sans)

## Tests

All E2E tests must pass before merging. Run:

```bash
npm run test           # Full suite
npm run test:smoke     # Quick smoke tests only
```

## Convex Schema Changes

If you modify `convex/schema.ts`:
1. Run `npx convex dev --once` to push schema and regenerate types
2. Verify with `npm run typecheck`

## CLI Changes

The `agent-pomodoro` CLI lives in `packages/apom/`. It's plain JavaScript (ESM, no build step).
Test locally: `node packages/apom/bin/apom.mjs --help`
