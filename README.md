# Agent Pomodoro

Pomodoro timer designed to be monitored by AI agents. Track focus sessions, get held accountable by your AI assistant.

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

```bash
curl -H "Authorization: Bearer apom_xxx" https://your-deployment.convex.site/api/status
curl -H "Authorization: Bearer apom_xxx" https://your-deployment.convex.site/api/stats?days=7
curl -H "Authorization: Bearer apom_xxx" https://your-deployment.convex.site/api/sessions/today
curl -H "Authorization: Bearer apom_xxx" https://your-deployment.convex.site/api/sessions?limit=20
```

## Stack

- **Frontend:** React Router 7 + Tailwind 4
- **Backend:** Convex (real-time database + serverless functions)
- **Auth:** Clerk
- **Tests:** Playwright E2E
- **CLI:** Node.js (zero dependencies)

## Architecture

```
app/           → React frontend (routes, components)
convex/        → Backend (schema, queries, mutations, HTTP API)
packages/apom/ → CLI tool (npm package)
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
