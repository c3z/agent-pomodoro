# Agent Pomodoro

> The only productivity app where your AI agent has full read/write access.

Pomodoro timer + Huberman habit tracker — designed from day one to be monitored, queried, and controlled by AI agents. Not a dashboard you check. A system that checks *you*.

**CLI** · **REST API** · **MCP (Claude Desktop)** · **Claude Code Skills** · **PWA**

Part of the [OnTilt](https://ontilt.dev) work hygiene ecosystem.

---

## Why This Exists

Every pomodoro app is a timer with a UI. You open it, start a session, close it, forget about it.

Agent Pomodoro flips this. Your AI agent:
- **Starts sessions** when you begin a conversation
- **Tags them** from git context when you stop
- **Tracks habits** and correlates them with your focus output
- **Scolds you** when you skip days or break streaks
- **Generates weekly retros** with data, not vibes

No other productivity tool has a 44-endpoint REST API, 14 MCP tools, and a zero-dependency CLI — all designed for LLM consumption.
---

## Screenshots

<img width="1105" height="966" alt="image" src="https://github.com/user-attachments/assets/f7845893-5325-4fb3-936c-ecf8b7f3b0f7" />

<img width="1129" height="964" alt="image" src="https://github.com/user-attachments/assets/a534a8a1-3e3a-4166-a889-fa431bc473ef" />

<img width="1016" height="154" alt="image" src="https://github.com/user-attachments/assets/7dd9e373-9680-4fc2-831d-e5512799c0ba" />

<img width="1722" height="327" alt="image" src="https://github.com/user-attachments/assets/43c0ad0b-5b3a-47bf-aaac-3a1afc4e6f77" />

---

## What An AI Agent Sees

```
$ agent-pomodoro status
Today: 12 pomodoros completed
Week: 13/24 sessions (54% completion), 5.4h focus
Streak: 2 days
Last session: 0.4h ago

$ agent-pomodoro habits
Habits — 2026-03-16 (3/4):

  ✓ [Hard] Morning Qigong ★ (Forming d7/21)
  ✓ [Hard] Deep Work Block (Forming d7/21)
  ✗ [Easy] Evening Review (Forming d7/21)
  ✓ [Easy] Read 20 pages (Forming d7/21)

  Score: 75% — BELOW TARGET (Huberman: 85%)

$ agent-pomodoro habits correlation
Habit × Pomodoro correlation (30d):

  Morning Qigong ★
    Done days: 8.2 avg pomodoros (18d)
    Missed:    4.1 avg pomodoros (12d)
    Impact:    ↑ +100%
```

The agent doesn't ask how you feel. It reads the data and tells you the truth.

---

## Quickstart

### For Humans

```bash
git clone https://github.com/c3z/agent-pomodoro.git
cd agent-pomodoro
npm install && npm run dev
```

Open `http://localhost:5173`. PWA — add to home screen for sounds, vibration, and wake lock.

### For AI Agents (CLI)

```bash
npm install -g agent-pomodoro    # v0.6.0
agent-pomodoro config set-key apom_your_key_here
agent-pomodoro --help-llm        # Full JSON schema for agents
```

### For Claude Desktop (MCP)

```bash
npm install -g agent-pomodoro-mcp
```

Add to Claude Desktop config:
```json
{
  "mcpServers": {
    "agent-pomodoro": {
      "command": "agent-pomodoro-mcp",
      "env": { "APOM_API_KEY": "apom_your_key_here" }
    }
  }
}
```

14 MCP tools available: `pomodoro_status`, `pomodoro_start`, `pomodoro_stop`, `habit_today`, `habit_checkin`, `habit_stats`, `habit_correlation`, and more.

---

## Features

### Pomodoro Timer
- Work / break / long break with configurable durations
- Timer persists across navigation and page refresh
- Completion sounds (Web Audio), vibration, wake lock
- Session tagging, notes, git commit correlation

### Habit Tracker (Huberman Protocol)
- Max 6 active habits (server-enforced)
- 21-day cycles: forming → testing → established (auto-advance cron)
- 85% daily target (4-5 out of 6) — not perfection, consistency
- 2-day bins — Huberman's actual measurement unit
- Hard/Easy phase classification (morning vs afternoon)
- Linchpin habits — the ones that cascade to everything else
- Habit × Pomodoro cross-correlation ("exercise days → +100% pomodoros")
- No streak counters (by design — Huberman says they backfire)

### Accountability System
- Heartbeat tracking — knows when you're working without a timer
- Shame board — unprotected work windows listed with timestamps
- Score 0-100% — percentage of work time covered by active sessions
- Server-side nudges every 30 minutes during work hours

### Analytics
- Weekly heatmap (GitHub-style)
- Focus rhythm by hour and day of week
- Tag analytics (time per category)
- Pomodoro debt (missed targets carry forward)
- 7-day trend comparison with regression detection
- Weekly retrospective with habit integration

---

## CLI Reference

39 commands. All support `--json` for machine-readable output.

```bash
# Core
agent-pomodoro status                    # Quick summary
agent-pomodoro stats [days]              # Detailed stats
agent-pomodoro active                    # Currently running session
agent-pomodoro start work 25 --task "building feature X"
agent-pomodoro stop --notes "done" --tags "code,deep-work"

# Habits (Huberman Protocol)
agent-pomodoro habits                    # Today's status
agent-pomodoro habits add "Exercise" --phase hard --linchpin
agent-pomodoro habits done "exercise"    # Partial name matching
agent-pomodoro habits stats              # Completion rates + 2-day bins
agent-pomodoro habits cycle              # 21-day cycle progress
agent-pomodoro habits correlation        # Habit × Pomodoro impact

# Analytics
agent-pomodoro accountability --shame    # Score + shame log
agent-pomodoro rhythm                    # Focus patterns
agent-pomodoro retro                     # Weekly retrospective
agent-pomodoro debt                      # Pomodoro debt
agent-pomodoro trends                    # 7d vs 7d regression check

# Agent integration
agent-pomodoro heartbeat --daemon        # Activity tracking (every 30s)
agent-pomodoro daily-summary --obsidian  # Obsidian daily note
agent-pomodoro link-commits              # Git commits → session
agent-pomodoro --help-llm                # Full JSON schema for LLMs
```

---

## REST API

44 endpoints. Bearer token auth. All return JSON.

| Group | Endpoints | What they do |
|-------|-----------|-------------|
| Sessions | 8 | Start, stop, interrupt, list, active, task, commits |
| Habits | 11 | CRUD, checkin, uncheckin, stats, cycle, correlation |
| Activity | 3 | Heartbeat, accountability score, shame log |
| Analytics | 7 | Stats, tags, rhythm, debt, trends, retro, daily summary |
| Goals | 2 | Get/set daily + weekly targets |
| System | 3 | Me, status, nudges |

Full reference: `agent-pomodoro --help-llm` or visit `/settings` in the app.

---

## Building a Claude Code Skill

Create `.claude/skills/pomodoro-check/SKILL.md`:

```markdown
---
name: pomodoro-check
description: Checks pomodoro + habit compliance. Use at conversation start.
---

## Conversation Start (mandatory)

\```bash
agent-pomodoro active          # Check session
agent-pomodoro habits --json   # Check habits
\```

## Interpretation

- **habits.hubermanTarget.met === true** → "Habits on track."
- **Linchpin (★) missed** → "Exercise not done. Cascade risk."
- **0 sessions today** → "No focus time. Start a timer."
- **completionRate < 50%** → "Distraction pattern. Finish what you start."

## Actions

\```bash
agent-pomodoro start work 25 --task "desc"
agent-pomodoro habits done "exercise"
\```
```

The skill gives your AI agent context to interpret data and hold you accountable.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Router 7 + Tailwind 4 |
| Backend | Convex (real-time DB + serverless) |
| Auth | Clerk |
| Tests | Playwright E2E (76 tests) |
| CLI | `agent-pomodoro` on npm (zero deps) |
| MCP | `agent-pomodoro-mcp` on npm (Claude Desktop) |
| PWA | Web Audio, vibration, wake lock, service worker |

## Architecture

```
app/               → React frontend (7 routes, components, sounds)
convex/            → Backend (7 tables, 44 HTTP endpoints, cron jobs)
packages/apom/     → CLI tool (npm: agent-pomodoro@0.6.0, 39 commands)
packages/mcp/      → MCP server (npm: agent-pomodoro-mcp, 14 tools)
e2e/               → Playwright tests (76 tests)
.claude/skills/    → Claude Code skills (8 skills)
```

## Development

```bash
npm run dev          # Dev server (localhost:5173)
npm run build        # Production build
npm run test         # E2E tests (76 tests)
npm run typecheck    # TypeScript check
npx convex dev       # Convex backend dev
```

---

## License

MIT
