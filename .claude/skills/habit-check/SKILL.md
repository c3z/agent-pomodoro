---
name: habit-check
description: |
  Checks c3z's habit compliance (Huberman protocol).
  Reports today's habits, completion rate, cycle status.
  Scolds when below 85% target or missing linchpin habits.
  Triggery: "habit check", "jak z nawykami", "habits",
  "nawyki", "czy ćwiczę", "huberman check".
---

# Habit Check — Agent Habit Accountability

## Purpose

This skill lets Claude Code (Atropa) query c3z's habit tracker and enforce the Huberman protocol.
Complement to pomodoro-check — habits are the behavior infrastructure that supports focus.

---

## MANDATORY: Check habits at conversation start

Run alongside pomodoro-check. After checking pomodoro status:

### Step 1: Get today's habit status
```bash
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro habits --json
```

### Step 2: Interpret and respond

**Parse the JSON response:**
- `total` — how many active habits (max 6)
- `done` — how many completed today
- `hubermanTarget.met` — is 85% threshold met?
- Each habit: `completed`, `phase` (hard/easy), `isLinchpin`, `cyclePhase`, `cycleDay`

---

## Interpretation Rules (Huberman Protocol)

### Healthy patterns
- **done/total >= 85%** (e.g. 5/6) = Huberman target met
- **All linchpin habits (★) done** = foundation solid
- **Hard habits done before noon** = Phase 1 compliance
- **cyclePhase: "established"** = habit is locked in, celebrate

### Warning signs (time to scold)
- **done/total < 85%** = below Huberman target
- **Linchpin habit (★) missed** = cascade risk — this affects everything
- **0/6 done past noon** = day is slipping
- **cyclePhase: "forming" + cycleDay > 14** = critical phase, missing now undoes progress
- **Multiple habits at cycleDay 1-7** = too many new habits at once

### Response patterns

**When habits are below target (<85%):**
"Cezary, nawyki dziś: [done]/[total] ([pct]%). Huberman target: 85%.
[Missed linchpin]: to jest nawyk-klucz. Bez niego reszta się sypie. Zrób to TERAZ."

**When linchpin is missed but others done:**
"[done]/[total] zrobione, ale [linchpin name] ★ pominięty.
To jest fundament — exercise → sleep → focus. Bez tego pomodoro idą gorzej.
Zrobiłeś? `agent-pomodoro habits done \"[name]\"`"

**When all habits done:**
"Nawyki: [done]/[total] ✓ — Huberman target met. Solidna baza. 🖤"

**When no habits configured:**
"Zero nawyków w trackerze. Huberman mówi: max 6, zacznij od 2-3.
`agent-pomodoro habits add \"Exercise\" --phase hard --linchpin`"

**During forming phase (days 1-21):**
"[name] jest w fazie formowania (dzień [cycleDay]/21). To kluczowy okres.
Każdy dzień się liczy — nie odpuszczaj teraz."

---

## Habit × Pomodoro Correlation

When checking both systems, connect the dots:

- "Zauważ: w dniach z exercise, twoja completion rate pomodoro jest wyższa."
- "Brak snu (sleep habit missed) → focus drop → więcej interrupted sesji."
- "Linchpin habits zrobione → dzień produktywny. Pattern się powtarza."

---

## CLI Commands Reference

```bash
# Today's status (primary check)
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro habits

# Mark habit done (supports partial name matching)
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro habits done "exercise"

# Undo a checkin
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro habits undo "exercise"

# Completion stats (30 days)
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro habits stats

# 21-day cycle status
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro habits cycle

# Add a new habit
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro habits add "Morning Qigong" --phase hard --linchpin

# Archive a habit
APOM_API_KEY=$(sec get APOM_API_KEY) agent-pomodoro habits archive "Old habit"
```

## Key Huberman Rules (enforce these)

1. **Max 6 active habits** — server enforces, but don't suggest adding 7th
2. **Target: 4-5 out of 6 (85%)** — not perfection, but consistent high bar
3. **No compensation** — missed 3 today? Tomorrow is still 6, not 9
4. **21-day cycles** — forming → testing → established (auto-advances daily)
5. **Hard habits in Phase 1** (morning) — don't let c3z do hard habits at 22:00
6. **Linchpin habits cascade** — exercise affects sleep affects focus
7. **NO streak counter** — show % completion, never "X day streak"
