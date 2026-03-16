# agent-pomodoro-mcp

MCP (Model Context Protocol) server for Agent Pomodoro. Exposes pomodoro operations as native tools for Claude Desktop, Claude Code, and other MCP clients.

## Setup

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-pomodoro": {
      "command": "npx",
      "args": ["agent-pomodoro-mcp"],
      "env": {
        "APOM_API_KEY": "apom_your_key_here"
      }
    }
  }
}
```

### Claude Code

Add to `.claude/settings.json` or `~/.claude.json`:

```json
{
  "mcpServers": {
    "agent-pomodoro": {
      "command": "npx",
      "args": ["agent-pomodoro-mcp"]
    }
  }
}
```

### Config

Requires API key via one of:
- `APOM_API_KEY` environment variable
- `~/.agent-pomodoro.json` config file (same as CLI: `{"apiKey": "apom_xxx"}`)

Generate an API key at: https://agent-pomodoro.vercel.app/settings

## Tools

| Tool | Description |
|------|-------------|
| `pomodoro_status` | Quick summary — today's count, week stats, streak |
| `pomodoro_stats` | Detailed statistics for a period (default 7 days) |
| `pomodoro_active` | Check if a session is currently running |
| `pomodoro_start` | Start a new pomodoro session |
| `pomodoro_stop` | Complete the active session |
| `pomodoro_interrupt` | Interrupt (cancel) the active session |
| `pomodoro_heartbeat` | Send activity heartbeat |
| `pomodoro_accountability` | Accountability score (% of work time protected) |
| `pomodoro_goals` | Daily/weekly goals and progress |
| `pomodoro_nudges` | Pending nudges (idle warnings, reminders) |
| `habit_today` | Today's habits + completion status + Huberman target |
| `habit_checkin` | Mark a habit as done/undone for today |
| `habit_stats` | Habit completion rates + 21-day cycle status |

## Protocol

JSON-RPC 2.0 over stdio. Implements MCP protocol version `2024-11-05`.

## Custom URL

To point at a different Convex deployment (e.g. dev):

```json
{
  "env": {
    "APOM_URL": "https://your-deployment.convex.site"
  }
}
```

Or set in `~/.agent-pomodoro.json`:

```json
{
  "apiKey": "apom_xxx",
  "url": "https://your-deployment.convex.site"
}
```
