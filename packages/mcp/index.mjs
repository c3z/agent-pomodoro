#!/usr/bin/env node

// agent-pomodoro-mcp — MCP server for Agent Pomodoro
// Zero-dependency. JSON-RPC 2.0 over stdio.
// Config: ~/.agent-pomodoro.json (same as CLI) or env vars.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline";

// ── Config ──────────────────────────────────────────────────────────

const CONFIG_PATH = join(homedir(), ".agent-pomodoro.json");
const DEFAULT_URL = "https://efficient-wolf-51.eu-west-1.convex.site";

function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function getApiKey() {
  return process.env.APOM_API_KEY || loadConfig().apiKey || null;
}

function getBaseUrl() {
  return process.env.APOM_URL || loadConfig().url || DEFAULT_URL;
}

// ── API Client ──────────────────────────────────────────────────────

async function apiCall(path) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("No API key configured. Set APOM_API_KEY or add apiKey to ~/.agent-pomodoro.json");
  const res = await fetch(`${getBaseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const body = await res.text();
    let msg = `API error ${res.status}`;
    try { msg = `API error ${res.status}: ${JSON.parse(body).error}`; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

async function apiPost(path, data) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("No API key configured. Set APOM_API_KEY or add apiKey to ~/.agent-pomodoro.json");
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text();
    let msg = `API error ${res.status}`;
    try { msg = `API error ${res.status}: ${JSON.parse(body).error}`; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// ── Tools ───────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "pomodoro_status",
    description:
      "Get quick pomodoro status summary — today's count, week stats, streak, last session",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async () => apiCall("/api/status"),
  },
  {
    name: "pomodoro_stats",
    description: "Get detailed pomodoro statistics for a period",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of days to look back (default 7, max 365)",
        },
      },
    },
    handler: async (args) => apiCall(`/api/stats?days=${args.days || 7}`),
  },
  {
    name: "pomodoro_active",
    description:
      "Check if a pomodoro session is currently running. Returns the active session or null.",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async () => apiCall("/api/sessions/active"),
  },
  {
    name: "pomodoro_start",
    description:
      "Start a new pomodoro session. Safe to call if session already running — returns existing session if same type (idempotent). Returns 409 if different type is active.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["work", "break", "longBreak"],
          description: "Session type (default: work)",
        },
        durationMinutes: {
          type: "number",
          description:
            "Duration in minutes (default: 25 for work, 5 for break, 15 for longBreak)",
        },
        currentTask: {
          type: "string",
          description: "What you're working on (max 200 chars)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for the session (e.g. code, deep-work, writing)",
        },
      },
    },
    handler: async (args) =>
      apiPost("/api/sessions/start", {
        type: args.type || "work",
        durationMinutes: args.durationMinutes,
        currentTask: args.currentTask,
        tags: args.tags,
      }),
  },
  {
    name: "pomodoro_stop",
    description:
      "Complete (stop) the active pomodoro session. Requires sessionId — get it from pomodoro_active first.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description:
            "Session ID to complete (required — get from pomodoro_active)",
        },
        notes: {
          type: "string",
          description: "Completion notes",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags to add/set on the session",
        },
      },
      required: ["sessionId"],
    },
    handler: async (args) =>
      apiPost("/api/sessions/complete", {
        sessionId: args.sessionId,
        notes: args.notes,
        tags: args.tags,
      }),
  },
  {
    name: "pomodoro_interrupt",
    description:
      "Interrupt (cancel) the active pomodoro session. Requires sessionId — get it from pomodoro_active first.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description:
            "Session ID to interrupt (required — get from pomodoro_active)",
        },
        reason: {
          type: "string",
          description:
            "Why the session was interrupted (distraction, emergency, meeting, wrong task, other)",
        },
      },
      required: ["sessionId"],
    },
    handler: async (args) =>
      apiPost("/api/sessions/interrupt", {
        sessionId: args.sessionId,
        reason: args.reason,
      }),
  },
  {
    name: "pomodoro_heartbeat",
    description:
      "Send activity heartbeat to track work presence. Call periodically to record that user is active.",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description:
            "Heartbeat source identifier (default: mcp). Examples: claude-desktop, cursor, vscode",
        },
      },
    },
    handler: async (args) =>
      apiPost("/api/activity/heartbeat", {
        source: args.source || "mcp",
      }),
  },
  {
    name: "pomodoro_accountability",
    description:
      "Get accountability score — how much work time was protected by active pomodoro sessions. Score 0-100%.",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of days to look back (default 7, max 90)",
        },
      },
    },
    handler: async (args) =>
      apiCall(`/api/activity/accountability?days=${args.days || 7}`),
  },
  {
    name: "pomodoro_goals",
    description:
      "Get daily/weekly goals and current progress toward daily pomodoro and weekly focus hour targets",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async () => apiCall("/api/goals"),
  },
  {
    name: "pomodoro_nudges",
    description:
      "Get pending nudges (idle warnings, reminders). Nudges are generated by server cron every 30min during work hours. Fetching marks them as delivered.",
    inputSchema: { type: "object", properties: {}, required: [] },
    handler: async () => apiCall("/api/nudges"),
  },
];

// ── MCP JSON-RPC 2.0 Server (stdio) ────────────────────────────────

const SERVER_INFO = {
  name: "agent-pomodoro-mcp",
  version: "0.1.0",
};

function send(msg) {
  const json = JSON.stringify(msg);
  process.stdout.write(json + "\n");
}

function handleRequest(req) {
  const { method, id, params } = req;

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        },
      };

    case "notifications/initialized":
      // Notification — no response needed
      return null;

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        },
      };

    case "tools/call":
      // Handled async below
      return undefined;

    default:
      if (id !== undefined) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
      }
      // Unknown notification — ignore
      return null;
  }
}

async function handleToolCall(req) {
  const { id, params } = req;
  const tool = TOOLS.find((t) => t.name === params.name);

  if (!tool) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Unknown tool: ${params.name}` },
    };
  }

  try {
    const result = await tool.handler(params.arguments || {});
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      },
    };
  } catch (e) {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: `Error: ${e.message}` }],
        isError: true,
      },
    };
  }
}

// ── Main ────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin });

rl.on("line", async (line) => {
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    return;
  }

  if (req.method === "tools/call") {
    const response = await handleToolCall(req);
    send(response);
    return;
  }

  const response = handleRequest(req);
  if (response !== null && response !== undefined) {
    send(response);
  }
});

// Graceful shutdown
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
