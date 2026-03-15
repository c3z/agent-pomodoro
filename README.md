# Agent Pomodoro

Pomodoro timer designed to be monitored by AI agents. Track focus sessions, get held accountable by your AI assistant.

Part of the [OnTilt](https://ontilt.dev) work hygiene ecosystem.

## Quickstart (Human)

```bash
git clone https://github.com/c3z/agent-pomodoro.git
cd agent-pomodoro
npm install
npm run dev
```

Open `http://localhost:5173`. Sign in with Clerk, start a pomodoro.

## Quickstart (AI Agent)

### 1. Install the CLI

```bash
npm install -g agent-pomodoro
```

This installs the `apom` command globally.

### 2. Get an API key

Go to Settings in the app and create an API key.

### 3. Configure

```bash
apom config set-key apom_your_key_here
```

### 4. Query

```bash
apom status              # Quick summary
apom stats 7             # Last 7 days
apom sessions today      # Today's sessions
apom --help-llm          # Full JSON schema for agents
```

All commands support `--json` for machine-readable output.

### REST API

All endpoints require `Authorization: Bearer apom_xxx` header.

```bash
curl -H "Authorization: Bearer apom_xxx" https://your-deployment.convex.site/api/status
curl -H "Authorization: Bearer apom_xxx" https://your-deployment.convex.site/api/stats?days=7
curl -H "Authorization: Bearer apom_xxx" https://your-deployment.convex.site/api/sessions/today
curl -H "Authorization: Bearer apom_xxx" https://your-deployment.convex.site/api/sessions?limit=20
```

## Building a Claude Code Skill

You can create a [Claude Code skill](https://docs.anthropic.com/en/docs/claude-code) that checks your pomodoro usage automatically. Here's an example skill (`SKILL.md`):

```markdown
---
name: pomodoro-check
description: |
  Checks pomodoro usage and scolds for inactivity.
  Triggery: "pomodoro check", "focus check", "how's my focus".
---

# Pomodoro Check

## How to Check

\```bash
APOM_API_KEY=$(sec get APOM_API_KEY) apom status
APOM_API_KEY=$(sec get APOM_API_KEY) apom stats 7 --json
\```

## Interpretation

- **4+ sessions/day** = good focus hygiene
- **80%+ completion** = follows through
- **0 sessions today** = hasn't started (scold)
- **completionRate < 50%** = starts but doesn't finish (distraction pattern)
- **hoursSinceLastSession > 24** = tool abandoned

## Response

When bad: "Last pomodoro was X hours ago. Start a timer. Now."
When good: "X sessions, Yh focus, Z-day streak. Solid."
```

The skill gives your AI agent the context to interpret your data and hold you accountable. Use `apom --help-llm` for the full JSON schema your skill can reference.

## Stack

- **Frontend:** React Router 7 + Tailwind 4
- **Backend:** Convex (real-time database + serverless functions)
- **Auth:** Clerk
- **Tests:** Playwright E2E
- **CLI:** `agent-pomodoro` on npm (binary: `apom`, zero dependencies)

## Architecture

```
app/           → React frontend (routes, components)
convex/        → Backend (schema, queries, mutations, HTTP API)
packages/apom/ → CLI tool (npm: agent-pomodoro, binary: apom)
e2e/           → Playwright E2E tests
```

## Development

```bash
npm run dev          # Dev server
npm run build        # Production build
npm run test         # E2E tests (21 tests)
npm run typecheck    # TypeScript check
npx convex dev       # Convex backend dev
```

## License

MIT
