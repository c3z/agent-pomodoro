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

## How to Check

### Step 1: Get active userId
```bash
cd ~/P/agent-pomodoro && CONVEX_DEPLOYMENT=prod:efficient-wolf-51 npx convex run sessions:activeUserId '{}' 2>/dev/null
```
Use the returned userId in all subsequent queries. If null, no sessions exist yet.

### Quick check (last 7 days stats)
```bash
cd ~/P/agent-pomodoro && CONVEX_DEPLOYMENT=prod:efficient-wolf-51 npx convex run sessions:stats '{"userId": "USER_ID", "sinceDaysAgo": 7}'
```

### Today's sessions
```bash
cd ~/P/agent-pomodoro && CONVEX_DEPLOYMENT=prod:efficient-wolf-51 npx convex run sessions:todayByUser '{"userId": "USER_ID"}'
```

### Recent sessions
```bash
cd ~/P/agent-pomodoro && CONVEX_DEPLOYMENT=prod:efficient-wolf-51 npx convex run sessions:listByUser '{"userId": "USER_ID", "limit": 20}'
```

### Agent summary (recommended — returns pre-formatted text)
```bash
cd ~/P/agent-pomodoro && CONVEX_DEPLOYMENT=prod:efficient-wolf-51 npx convex run sessions:agentSummary '{"userId": "USER_ID"}'
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

**When stats are bad:**
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
