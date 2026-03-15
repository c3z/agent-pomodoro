# Agent Pomodoro

Pomodoro timer designed to be monitored and controlled by AI agents. Track focus sessions, get held accountable by your AI assistant.

Part of the [OnTilt](https://ontilt.dev) work hygiene ecosystem.

## Quickstart (Human)

```bash
git clone https://github.com/c3z/agent-pomodoro.git
cd agent-pomodoro
npm install
npm run dev
```

Open `http://localhost:5173`. Sign in with Clerk, start a pomodoro.

**PWA:** Add to home screen on iOS/Android for standalone app experience with completion sounds, vibration, and screen wake lock.

## Quickstart (AI Agent)

### 1. Install the CLI

```bash
npm install -g agent-pomodoro
```

This installs the `agent-pomodoro` command globally.

### 2. Get an API key

Go to Settings in the app and create an API key.

### 3. Configure

```bash
agent-pomodoro config set-key apom_your_key_here
```

### 4. Query

```bash
agent-pomodoro status              # Quick summary
agent-pomodoro stats 7             # Last 7 days
agent-pomodoro sessions today      # Today's sessions
agent-pomodoro --help-llm          # Full JSON schema for agents
```

### 5. Control

```bash
agent-pomodoro start work 25       # Start a 25min focus session
agent-pomodoro start break 5       # Start a 5min break
agent-pomodoro stop --notes "deep work on API" --tags "code,deep-work"
agent-pomodoro interrupt           # Cancel active session
```

All commands support `--json` for machine-readable output.

### REST API

All endpoints require `Authorization: Bearer apom_xxx` header.

**Read:**

```bash
curl -H "Authorization: Bearer apom_xxx" https://your-deployment.convex.site/api/status
curl -H "Authorization: Bearer apom_xxx" https://your-deployment.convex.site/api/stats?days=7
curl -H "Authorization: Bearer apom_xxx" https://your-deployment.convex.site/api/sessions/today
curl -H "Authorization: Bearer apom_xxx" https://your-deployment.convex.site/api/sessions?limit=20
```

**Write:**

```bash
# Start a session
curl -X POST -H "Authorization: Bearer apom_xxx" \
  -H "Content-Type: application/json" \
  -d '{"type":"work","durationMinutes":25}' \
  https://your-deployment.convex.site/api/sessions/start

# Complete a session
curl -X POST -H "Authorization: Bearer apom_xxx" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"abc123","notes":"sprint work","tags":["code"]}' \
  https://your-deployment.convex.site/api/sessions/complete

# Interrupt a session
curl -X POST -H "Authorization: Bearer apom_xxx" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"abc123"}' \
  https://your-deployment.convex.site/api/sessions/interrupt
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
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro status
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro stats 7 --json
\```

## Remote Start (when user needs a nudge)

\```bash
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro start work 25
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

The skill gives your AI agent the context to interpret your data and hold you accountable. Use `agent-pomodoro --help-llm` for the full JSON schema your skill can reference.

## Stack

- **Frontend:** React Router 7 + Tailwind 4
- **Backend:** Convex (real-time database + serverless functions)
- **Auth:** Clerk
- **Tests:** Playwright E2E (33 tests)
- **CLI:** `agent-pomodoro` on npm (zero dependencies)
- **PWA:** Sounds (Web Audio), vibration, wake lock, offline support

## Architecture

```
app/           → React frontend (routes, components, sounds)
convex/        → Backend (schema, queries, mutations, HTTP API)
packages/apom/ → CLI tool (npm: agent-pomodoro, v0.3.0)
e2e/           → Playwright E2E tests (33 tests)
```

## Development

```bash
npm run dev          # Dev server
npm run build        # Production build
npm run test         # E2E tests (33 tests)
npm run typecheck    # TypeScript check
npx convex dev       # Convex backend dev
```

## License

MIT
