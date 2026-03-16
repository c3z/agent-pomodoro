#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_PATH = join(homedir(), ".agent-pomodoro.json");
const DEFAULT_URL = "https://efficient-wolf-51.eu-west-1.convex.site";

// ── Config ──────────────────────────────────────────────────────────

function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
}

function getApiKey() {
  const envKey = process.env.APOM_API_KEY;
  if (envKey) return envKey;
  const config = loadConfig();
  return config.apiKey || null;
}

function getBaseUrl() {
  const envUrl = process.env.APOM_URL;
  if (envUrl) return envUrl;
  const config = loadConfig();
  return config.url || DEFAULT_URL;
}

// ── API Client ──────────────────────────────────────────────────────

function requireApiKey() {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("Error: No API key configured.");
    console.error("Run: agent-pomodoro config set-key <your-api-key>");
    console.error("Or set APOM_API_KEY environment variable.");
    process.exit(1);
  }
  return apiKey;
}

async function apiCall(path) {
  const apiKey = requireApiKey();
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const body = await res.text();
    try {
      const json = JSON.parse(body);
      console.error(`Error ${res.status}: ${json.error || body}`);
    } catch {
      console.error(`Error ${res.status}: ${body}`);
    }
    process.exit(1);
  }

  return res.json();
}

async function apiPost(path, data) {
  const apiKey = requireApiKey();
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.text();
    try {
      const json = JSON.parse(body);
      console.error(`Error ${res.status}: ${json.error || body}`);
    } catch {
      console.error(`Error ${res.status}: ${body}`);
    }
    process.exit(1);
  }

  return res.json();
}

// ── Commands ────────────────────────────────────────────────────────

async function cmdStatus(args) {
  const data = await apiCall("/api/status");
  if (args.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(data.status);
  }
}

async function cmdStats(args) {
  const daysArg = args.find((a) => /^\d+d?$/.test(a));
  const days = daysArg ? parseInt(daysArg) : 7;
  const data = await apiCall(`/api/stats?days=${days}`);

  if (args.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(`Period: ${data.period}`);
    console.log(`Sessions: ${data.completedSessions}/${data.totalWorkSessions} (${data.completionRate}% completion)`);
    console.log(`Focus: ${data.totalFocusHours}h (${data.totalFocusMinutes}min)`);
    console.log(`Streak: ${data.currentStreak} days`);
    console.log(`Avg/day: ${data.avgSessionsPerDay}`);
    if (data.hoursSinceLastSession !== null) {
      console.log(`Last session: ${data.hoursSinceLastSession}h ago`);
    }
  }
}

async function cmdSessions(args) {
  const subCmd = args[0];

  if (subCmd === "today") {
    const data = await apiCall("/api/sessions/today");
    if (args.includes("--json")) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      if (data.sessions.length === 0) {
        console.log("No sessions today.");
      } else {
        for (const s of data.sessions) {
          const time = new Date(s.startedAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
          const status = s.completed ? "done" : s.interrupted ? "interrupted" : "active";
          const tags = s.tags?.length ? ` [${s.tags.join(", ")}]` : "";
          console.log(`${time} ${s.durationMinutes}min ${s.type} (${status})${tags}`);
        }
      }
    }
  } else {
    const limitArg = args.find((a) => /^\d+$/.test(a));
    const limit = limitArg ? parseInt(limitArg) : 20;
    const data = await apiCall(`/api/sessions?limit=${limit}`);

    if (args.includes("--json")) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      if (data.sessions.length === 0) {
        console.log("No sessions found.");
      } else {
        for (const s of data.sessions) {
          const date = new Date(s.startedAt).toLocaleDateString("pl-PL");
          const time = new Date(s.startedAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
          const status = s.completed ? "done" : s.interrupted ? "interrupted" : "active";
          const tags = s.tags?.length ? ` [${s.tags.join(", ")}]` : "";
          console.log(`${date} ${time} ${s.durationMinutes}min ${s.type} (${status})${tags}`);
        }
      }
    }
  }
}

async function cmdActive(args) {
  const data = await apiCall("/api/sessions/active");
  if (args.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
  } else if (data.session) {
    const s = data.session;
    const elapsed = Math.round((Date.now() - s.startedAt) / 60000);
    const remaining = Math.max(0, s.durationMinutes - elapsed);
    console.log(`Active: ${s.type} session (${s.durationMinutes}min)`);
    console.log(`Elapsed: ${elapsed}min, Remaining: ${remaining}min`);
    if (s.currentTask) {
      console.log(`Task: ${s.currentTask}`);
    }
  } else {
    console.log("No active session.");
  }
}

async function cmdStart(args) {
  const type = args[0] || "work";
  if (!["work", "break", "longBreak"].includes(type)) {
    console.error("Usage: agent-pomodoro start [work|break|longBreak] [minutes] [--task \"...\"]");
    process.exit(1);
  }

  const durationArg = args.find((a) => /^\d+$/.test(a));
  const durationMinutes = durationArg
    ? parseInt(durationArg)
    : type === "work" ? 25 : type === "break" ? 5 : 15;

  const taskIdx = args.indexOf("--task");
  const currentTask = taskIdx >= 0 ? args[taskIdx + 1] : undefined;

  const body = { type, durationMinutes };
  if (currentTask) body.currentTask = currentTask;

  const data = await apiPost("/api/sessions/start", body);

  // Track active session locally
  const config = loadConfig();
  config.activeSession = {
    sessionId: data.sessionId,
    type,
    durationMinutes,
    startedAt: Date.now(),
  };
  saveConfig(config);

  if (args.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(`Started ${type} session (${durationMinutes}min)`);
    if (currentTask) console.log(`Task: ${currentTask}`);
    console.log(`Session: ${data.sessionId}`);
  }
}

async function cmdTask(args) {
  const subCmd = args[0];
  if (subCmd !== "set" || !args[1]) {
    console.error("Usage: agent-pomodoro task set \"description\"");
    process.exit(1);
  }

  const currentTask = args.slice(1).filter((a) => a !== "--json").join(" ");
  const data = await apiPost("/api/sessions/task", { currentTask });

  if (args.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(`Task set: ${currentTask}`);
    console.log(`Session: ${data.sessionId}`);
  }
}

async function cmdStop(args) {
  const config = loadConfig();
  const active = config.activeSession;

  if (!active) {
    console.error("No active session. Start one with: agent-pomodoro start");
    process.exit(1);
  }

  const notesIdx = args.indexOf("--notes");
  const notes = notesIdx >= 0 ? args[notesIdx + 1] : undefined;

  const tagsIdx = args.indexOf("--tags");
  const tagsArg = tagsIdx >= 0 ? args[tagsIdx + 1] : undefined;
  const tags = tagsArg
    ? tagsArg.split(",").map((t) => t.trim()).filter(Boolean)
    : undefined;

  await apiPost("/api/sessions/complete", {
    sessionId: active.sessionId,
    notes,
    tags,
  });

  const elapsed = Math.round((Date.now() - active.startedAt) / 60000);
  delete config.activeSession;
  saveConfig(config);

  if (args.includes("--json")) {
    console.log(JSON.stringify({ ok: true, type: active.type, elapsed }));
  } else {
    console.log(`Completed ${active.type} session (${elapsed}min elapsed)`);
  }
}

async function cmdInterrupt(args) {
  const config = loadConfig();
  const active = config.activeSession;

  if (!active) {
    console.error("No active session to interrupt.");
    process.exit(1);
  }

  await apiPost("/api/sessions/interrupt", {
    sessionId: active.sessionId,
  });

  delete config.activeSession;
  saveConfig(config);

  if (args.includes("--json")) {
    console.log(JSON.stringify({ ok: true, interrupted: active.type }));
  } else {
    console.log(`Interrupted ${active.type} session.`);
  }
}

async function cmdHeartbeat(args) {
  const sourceIdx = args.indexOf("--source");
  const source = sourceIdx >= 0 ? args[sourceIdx + 1] : "apom-cli";
  const daemon = args.includes("--daemon");

  const sendHeartbeat = async () => {
    try {
      await apiPost("/api/activity/heartbeat", { source });
    } catch {
      // fire-and-forget — silent on failure
    }
  };

  if (daemon) {
    // Daemon mode: send heartbeat every 30 seconds
    await sendHeartbeat();
    setInterval(sendHeartbeat, 30_000);
    // Keep process alive
    process.on("SIGINT", () => process.exit(0));
    process.on("SIGTERM", () => process.exit(0));
  } else {
    await sendHeartbeat();
  }
}

async function cmdAccountability(args) {
  const daysIdx = args.indexOf("--days");
  const days = daysIdx >= 0 ? parseInt(args[daysIdx + 1]) : 7;
  const showShame = args.includes("--shame");

  const data = await apiCall(`/api/activity/accountability?days=${days}`);

  if (args.includes("--json")) {
    if (showShame) {
      const shame = await apiCall(`/api/activity/shame?days=${days}`);
      console.log(JSON.stringify({ ...data, shame }, null, 2));
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
    return;
  }

  console.log(`Accountability Score: ${data.score}%`);
  console.log(`Verdict: ${data.verdict}`);
  console.log(`Period: ${data.period || days + "d"}`);
  console.log(`Protected windows: ${data.protectedWindows ?? 0}`);
  console.log(`Unprotected windows: ${data.unprotectedWindows ?? 0}`);

  if (data.totalWindows !== undefined) {
    console.log(`Total windows: ${data.totalWindows}`);
  }

  if (showShame) {
    const shame = await apiCall(`/api/activity/shame?days=${days}`);
    if (shame.shameWindows && shame.shameWindows.length > 0) {
      console.log(`\nShame log (${shame.shameWindows.length} unprotected windows):`);
      for (const w of shame.shameWindows) {
        const start = new Date(w.startedAt).toLocaleString("pl-PL");
        const end = new Date(w.endedAt).toLocaleString("pl-PL");
        console.log(`  ${start} — ${end} (${w.durationMinutes}min)`);
      }
    } else {
      console.log("\nNo shame windows. Good job.");
    }
  }
}

function cmdConfig(args) {
  const subCmd = args[0];

  if (subCmd === "set-key") {
    const key = args[1];
    if (!key) {
      console.error("Usage: agent-pomodoro config set-key <api-key>");
      process.exit(1);
    }
    const config = loadConfig();
    config.apiKey = key;
    saveConfig(config);
    console.log(`API key saved to ${CONFIG_PATH}`);
  } else if (subCmd === "set-url") {
    const url = args[1];
    if (!url) {
      console.error("Usage: agent-pomodoro config set-url <convex-site-url>");
      process.exit(1);
    }
    const config = loadConfig();
    config.url = url;
    saveConfig(config);
    console.log(`URL saved to ${CONFIG_PATH}`);
  } else if (subCmd === "show") {
    const config = loadConfig();
    const apiKey = getApiKey();
    console.log(`Config: ${CONFIG_PATH}`);
    console.log(`URL: ${getBaseUrl()}`);
    console.log(`API Key: ${apiKey ? apiKey.slice(0, 12) + "..." : "(not set)"}`);
  } else {
    console.log("Usage:");
    console.log("  agent-pomodoro config set-key <api-key>  Set API key");
    console.log("  agent-pomodoro config set-url <url>      Set Convex site URL");
    console.log("  agent-pomodoro config show               Show current config");
  }
}

function cmdHelpLlm() {
  const schema = {
    name: "agent-pomodoro",
    version: "0.3.0",
    description: "CLI for AI agents to query and control Agent Pomodoro focus sessions",
    base_url: getBaseUrl(),
    auth: {
      type: "bearer",
      header: "Authorization: Bearer <apom_api_key>",
      setup: "agent-pomodoro config set-key <key>",
      env_var: "APOM_API_KEY",
    },
    commands: [
      {
        name: "status",
        description: "Quick summary: today's pomodoros, week stats, streak, last session",
        usage: "agent-pomodoro status [--json]",
        endpoint: "GET /api/status",
        response_example: {
          status: "Today: 3 pomodoros completed\nWeek: 12/15 sessions (80% completion), 5.0h focus\nStreak: 3 days\nLast session: 1.2h ago",
        },
      },
      {
        name: "stats",
        description: "Detailed statistics for a period",
        usage: "agent-pomodoro stats [days] [--json]",
        endpoint: "GET /api/stats?days=N",
        parameters: { days: { type: "integer", default: 7, max: 3650 } },
        response_example: {
          period: "7d",
          totalWorkSessions: 15,
          completedSessions: 12,
          interruptedSessions: 3,
          completionRate: 80,
          totalFocusMinutes: 300,
          totalFocusHours: 5.0,
          currentStreak: 3,
          lastSessionAt: 1710500000000,
          hoursSinceLastSession: 1.2,
          avgSessionsPerDay: 2.1,
        },
      },
      {
        name: "sessions today",
        description: "List today's pomodoro sessions",
        usage: "agent-pomodoro sessions today [--json]",
        endpoint: "GET /api/sessions/today",
      },
      {
        name: "sessions",
        description: "List recent sessions",
        usage: "agent-pomodoro sessions [limit] [--json]",
        endpoint: "GET /api/sessions?limit=N",
        parameters: { limit: { type: "integer", default: 20, max: 200 } },
      },
      {
        name: "active",
        description: "Show currently active (running) session with elapsed/remaining time",
        usage: "agent-pomodoro active [--json]",
        endpoint: "GET /api/sessions/active",
        response_example: {
          session: { _id: "abc123", type: "work", durationMinutes: 25, startedAt: 1710500000000, completed: false, interrupted: false },
        },
      },
      {
        name: "start",
        description: "Start a new pomodoro session (creates it on server, tracks locally). Idempotent: returns existing session if same type is already active. Returns 409 if different type is active.",
        usage: "agent-pomodoro start [work|break|longBreak] [minutes] [--task \"description\"] [--json]",
        endpoint: "POST /api/sessions/start",
        parameters: {
          type: { type: "string", default: "work", enum: ["work", "break", "longBreak"] },
          durationMinutes: { type: "integer", default: 25 },
          currentTask: { type: "string", optional: true, description: "What the user is working on (max 200 chars)" },
        },
        response_example: { sessionId: "abc123", type: "work", durationMinutes: 25, currentTask: "building feature X" },
      },
      {
        name: "task set",
        description: "Set or update the current task description on the active session",
        usage: "agent-pomodoro task set \"description\" [--json]",
        endpoint: "POST /api/sessions/task",
        parameters: {
          currentTask: { type: "string", required: true, description: "Task description (max 200 chars)" },
        },
        response_example: { ok: true, sessionId: "abc123", currentTask: "building feature X" },
      },
      {
        name: "stop",
        description: "Complete the active session with optional notes and tags",
        usage: "agent-pomodoro stop [--notes 'text'] [--tags 'code,deep-work'] [--json]",
        endpoint: "POST /api/sessions/complete",
      },
      {
        name: "interrupt",
        description: "Interrupt (cancel) the active session",
        usage: "agent-pomodoro interrupt [--json]",
        endpoint: "POST /api/sessions/interrupt",
      },
      {
        name: "heartbeat",
        description: "Send activity heartbeat to track work presence. Silent on success.",
        usage: "agent-pomodoro heartbeat [--daemon] [--source <name>]",
        endpoint: "POST /api/activity/heartbeat",
        parameters: {
          source: { type: "string", default: "apom-cli", description: "Heartbeat source identifier" },
          daemon: { type: "boolean", default: false, description: "Run in loop, sending every 30s" },
        },
      },
      {
        name: "accountability",
        description: "Get accountability score — how much work time was protected by pomodoros",
        usage: "agent-pomodoro accountability [--days N] [--shame] [--json]",
        endpoint: "GET /api/activity/accountability",
        parameters: {
          days: { type: "integer", default: 7, max: 90 },
          shame: { type: "boolean", default: false, description: "Include shame log of unprotected windows" },
        },
        response_example: {
          score: 73,
          verdict: "inconsistent",
          protectedWindows: 61,
          unprotectedWindows: 23,
          totalWindows: 84,
          period: "7d",
        },
      },
      {
        name: "config",
        description: "Manage CLI configuration",
        subcommands: [
          { name: "set-key", usage: "agent-pomodoro config set-key <api-key>" },
          { name: "set-url", usage: "agent-pomodoro config set-url <convex-site-url>" },
          { name: "show", usage: "agent-pomodoro config show" },
        ],
      },
    ],
    tips: [
      "Use --json flag for machine-readable output on any command",
      "Set APOM_API_KEY env var instead of config file for CI/agents",
      "Default period for stats is 7 days",
      "Start + stop workflow: agent-pomodoro start work 25, then agent-pomodoro stop --notes 'done'",
      "Active session ID is stored in ~/.agent-pomodoro.json",
    ],
  };

  console.log(JSON.stringify(schema, null, 2));
}

function cmdHelp() {
  console.log(`agent-pomodoro — Agent Pomodoro CLI

Usage:
  agent-pomodoro status              Quick summary (today, week, streak)
  agent-pomodoro stats [days]        Detailed stats (default: 7 days)
  agent-pomodoro sessions today      Today's sessions
  agent-pomodoro sessions [limit]    Recent sessions (default: 20)
  agent-pomodoro active              Show currently active session
  agent-pomodoro start [type] [min]  Start a session (default: work 25)
  agent-pomodoro start work 25 --task "desc"  Start with task description
  agent-pomodoro task set "desc"     Set task on active session
  agent-pomodoro stop [--notes ...]  Complete active session
  agent-pomodoro interrupt           Interrupt active session
  agent-pomodoro heartbeat           Send activity heartbeat
  agent-pomodoro heartbeat --daemon  Heartbeat every 30s (background)
  agent-pomodoro accountability      Accountability score (default: 7d)
  agent-pomodoro accountability --shame  Include shame log
  agent-pomodoro config set-key <k>  Set API key
  agent-pomodoro config set-url <u>  Set server URL
  agent-pomodoro config show         Show config
  agent-pomodoro --help-llm          JSON schema for AI agents
  agent-pomodoro --help              This help

Flags:
  --json                Machine-readable JSON output
  --task "text"         Task description for start command
  --notes "text"        Notes for stop command
  --tags "a,b,c"        Tags for stop command (comma-separated)
  --source "name"       Heartbeat source (default: apom-cli)
  --days N              Period for accountability (default: 7)
  --shame               Include shame log in accountability
  --daemon              Run heartbeat in loop (every 30s)

Env vars:
  APOM_API_KEY    API key (overrides config file)
  APOM_URL        Server URL (overrides config file)

Config: ~/.agent-pomodoro.json`);
}

// ── Main ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const cmd = args[0];

if (!cmd || cmd === "--help" || cmd === "-h") {
  cmdHelp();
} else if (cmd === "--help-llm") {
  cmdHelpLlm();
} else if (cmd === "status") {
  await cmdStatus(args.slice(1));
} else if (cmd === "stats") {
  await cmdStats(args.slice(1));
} else if (cmd === "sessions") {
  await cmdSessions(args.slice(1));
} else if (cmd === "active") {
  await cmdActive(args.slice(1));
} else if (cmd === "start") {
  await cmdStart(args.slice(1));
} else if (cmd === "task") {
  await cmdTask(args.slice(1));
} else if (cmd === "stop" || cmd === "complete") {
  await cmdStop(args.slice(1));
} else if (cmd === "interrupt" || cmd === "cancel") {
  await cmdInterrupt(args.slice(1));
} else if (cmd === "heartbeat") {
  await cmdHeartbeat(args.slice(1));
} else if (cmd === "accountability") {
  await cmdAccountability(args.slice(1));
} else if (cmd === "config") {
  cmdConfig(args.slice(1));
} else {
  console.error(`Unknown command: ${cmd}`);
  console.error("Run: agent-pomodoro --help");
  process.exit(1);
}
