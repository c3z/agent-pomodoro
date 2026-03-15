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
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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
for (const path of ["/api/status", "/api/stats", "/api/sessions/today", "/api/sessions"]) {
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

export default http;
