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
for (const path of ["/api/me", "/api/status", "/api/stats", "/api/stats/tags", "/api/sessions/today", "/api/sessions", "/api/sessions/active", "/api/sessions/start", "/api/sessions/complete", "/api/sessions/interrupt", "/api/sessions/task", "/api/activity/heartbeat", "/api/activity/accountability", "/api/activity/shame", "/api/nudges", "/api/daily-summary", "/api/goals"]) {
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async () => corsPreflightResponse()),
  });
}

// GET /api/me — returns authenticated user info from API key
http.route({
  path: "/api/me",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    return jsonResponse({ userId: auth.userId, keyId: auth.keyId });
  }),
});

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

// GET /api/stats/tags?days=30 — tag analytics
http.route({
  path: "/api/stats/tags",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get("days") ?? "30", 10);
    const sinceDaysAgo = isNaN(days) || days < 1 ? 30 : Math.min(days, 365);
    const tags = await ctx.runQuery(api.sessions.tagAnalytics, {
      userId: auth.userId,
      sinceDaysAgo,
    });
    return jsonResponse({ tags, period: `${sinceDaysAgo}d` });
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

// GET /api/sessions/active — currently active (running) session
http.route({
  path: "/api/sessions/active",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const session = await ctx.runQuery(api.sessions.activeSession, {
      userId: auth.userId,
    });
    return jsonResponse({ session });
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

    const currentTask = typeof body.currentTask === "string" ? body.currentTask : undefined;
    const tags = Array.isArray(body.tags) ? body.tags.filter((t: any) => typeof t === "string") : undefined;

    let sessionId;
    try {
      sessionId = await ctx.runMutation(api.sessions.start, {
        userId: auth.userId,
        type,
        durationMinutes,
        ...(currentTask ? { currentTask } : {}),
        ...(tags && tags.length > 0 ? { tags } : {}),
      });
    } catch (e: any) {
      if (e.message?.startsWith("CONFLICT:")) {
        return jsonResponse({ error: e.message }, 409);
      }
      return jsonResponse({ error: e.message || "Failed to start session" }, 400);
    }

    return jsonResponse({ sessionId, type, durationMinutes, ...(currentTask ? { currentTask } : {}), ...(tags && tags.length > 0 ? { tags } : {}) }, 201);
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

    const reason = typeof body.reason === "string" ? body.reason : undefined;

    try {
      await ctx.runMutation(api.sessions.interrupt, {
        sessionId: body.sessionId,
        userId: auth.userId,
        ...(reason ? { reason } : {}),
      });
    } catch (e: any) {
      return jsonResponse({ error: e.message || "Failed to interrupt session" }, 400);
    }

    return jsonResponse({ ok: true });
  }),
});

// POST /api/sessions/task — set currentTask on active session
http.route({
  path: "/api/sessions/task",
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

    if (typeof body.currentTask !== "string") {
      return jsonResponse({ error: "currentTask (string) is required" }, 400);
    }

    try {
      const sessionId = await ctx.runMutation(api.sessions.setTask, {
        userId: auth.userId,
        currentTask: body.currentTask,
      });
      return jsonResponse({ ok: true, sessionId, currentTask: body.currentTask });
    } catch (e: any) {
      return jsonResponse({ error: e.message || "Failed to set task" }, 400);
    }
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

// GET /api/nudges — fetch pending nudges, mark as delivered
http.route({
  path: "/api/nudges",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;

    const nudges = await ctx.runQuery(internal.nudges.getPendingNudges, {
      userId: auth.userId,
    });

    // Mark as delivered
    if (nudges.length > 0) {
      const nudgeIds = nudges.map((n: any) => n._id);
      await ctx.runMutation(internal.nudges.markDelivered, { nudgeIds });
    }

    return jsonResponse({
      nudges: nudges.map((n: any) => ({
        type: n.type,
        message: n.message,
        createdAt: n.createdAt,
      })),
    });
  }),
});

// GET /api/daily-summary?date=YYYY-MM-DD — daily summary for a specific date
http.route({
  path: "/api/daily-summary",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");

    let targetDate: Date;
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      targetDate = new Date(dateParam + "T00:00:00");
    } else {
      targetDate = new Date();
    }
    targetDate.setHours(0, 0, 0, 0);
    const startTs = targetDate.getTime();
    const endTs = startTs + 24 * 60 * 60 * 1000;

    const dateStr = targetDate.toISOString().slice(0, 10);

    // Get sessions for the day
    const sessions = await ctx.runQuery(api.sessions.listByUser, {
      userId: auth.userId,
      limit: 200,
    });
    const daySessions = sessions.filter(
      (s: any) => s.startedAt >= startTs && s.startedAt < endTs
    );

    const workSessions = daySessions.filter((s: any) => s.type === "work");
    const completedWork = workSessions.filter((s: any) => s.completed);
    const interruptedWork = workSessions.filter((s: any) => s.interrupted);
    const totalFocusMin = completedWork.reduce(
      (sum: number, s: any) => sum + s.durationMinutes,
      0
    );

    // Tags breakdown
    const tagCounts: Record<string, number> = {};
    for (const s of completedWork) {
      if (s.tags) {
        for (const tag of s.tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }
    }

    // Accountability for the day
    const accountability = await ctx.runQuery(
      internal.activity.getAccountability,
      { userId: auth.userId, sinceDaysAgo: 1 }
    );

    return jsonResponse({
      date: dateStr,
      sessions: daySessions.map((s: any) => ({
        type: s.type,
        durationMinutes: s.durationMinutes,
        startedAt: s.startedAt,
        completed: s.completed,
        interrupted: s.interrupted,
        tags: s.tags || [],
        currentTask: s.currentTask || null,
        notes: s.notes || null,
      })),
      summary: {
        totalSessions: workSessions.length,
        completedSessions: completedWork.length,
        interruptedSessions: interruptedWork.length,
        totalFocusMinutes: totalFocusMin,
        totalFocusHours: Math.round((totalFocusMin / 60) * 10) / 10,
        completionRate:
          workSessions.length > 0
            ? Math.round((completedWork.length / workSessions.length) * 100)
            : 0,
        tags: tagCounts,
        accountabilityScore: accountability.score,
        accountabilityVerdict: accountability.verdict,
      },
    });
  }),
});

// GET /api/goals — get user goals + progress
http.route({
  path: "/api/goals",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;

    const goals = await ctx.runQuery(api.goals.getGoals, {
      userId: auth.userId,
    });

    // Get today's completed work sessions
    const todaySessions = await ctx.runQuery(api.sessions.todayByUser, {
      userId: auth.userId,
    });
    const todayCompleted = todaySessions.filter(
      (s: any) => s.type === "work" && s.completed
    ).length;

    // Get this week's focus hours (Mon-Sun)
    const weekStats = await ctx.runQuery(api.sessions.stats, {
      userId: auth.userId,
      sinceDaysAgo: 7,
    });

    return jsonResponse({
      goals: {
        dailyPomodoros: goals.dailyPomodoros,
        weeklyFocusHours: goals.weeklyFocusHours,
      },
      progress: {
        todayPomodoros: todayCompleted,
        weeklyFocusHours: weekStats.totalFocusHours,
      },
    });
  }),
});

// POST /api/goals — set user goals
http.route({
  path: "/api/goals",
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

    const dailyPomodoros = typeof body.dailyPomodoros === "number" && Number.isFinite(body.dailyPomodoros)
      ? Math.round(body.dailyPomodoros) : undefined;
    const weeklyFocusHours = typeof body.weeklyFocusHours === "number" && Number.isFinite(body.weeklyFocusHours)
      ? Math.round(body.weeklyFocusHours * 10) / 10 : undefined;

    if (dailyPomodoros === undefined && weeklyFocusHours === undefined) {
      return jsonResponse({ error: "Provide dailyPomodoros and/or weeklyFocusHours" }, 400);
    }

    // Get current goals to merge
    const current = await ctx.runQuery(api.goals.getGoals, {
      userId: auth.userId,
    });

    try {
      await ctx.runMutation(api.goals.setGoals, {
        userId: auth.userId,
        dailyPomodoros: dailyPomodoros ?? current.dailyPomodoros,
        weeklyFocusHours: weeklyFocusHours ?? current.weeklyFocusHours,
      });
    } catch (e: any) {
      return jsonResponse({ error: e.message || "Failed to set goals" }, 400);
    }

    return jsonResponse({ ok: true });
  }),
});

export default http;
