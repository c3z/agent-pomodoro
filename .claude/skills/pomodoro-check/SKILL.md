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

---

## MANDATORY: Conversation Start (run at the START of every Claude Code conversation)

This is non-negotiable. Every conversation begins with this sequence:

### Step 1: Check active session
```bash
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro active
```

### Step 2: Auto-start if needed
If **no active session** and it's during work hours (9:00-18:00 CET):
1. Do NOT ask — just start: `APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro start work 25`
2. Inform c3z briefly: "Odpalam pomodoro."

If a session IS active, note the task and remaining time — use it as context.

### Step 3: Set task from first user message
Extract the task description from the user's first message. Infer, do not ask.

**Examples:**
- "fix the auth bug" --> `APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro task set "Fix auth bug"`
- "add dark mode" --> `APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro task set "Add dark mode"`
- "implement sprint 26" --> `APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro task set "Sprint 26 implementation"`
- "review the PR" --> `APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro task set "PR review"`
- casual chat / no clear task --> skip task set

**Rules:**
- Capitalize first letter, keep it concise (3-8 words)
- Strip filler words ("can you", "please", "I want to")
- If user's message implies a task, set it — even if they didn't explicitly ask for pomodoro
- If the task changes mid-conversation, update it with another `task set`

### Step 4: Follow up with status
```bash
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro status
```

---

## CONVERSATION END: Auto-stop with context

When the conversation is ending (user says goodbye, task is done, or conversation naturally wraps up):

1. Invoke the **auto-tag** skill to generate tags and notes from git context
2. If auto-tag is not applicable (no git changes), manually suggest:
   ```bash
   APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro stop --notes "summary of what was done" --tags "relevant,tags"
   ```
3. Generate notes from the conversation: what was discussed, what was accomplished
4. Generate tags from the work done (use vocabulary: code, backend, frontend, tests, docs, refactor, feature, fix, config, review, planning, debug)

**Example end-of-conversation suggestion:**
"Kończę sesję: `apom stop --notes 'Implemented sprint 26: auto-start, task capture, auto-tag skills' --tags 'feature,docs,config'`"

---

## Task Auto-Capture

The agent should continuously track what c3z is working on and keep the pomodoro task updated.

### Capture patterns
- **Explicit task:** "fix bug in auth" --> set immediately
- **Implicit task:** "let's look at the timer component" --> `task set "Investigating timer component"`
- **Sprint work:** "implement sprint 26" --> `task set "Sprint 26: [first item description]"`
- **Review work:** "review PR #42" --> `task set "Review PR #42"`
- **Debugging:** "why is this failing" --> `task set "Debug: [context from conversation]"`

### Update triggers
- Task clearly shifts mid-conversation --> update with new `task set`
- User explicitly asks to change focus --> update immediately
- Do NOT update on every small sub-task — only when the main focus changes

---

## Proactive Check (legacy — now part of Conversation Start)

Run `agent-pomodoro active` at the start of **every** conversation. This is the PRIMARY check — do it before anything else.

```bash
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro active
```

If no session is active and it's during work hours (9:00-18:00 CET):
1. Do NOT ask — just start it: `agent-pomodoro start work 25`
2. Set task from first user message via `agent-pomodoro task set "..."`
3. If a session IS active, note the task and remaining time — use it as context.

Then follow up with `agent-pomodoro status` for the full picture.

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
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro start work 25 --task "building feature X"  # with task
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro start work 45              # work 45min
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro start break                # break 5min
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro start longBreak            # longBreak 15min
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro task set "refactoring auth module"  # update task mid-session
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
| `me [--json]` | Show authenticated user ID + key ID |
| `status [--json]` | Quick summary (today + week + streak) |
| `stats [days] [--json]` | Detailed stats for period (default: 7 days) |
| `sessions today [--json]` | List today's sessions |
| `sessions [limit] [--json]` | Recent sessions (default: 20, max: 200) |
| `active [--json]` | Show currently running session |
| `start [type] [min] [--task "..."] [--json]` | Start session (work/break/longBreak, default: work 25) |
| `task set "description" [--json]` | Set/update task on active session |
| `stop [--notes "..."] [--tags "a,b"] [--json]` | Complete active session |
| `interrupt [--json]` | Cancel active session |
| `heartbeat [--daemon] [--source name]` | Send activity heartbeat |
| `accountability [--days N] [--shame] [--json]` | Accountability score + shame log |
| `config set-key <key>` | Set API key |
| `config set-url <url>` | Set Convex site URL |
| `config show` | Show current config |
| `--help-llm` | Full JSON schema for AI agents |
| `--help` | Human-readable help |

### Get authenticated user info
```bash
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro me           # user ID + key ID
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro me --json    # machine-readable
```

Use `apom me` instead of the deprecated `activeUserId` internal query.

## Fallback: Direct Convex queries

If `agent-pomodoro` is not available, use direct Convex queries:

### Step 1: Get active userId (DEPRECATED — use `apom me` instead)
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
