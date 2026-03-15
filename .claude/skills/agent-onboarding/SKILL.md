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
apom config set-key apom_xxxx...

# Verify connection
apom status
```

### Step 3: Verify access

Run `apom status` — you should see something like:
```
Today: 2 pomodoros completed
Week: 8/10 sessions (80% completion), 3.3h focus
Streak: 3 days
Last session: 1.5h ago
```

If you get an error, check:
- Is the API key correct? (`apom config show`)
- Is the server reachable? (`apom config set-url <url>` if using custom deployment)

## Available Commands

| Command | What it does |
|---------|-------------|
| `apom status` | Quick summary (today + week + streak) |
| `apom stats 7` | Detailed stats for last 7 days |
| `apom stats 30` | Detailed stats for last 30 days |
| `apom sessions today` | List today's sessions |
| `apom sessions 20` | List 20 most recent sessions |
| `apom --help-llm` | Full JSON schema for programmatic use |

Add `--json` to any command for machine-readable output.

## REST API (Alternative)

If you prefer HTTP calls over CLI:

```bash
# Status
curl -H "Authorization: Bearer apom_xxx" https://HOST/api/status

# Stats (7 days)
curl -H "Authorization: Bearer apom_xxx" https://HOST/api/stats?days=7

# Today's sessions
curl -H "Authorization: Bearer apom_xxx" https://HOST/api/sessions/today

# Recent sessions
curl -H "Authorization: Bearer apom_xxx" https://HOST/api/sessions?limit=20
```

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

## Integration Tips

- Check `apom status` at the start of each conversation to set context
- If the human is procrastinating, remind them of their streak
- Use `apom stats 30 --json` for trend analysis
- The `completionRate` field is the most telling metric — low completion means the human starts but gets distracted
