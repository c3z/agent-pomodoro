import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const start = mutation({
  args: {
    userId: v.string(),
    type: v.union(
      v.literal("work"),
      v.literal("break"),
      v.literal("longBreak")
    ),
    durationMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.durationMinutes <= 0 || args.durationMinutes > 120) {
      throw new Error("Duration must be between 1 and 120 minutes");
    }
    return await ctx.db.insert("pomodoroSessions", {
      userId: args.userId,
      type: args.type,
      durationMinutes: args.durationMinutes,
      startedAt: Date.now(),
      completed: false,
      interrupted: false,
    });
  },
});

export const complete = mutation({
  args: {
    sessionId: v.id("pomodoroSessions"),
    userId: v.string(),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) {
      throw new Error("Session not found or access denied");
    }
    await ctx.db.patch(args.sessionId, {
      completed: true,
      completedAt: Date.now(),
      notes: args.notes,
      tags: args.tags,
    });
  },
});

export const interrupt = mutation({
  args: {
    sessionId: v.id("pomodoroSessions"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) {
      throw new Error("Session not found or access denied");
    }
    await ctx.db.patch(args.sessionId, {
      interrupted: true,
      completedAt: Date.now(),
    });
  },
});

export const listByUser = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("pomodoroSessions")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

export const todayByUser = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startTs = startOfDay.getTime();

    return await ctx.db
      .query("pomodoroSessions")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).gte("startedAt", startTs)
      )
      .order("desc")
      .collect();
  },
});

export const stats = query({
  args: {
    userId: v.string(),
    sinceDaysAgo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const since = args.sinceDaysAgo ?? 7;
    const sinceTs = Date.now() - since * 24 * 60 * 60 * 1000;

    const sessions = await ctx.db
      .query("pomodoroSessions")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).gte("startedAt", sinceTs)
      )
      .collect();

    const workSessions = sessions.filter((s) => s.type === "work");
    const completed = workSessions.filter((s) => s.completed);
    const interrupted = workSessions.filter((s) => s.interrupted);
    const totalMinutes = completed.reduce(
      (sum, s) => sum + s.durationMinutes,
      0
    );

    const daySet = new Set<string>();
    completed.forEach((s) => {
      const d = new Date(s.startedAt);
      daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });

    let streak = 0;
    const today = new Date();
    for (let i = 0; i < since; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (daySet.has(key)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    const lastSession =
      workSessions.length > 0
        ? Math.max(...workSessions.map((s) => s.startedAt))
        : null;
    const hoursSinceLastSession = lastSession
      ? (Date.now() - lastSession) / (1000 * 60 * 60)
      : null;

    return {
      period: `${since}d`,
      totalWorkSessions: workSessions.length,
      completedSessions: completed.length,
      interruptedSessions: interrupted.length,
      completionRate:
        workSessions.length > 0
          ? Math.round((completed.length / workSessions.length) * 100)
          : 0,
      totalFocusMinutes: totalMinutes,
      totalFocusHours: Math.round((totalMinutes / 60) * 10) / 10,
      currentStreak: streak,
      lastSessionAt: lastSession,
      hoursSinceLastSession: hoursSinceLastSession
        ? Math.round(hoursSinceLastSession * 10) / 10
        : null,
      avgSessionsPerDay: Math.round((workSessions.length / since) * 10) / 10,
    };
  },
});

export const agentSummary = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const since = 7;
    const sinceTs = Date.now() - since * 24 * 60 * 60 * 1000;

    const sessions = await ctx.db
      .query("pomodoroSessions")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).gte("startedAt", sinceTs)
      )
      .collect();

    const workSessions = sessions.filter((s) => s.type === "work");
    const completed = workSessions.filter((s) => s.completed);
    const totalMinutes = completed.reduce(
      (sum, s) => sum + s.durationMinutes,
      0
    );
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    const completionRate =
      workSessions.length > 0
        ? Math.round((completed.length / workSessions.length) * 100)
        : 0;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaySessions = workSessions.filter(
      (s) => s.startedAt >= todayStart.getTime()
    );
    const todayCompleted = todaySessions.filter((s) => s.completed).length;

    const daySet = new Set<string>();
    completed.forEach((s) => {
      const d = new Date(s.startedAt);
      daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < since; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (daySet.has(key)) streak++;
      else if (i > 0) break;
    }

    const lastSession =
      workSessions.length > 0
        ? Math.max(...workSessions.map((s) => s.startedAt))
        : null;
    const hoursSince = lastSession
      ? Math.round(((Date.now() - lastSession) / (1000 * 60 * 60)) * 10) / 10
      : null;

    const lines = [];
    lines.push(
      `Today: ${todayCompleted} pomodoro${todayCompleted !== 1 ? "s" : ""} completed`
    );
    lines.push(
      `Week: ${completed.length}/${workSessions.length} sessions (${completionRate}% completion), ${totalHours}h focus`
    );
    lines.push(`Streak: ${streak} day${streak !== 1 ? "s" : ""}`);
    if (hoursSince !== null) {
      lines.push(`Last session: ${hoursSince}h ago`);
    } else {
      lines.push("Last session: never");
    }

    return lines.join("\n");
  },
});

export const activeUserId = query({
  args: {},
  handler: async (ctx) => {
    const latest = await ctx.db
      .query("pomodoroSessions")
      .order("desc")
      .first();
    return latest?.userId ?? null;
  },
});
