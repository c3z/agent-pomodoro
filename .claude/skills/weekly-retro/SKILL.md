---
name: weekly-retro
description: Generate AI-interpreted weekly focus retrospective.
  Use at end of week or when user asks about weekly patterns.
  Triggery: "retro", "weekly review", "how was my week", "podsumowanie tygodnia".
---

# Weekly Retrospective

## When to use
- End of week (Friday/Sunday)
- When c3z asks "how was my week", "podsumowanie tygodnia", "weekly review"
- When checking for patterns or regressions

## Workflow

1. Run `apom retro --json` to get structured data
2. Run `apom trends --json` to get regression detection
3. Run `apom debt --json` to check accumulated debt
4. Interpret the data and generate narrative insights

## Interpretation guidelines

Focus on:
- **Patterns**: Which days were productive? Which hours? Any consistency?
- **Regressions**: Did completion rate or volume drop? Why might that be?
- **Wins**: What went well? Celebrate consistency over hero mode.
- **Debt**: Is pomodoro debt accumulating? Suggest realistic catch-up plan.
- **Recommendations**: Concrete suggestions for next week based on data.

## Output format

Generate a narrative summary in Polish (match c3z's language preference).
Include:
- One-line verdict (good week / average / needs work)
- Key numbers (sessions, focus hours, completion rate)
- Pattern observations
- Comparison with previous week
- 2-3 actionable recommendations for next week

## Example

```
Tydzien byl sredniak. 16/20 sesji (80%), 6.7h focusu. Completion rate stabilny,
ale volume spadl o 5 sesji vs poprzedni tydzien. Piatek i sobota prawie puste.

Najlepsze godziny: 9-11 (92% completion). Po 15:00 spada do 60%.
Dominujacy tag: code (10 sesji), zero "writing" — moze warto zaplanowac?

Na nastepny tydzien:
1. Zacznij od pomodoro przed 10:00 (twoj sweet spot)
2. Dodaj chociaz 2 sesje "writing" lub "planning"
3. Piatek: minimum 3 pomodoro (ostatnio 0)
```

## Integration

Can be combined with `daily-summary --obsidian` for weekly note in Obsidian.
