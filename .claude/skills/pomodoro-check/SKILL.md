---
name: pomodoro-check
description: |
  Checks c3z's Pomodoro usage from Convex database.
  Reports sessions, streaks, gaps. Scolds for inactivity.
  Use from Claude Code to monitor work hygiene.
  Triggery: "pomodoro check", "jak z pomodoro", "czy pracuję",
  "focus check", "ile pomodoro", "higiena pracy".
---

# Pomodoro Check — Agent Work Hygiene Monitor

## Purpose

This skill lets Claude Code (Atropa) query c3z's Pomodoro usage and hold him accountable.
Used proactively during morning routines, evening reviews, or when c3z seems distracted.

## How to Check (preferred: `agent-pomodoro` CLI)

API key is stored in sec. Always load it before running agent-pomodoro:

### Accountability score (PRIMARY check method)

Start here. This tells you how much of c3z's work time was protected by pomodoros:

```bash
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro accountability          # last 7 days
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro accountability --days 30 # last 30 days
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro accountability --shame   # include shame log (unprotected windows)
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro accountability --json    # machine-readable
```

Output: score %, verdict, protected/unprotected windows count.
With `--shame`: lists every unprotected work window with timestamps and duration.

### Quick status
```bash
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro status
```

### Stats for period
```bash
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro stats 7        # last 7 days
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro stats 30       # last 30 days
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro stats 7 --json # machine-readable
```

### Today's sessions
```bash
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro sessions today
```

### Recent sessions
```bash
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro sessions 20
```

### Active session check
```bash
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro active
```

Shows currently running session with elapsed/remaining time, or "No active session."

### Start / stop / interrupt sessions
```bash
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro start                      # default: work 25min
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro start work 45              # work 45min
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro start break                # break 5min
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro start longBreak            # longBreak 15min
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro stop --notes "deep coding" --tags "code,refactor"
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro interrupt                  # cancel active session
```

### Heartbeat (activity tracking)
```bash
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro heartbeat                  # single heartbeat
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro heartbeat --source atropa  # with source label
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro heartbeat --daemon         # send every 30s (background)
```

Heartbeats feed the accountability score. When an agent is running alongside c3z,
start a heartbeat daemon so the system knows work is happening. Unprotected heartbeat
windows (no pomodoro running) lower the accountability score.

### Configuration
```bash
agent-pomodoro config set-key apom_xxx     # set API key
agent-pomodoro config set-url <url>        # set custom Convex URL
agent-pomodoro config show                 # show current config
```

### LLM-friendly help
```bash
agent-pomodoro --help-llm    # full JSON schema for agents (no key needed)
```

## Complete CLI Command Reference

| Command | Description |
|---------|-------------|
| `status [--json]` | Quick summary (today + week + streak) |
| `stats [days] [--json]` | Detailed stats for period (default: 7 days) |
| `sessions today [--json]` | List today's sessions |
| `sessions [limit] [--json]` | Recent sessions (default: 20, max: 200) |
| `active [--json]` | Show currently running session |
| `start [type] [min] [--json]` | Start session (work/break/longBreak, default: work 25) |
| `stop [--notes "..."] [--tags "a,b"] [--json]` | Complete active session |
| `interrupt [--json]` | Cancel active session |
| `heartbeat [--daemon] [--source name]` | Send activity heartbeat |
| `accountability [--days N] [--shame] [--json]` | Accountability score + shame log |
| `config set-key <key>` | Set API key |
| `config set-url <url>` | Set Convex site URL |
| `config show` | Show current config |
| `--help-llm` | Full JSON schema for AI agents |
| `--help` | Human-readable help |

## Fallback: Direct Convex queries

If `agent-pomodoro` is not available, use direct Convex queries:

### Step 1: Get active userId
```bash
cd ~/P/agent-pomodoro && CONVEX_DEPLOYMENT=prod:efficient-wolf-51 npx convex run sessions:activeUserId '{}' 2>/dev/null
```
Use the returned userId in all subsequent queries. If null, no sessions exist yet.

### Agent summary (recommended — returns pre-formatted text)
```bash
cd ~/P/agent-pomodoro && CONVEX_DEPLOYMENT=prod:efficient-wolf-51 npx convex run sessions:agentSummary '{"userId": "USER_ID"}'
```

### Quick check (last 7 days stats)
```bash
cd ~/P/agent-pomodoro && CONVEX_DEPLOYMENT=prod:efficient-wolf-51 npx convex run sessions:stats '{"userId": "USER_ID", "sinceDaysAgo": 7}'
```

## Interpretation Rules

### Healthy patterns
- **4+ work sessions/day** = good focus hygiene
- **80%+ completion rate** = follows through, doesn't abandon
- **Streak >= 3 days** = building consistency
- **hoursSinceLastSession < 8** = recently active

### Warning signs (time to scold)
- **0 sessions today** = hasn't started working with focus
- **hoursSinceLastSession > 24** = hasn't used pomodoro in over a day
- **completionRate < 50%** = starts but doesn't finish (distraction pattern)
- **streak = 0** = broke the chain
- **avgSessionsPerDay < 2** = under-using the tool

### Response patterns

**When accountability score is low (<50%):**
"Cezary, accountability score: [X]%. [Y] okien pracy BEZ pomodoro.
Pracujesz, ale bez struktury. To jest chaos, nie higiena. Odpal timer."

**When accountability score is decent (50-80%):**
"Score [X]%, verdict: [verdict]. [Y] chronionych okien, [Z] bez ochrony.
Nie tragedia, ale jest gap. Odpal --shame żeby zobaczyć kiedy odpuszczasz."

**When accountability score is high (>80%):**
"Score [X]%. [Y] chronionych okien. Solidna dyscyplina. 🖤"

**When stats are bad (from status/stats):**
"Cezary, ostatnie pomodoro było [X] godzin temu. Masz [Y] sesji ten tydzień.
To nie jest higiena pracy — to jej brak. Odpal timer. Teraz."

**When stats are good:**
"[X] sesji, [Y]h focusu, streak [Z] dni. Tak trzymaj. 🖤"

**When no data at all:**
"Brak danych z Agent Pomodoro. Albo nie używasz, albo Convex nie jest skonfigurowany.
Jedno i drugie jest problemem."

## Integration with Morning/Evening

### ps-morning integration
During morning startup, check yesterday's and today's stats.
If yesterday had 0 sessions — flag it.

### ps-evening integration
During evening close, report today's stats.
Compare with weekly average.
