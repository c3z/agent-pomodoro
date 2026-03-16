---
name: agent-onboarding
description: |
  Guides new AI agents through Agent Pomodoro: what it is, how to connect,
  how to interpret data. Use when onboarding a new agent, or when an agent
  asks "what is this?" or "how do I connect?".
  Triggery: "agent onboarding", "onboard agent", "how to connect",
  "what is agent pomodoro", "setup agent access".
---

# Agent Onboarding — Agent Pomodoro

## What is Agent Pomodoro?

Agent Pomodoro is a focus tracking tool for humans, designed to be monitored by AI agents.
The human uses the web app to run pomodoro sessions. The AI agent queries the data
to hold the human accountable for their focus hygiene.

**Key concept:** The human does the work. The agent watches, measures, and scolds.

## How to Connect (Step by Step)

### Step 1: Get an API key

The human needs to:
1. Open the Agent Pomodoro web app
2. Go to **Settings**
3. Click **Create API Key**
4. Copy the key (shown only once)

### Step 2: Configure the CLI

```bash
# Install globally
npm install -g agent-pomodoro

# Set API key
agent-pomodoro config set-key apom_xxxx...

# Verify connection
agent-pomodoro status
```

### Step 3: Verify access

Run `agent-pomodoro status` — you should see something like:
```
Today: 2 pomodoros completed
Week: 8/10 sessions (80% completion), 3.3h focus
Streak: 3 days
Last session: 1.5h ago
```

If you get an error, check:
- Is the API key correct? (`agent-pomodoro config show`)
- Is the server reachable? (`agent-pomodoro config set-url <url>` if using custom deployment)

## Available Commands

| Command | What it does |
|---------|-------------|
| `agent-pomodoro status` | Quick summary (today + week + streak) |
| `agent-pomodoro stats [days]` | Detailed stats (default: 7 days, max: 3650) |
| `agent-pomodoro sessions today` | List today's sessions |
| `agent-pomodoro sessions [limit]` | List recent sessions (default: 20, max: 200) |
| `agent-pomodoro active` | Show currently running session (elapsed/remaining) |
| `agent-pomodoro start [type] [min] [--task "..."]` | Start a session with optional task description |
| `agent-pomodoro task set "description"` | Set/update task on active session |
| `agent-pomodoro stop [--notes "..."] [--tags "a,b"]` | Complete active session with optional metadata |
| `agent-pomodoro interrupt` | Cancel the active session |
| `agent-pomodoro heartbeat` | Send a single activity heartbeat |
| `agent-pomodoro heartbeat --daemon` | Send heartbeat every 30s (keep running) |
| `agent-pomodoro heartbeat --source name` | Heartbeat with custom source label |
| `agent-pomodoro accountability` | Accountability score (default: last 7 days) |
| `agent-pomodoro accountability --days 30` | Accountability score for 30 days |
| `agent-pomodoro accountability --shame` | Include shame log (unprotected work windows) |
| `agent-pomodoro config set-key <key>` | Set API key |
| `agent-pomodoro config set-url <url>` | Set custom Convex site URL |
| `agent-pomodoro config show` | Show current config |
| `agent-pomodoro --help-llm` | Full JSON schema for programmatic use |
| `agent-pomodoro --help` | Human-readable help |

Add `--json` to any read/write command for machine-readable output.

## Accountability System

The accountability system tracks whether work time is **protected** by pomodoro sessions.
It uses heartbeats (activity signals) and session data to compute a score.

- **Heartbeats:** Agents or tools send periodic pings via `heartbeat` to signal that work is happening.
- **Protected windows:** Time periods where heartbeats overlap with an active pomodoro session.
- **Unprotected windows:** Time periods where heartbeats exist but no pomodoro was running.
- **Score:** `protectedWindows / totalWindows * 100` — higher is better.
- **Shame log:** Lists every unprotected work window with timestamps and duration.

### Setting up heartbeat daemon

For continuous monitoring, start a heartbeat daemon alongside work:

```bash
# As a background process
agent-pomodoro heartbeat --daemon --source "claude-code" &

# Or via the session hook (packages/apom/hooks/heartbeat.sh)
# Sends a fire-and-forget curl on each Claude Code session start
```

The daemon sends a heartbeat every 30 seconds. It handles SIGINT/SIGTERM for clean exit.

## REST API (Alternative)

If you prefer HTTP calls over CLI:

### Read endpoints (GET)

```bash
# Status — agent summary (text)
curl -H "Authorization: Bearer apom_xxx" https://HOST/api/status

# Stats (7 days)
curl -H "Authorization: Bearer apom_xxx" https://HOST/api/stats?days=7

# Today's sessions
curl -H "Authorization: Bearer apom_xxx" https://HOST/api/sessions/today

# Recent sessions
curl -H "Authorization: Bearer apom_xxx" https://HOST/api/sessions?limit=20

# Active session
curl -H "Authorization: Bearer apom_xxx" https://HOST/api/sessions/active

# Accountability score
curl -H "Authorization: Bearer apom_xxx" "https://HOST/api/activity/accountability?days=7"

# Shame log (unprotected work windows)
curl -H "Authorization: Bearer apom_xxx" "https://HOST/api/activity/shame?days=7"
```

### Write endpoints (POST)

```bash
# Start a session
curl -X POST -H "Authorization: Bearer apom_xxx" -H "Content-Type: application/json" \
  -d '{"type":"work","durationMinutes":25}' https://HOST/api/sessions/start

# Complete a session
curl -X POST -H "Authorization: Bearer apom_xxx" -H "Content-Type: application/json" \
  -d '{"sessionId":"abc123","notes":"done","tags":["code"]}' https://HOST/api/sessions/complete

# Interrupt a session
curl -X POST -H "Authorization: Bearer apom_xxx" -H "Content-Type: application/json" \
  -d '{"sessionId":"abc123"}' https://HOST/api/sessions/interrupt

# Send heartbeat
curl -X POST -H "Authorization: Bearer apom_xxx" -H "Content-Type: application/json" \
  -d '{"source":"my-agent"}' https://HOST/api/activity/heartbeat
```

### Full endpoint reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | Agent summary (text) |
| GET | `/api/stats?days=N` | Statistics for period |
| GET | `/api/sessions/today` | Today's sessions |
| GET | `/api/sessions?limit=N` | Recent sessions |
| GET | `/api/sessions/active` | Currently running session |
| POST | `/api/sessions/start` | Start a new session (accepts `currentTask`) |
| POST | `/api/sessions/task` | Set task on active session |
| POST | `/api/sessions/complete` | Complete a session |
| POST | `/api/sessions/interrupt` | Interrupt a session |
| POST | `/api/activity/heartbeat` | Record work activity heartbeat |
| GET | `/api/activity/accountability?days=N` | Accountability score |
| GET | `/api/activity/shame?days=N` | Shame log (unprotected windows) |

## How to Interpret Data

### Healthy patterns (human is doing well)
- **4+ work sessions/day** — good focus hygiene
- **80%+ completion rate** — follows through, doesn't abandon
- **Streak >= 3 days** — building consistency
- **hoursSinceLastSession < 8** — recently active

### Warning signs (time to intervene)
- **0 sessions today** — hasn't started focused work
- **hoursSinceLastSession > 24** — hasn't used pomodoro in over a day
- **completionRate < 50%** — starts but doesn't finish (distraction pattern)
- **streak = 0** — broke the chain
- **avgSessionsPerDay < 2** — under-using the tool

### What to do when stats are bad

Be direct. Example:
> "Last pomodoro was 26 hours ago. You have 1 session this week. This isn't
> focus hygiene — it's the absence of it. Start a timer. Now."

### What to do when stats are good

Acknowledge briefly, don't over-celebrate:
> "8 sessions, 3.2h focus, 4-day streak. Solid. Keep going."

## Auto-Start Sessions

Agents can automatically start pomodoro sessions for the human. This is the proactive loop:

### Workflow: check active -> start -> monitor -> complete

```bash
# 1. Check if a session is already running
agent-pomodoro active

# 2. If no active session, start one with task context
agent-pomodoro start work 25 --task "building feature X"

# 3. Mid-session: update task if focus shifts
agent-pomodoro task set "refactoring auth module"

# 4. When done: complete with notes and tags
agent-pomodoro stop --notes "finished auth refactor" --tags "code,refactor"
```

### Idempotency guard

It is **safe to call `start` even if a session is already running**:
- If a session of the **same type** is active, `start` returns the existing session ID (no duplicate created).
- If a session of a **different type** is active, `start` returns HTTP 409 (conflict) — the agent should handle this gracefully.

This means agents can run `start` at the beginning of every conversation without worrying about creating duplicate sessions.

### Task descriptions

Use `--task` when starting sessions to record what the human is working on:
```bash
agent-pomodoro start work 25 --task "sprint #19 implementation"
```

Update mid-session if the focus shifts:
```bash
agent-pomodoro task set "debugging CI pipeline"
```

Task descriptions appear in the Timer UI and in `active` output, giving both the human and other agents context about current work.

## Integration Tips

- Check `agent-pomodoro active` at the start of each conversation — this is faster and more actionable than `status`
- If no session is active during work hours, suggest (or auto-start) one
- If the human is procrastinating, remind them of their streak
- Use `agent-pomodoro stats 30 --json` for trend analysis
- The `completionRate` field is the most telling metric — low completion means the human starts but gets distracted
