import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";

async function hashApiKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// CORS: wildcard origin is intentional — REST API is designed for CLI/agent
// access with Bearer token auth, not browser-session auth.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
} as const;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function corsPreflightResponse() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

type AuthResult = { userId: string; keyId: string };

async function authenticateRequest(
  ctx: ActionCtx,
  request: Request
): Promise<AuthResult | Response> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse(
      { error: "Missing or invalid Authorization header. Use: Bearer apom_xxx" },
      401
    );
  }

  const apiKey = authHeader.slice(7).trim();
  if (!apiKey.startsWith("apom_")) {
    return jsonResponse({ error: "Invalid API key format. Keys start with apom_" }, 401);
  }

  const keyHash = await hashApiKey(apiKey);
  const result = await ctx.runQuery(internal.apiKeys.validateByHash, { keyHash });
  if (!result) {
    return jsonResponse({ error: "Invalid or revoked API key" }, 401);
  }

  // Fire-and-forget: lastUsedAt is best-effort, errors are non-critical
  ctx.runMutation(internal.apiKeys.touchLastUsed, { keyId: result.keyId }).catch(() => {});

  return result as AuthResult;
}

const http = httpRouter();

// CORS preflight for all endpoints
for (const path of ["/api/status", "/api/stats", "/api/sessions/today", "/api/sessions", "/api/sessions/start", "/api/sessions/complete", "/api/sessions/interrupt", "/api/activity/heartbeat", "/api/activity/accountability", "/api/activity/shame"]) {
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async () => corsPreflightResponse()),
  });
}

// GET /api/status — agent summary (text)
http.route({
  path: "/api/status",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const summary = await ctx.runQuery(api.sessions.agentSummary, {
      userId: auth.userId,
    });
    return jsonResponse({ status: summary });
  }),
});

// GET /api/stats?days=7 — statistics
http.route({
  path: "/api/stats",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get("days") ?? "7", 10);
    const sinceDaysAgo = isNaN(days) || days < 1 ? 7 : Math.min(days, 365);
    const stats = await ctx.runQuery(api.sessions.stats, {
      userId: auth.userId,
      sinceDaysAgo,
    });
    return jsonResponse(stats);
  }),
});

// GET /api/sessions/today — today's sessions
http.route({
  path: "/api/sessions/today",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const sessions = await ctx.runQuery(api.sessions.todayByUser, {
      userId: auth.userId,
    });
    return jsonResponse({ sessions });
  }),
});

// GET /api/sessions?limit=50 — recent sessions
http.route({
  path: "/api/sessions",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const safeLimit = isNaN(limit) || limit < 1 ? 50 : Math.min(limit, 200);
    const sessions = await ctx.runQuery(api.sessions.listByUser, {
      userId: auth.userId,
      limit: safeLimit,
    });
    return jsonResponse({ sessions });
  }),
});

// POST /api/sessions/start — start a new session
http.route({
  path: "/api/sessions/start",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const type = body.type;
    if (!["work", "break", "longBreak"].includes(type)) {
      return jsonResponse({ error: "type must be work, break, or longBreak" }, 400);
    }

    const durationMinutes = body.durationMinutes ?? (type === "work" ? 25 : type === "break" ? 5 : 15);
    if (typeof durationMinutes !== "number" || durationMinutes < 1 || durationMinutes > 120) {
      return jsonResponse({ error: "durationMinutes must be 1-120" }, 400);
    }

    const sessionId = await ctx.runMutation(api.sessions.start, {
      userId: auth.userId,
      type,
      durationMinutes,
    });

    return jsonResponse({ sessionId, type, durationMinutes }, 201);
  }),
});

// POST /api/sessions/complete — complete a session
http.route({
  path: "/api/sessions/complete",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    if (!body.sessionId) {
      return jsonResponse({ error: "sessionId is required" }, 400);
    }

    try {
      await ctx.runMutation(api.sessions.complete, {
        sessionId: body.sessionId,
        userId: auth.userId,
        notes: body.notes,
        tags: body.tags,
      });
    } catch (e: any) {
      return jsonResponse({ error: e.message || "Failed to complete session" }, 400);
    }

    return jsonResponse({ ok: true });
  }),
});

// POST /api/sessions/interrupt — interrupt a session
http.route({
  path: "/api/sessions/interrupt",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    if (!body.sessionId) {
      return jsonResponse({ error: "sessionId is required" }, 400);
    }

    try {
      await ctx.runMutation(api.sessions.interrupt, {
        sessionId: body.sessionId,
        userId: auth.userId,
      });
    } catch (e: any) {
      return jsonResponse({ error: e.message || "Failed to interrupt session" }, 400);
    }

    return jsonResponse({ ok: true });
  }),
});

// POST /api/activity/heartbeat — record work activity
http.route({
  path: "/api/activity/heartbeat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // source is optional — allow empty body
    }

    const source =
      typeof body.source === "string" && body.source.length > 0
        ? body.source.slice(0, 64)
        : "unknown";
    const timestamp = Date.now();

    const result = await ctx.runMutation(internal.activity.recordHeartbeat, {
      userId: auth.userId,
      source,
      timestamp,
    });

    return jsonResponse({ ok: true, ...result });
  }),
});

// GET /api/activity/accountability?days=7
http.route({
  path: "/api/activity/accountability",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get("days") ?? "7", 10);
    const sinceDaysAgo = isNaN(days) || days < 1 ? 7 : Math.min(days, 90);

    const result = await ctx.runQuery(internal.activity.getAccountability, {
      userId: auth.userId,
      sinceDaysAgo,
    });

    return jsonResponse(result);
  }),
});

// GET /api/activity/shame?days=7
http.route({
  path: "/api/activity/shame",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get("days") ?? "7", 10);
    const sinceDaysAgo = isNaN(days) || days < 1 ? 7 : Math.min(days, 90);

    const result = await ctx.runQuery(internal.activity.getShameLog, {
      userId: auth.userId,
      sinceDaysAgo,
    });

    return jsonResponse(result);
  }),
});

export default http;
