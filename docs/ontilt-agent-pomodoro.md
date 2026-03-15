# The Slot Machine Watches You Back

You set a timer. You ignore it. You tell yourself "five more minutes" and surface two hours later with seventeen open tabs, a half-refactored module, and no memory of what you originally intended.

Timers don't work because they're passive. They ring, you dismiss, the dark flow continues. There's no cost. No witness.

What if the timer had teeth? What if it reported to someone who doesn't forget, doesn't get tired, and has a PhD in making you uncomfortable?

## The accountability gap in AI-assisted work

The [AI Hygiene Checklist](https://ontilt.dev/blog/ai-hygiene-checklist/) names six dimensions of compulsive AI use. Dimension one — Loss of Control — recommends two practices:

1. **Session Timer**: A physical timer. 90-minute ultradian cycles. Walk to silence it.
2. **Pre-Session Contract**: Write down what you'll do before you start. Prevents drift.

Both depend on willpower. And willpower is exactly what dark flow erodes.

Research on self-monitoring (Harkin et al., 2016 — meta-analysis of 138 studies) shows that tracking behavior alone improves outcomes by 26%. But add an external observer — someone who checks your data and confronts you — and the effect doubles.

The problem: no human wants that job. Your colleague won't text you "you haven't focused in 3 days." Your manager doesn't track your pomodoro count. Nobody is watching the session log.

Except, now, something is.

## Agent Pomodoro: the tool that watches back

[Agent Pomodoro](https://github.com/c3z/agent-pomodoro) is a pomodoro timer built specifically to be monitored by AI agents. You run the sessions. The agent reads your data, evaluates your patterns, and holds you accountable.

It was built inside Claude Code, by Claude Code, as a hygiene tool for AI-assisted development work. The irony is intentional: the same AI agent that could enable dark flow is now the one measuring your focus discipline.

Here's what that looks like in practice:

```
$ agent-pomodoro status
Today: 3 pomodoros completed
Week: 12/15 sessions (80% completion), 5.0h focus
Streak: 4 days
Last session: 1.2h ago
```

That output isn't for you. It's for your AI agent. When it sees `0 sessions today` or `hoursSinceLastSession: 38`, it knows what to say. And it won't be gentle.

## How it works

The architecture is simple and deliberate:

**You** use the web app. Start a pomodoro. Focus for 25 minutes. Complete it. Add a note about what you did. Repeat.

**Your AI agent** queries the REST API or CLI. It sees your completion rate, your streak, your last session time, your daily pattern. It interprets the data against heuristics:

| Signal | Meaning |
|--------|---------|
| 4+ sessions/day | Healthy focus rhythm |
| 80%+ completion | Follows through, low distraction |
| 0 sessions today | Hasn't started focused work |
| completionRate < 50% | Starts but doesn't finish — classic dark flow indicator |
| hoursSinceLastSession > 24 | Tool abandoned |

The agent doesn't just read. It acts. During morning check-ins, it reviews yesterday's numbers. During evening close, it compares your day against your weekly average. When the data is bad, it says so directly.

This isn't gamification. There are no badges, no streaks displayed in celebration colors, no dopamine hooks. The data is clinical. The agent's interpretation is clinical. The whole point is to short-circuit the reward loop, not add to it.

## The pre-session contract, automated

Dimension one's second practice — writing down what you'll do before starting — maps to Agent Pomodoro's notes and tags. Each completed session asks: what did you work on?

Over time this creates an audit trail. Not of code changes (git has that) but of *intention*. Did you intend to fix a bug but end up "exploring" for an hour? The session log shows it. The agent sees the gap between tags and output.

This is behavioral specificity — the antidote to drift. OnTilt's checklist notes that "exploring" isn't a task. The session log makes that visible.

## Why an AI agent, not a human

Three reasons:

**It doesn't get tired.** A human accountability partner burns out. The agent checks your stats every conversation, forever.

**It has no social cost.** Telling your coworker you haven't focused in 3 days is embarrassing. Telling your AI agent is a data point. The shame is productive without being social.

**It already knows the context.** The AI agent that monitors your pomodoros is the same one helping you code. It knows when you're in a productive stretch and when you're spinning. It can connect "low focus today" to "you've been refactoring the same file for 6 hours."

## The uncomfortable part

This tool makes a bet: you're more likely to start a timer when something is watching.

That's not empowerment. That's surveillance — voluntarily installed, self-directed, but surveillance. The fact that it works (and it does — external monitoring consistently outperforms self-monitoring in behavioral research) says something uncomfortable about autonomy.

The OnTilt framework names this tension explicitly. AI tools can create compulsive patterns. The fix for AI-induced compulsion is... more AI? An agent watching you so you don't lose yourself in the agent?

Yes. Because the alternative is doing nothing, and we know how that goes.

The slot machine doesn't care about your focus. The agent does. That's the difference.

## Getting started

```bash
npm install -g agent-pomodoro
agent-pomodoro config set-key <your-api-key>
agent-pomodoro status
```

Full source: [github.com/c3z/agent-pomodoro](https://github.com/c3z/agent-pomodoro) (MIT)

If you build AI agents — give them access to your pomodoro data. See what they say. You might not like it.

And that's the point.

---

*Agent Pomodoro is an open-source project built by [c3z](https://github.com/c3z). It implements practices from the [OnTilt AI Hygiene Checklist](https://ontilt.dev/blog/ai-hygiene-checklist/) — specifically session timing and external accountability — as working software. The project was built entirely inside Claude Code, including this article.*
