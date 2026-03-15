import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

interface SessionWithTimestamp {
  startedAt: number;
  completed: boolean;
}

function calculateStreak(
  completedSessions: SessionWithTimestamp[],
  lookbackDays: number,
): number {
  const daySet = new Set<string>();
  for (const s of completedSessions) {
    daySet.add(dateKey(new Date(s.startedAt)));
  }

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < lookbackDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (daySet.has(dateKey(d))) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

function lastSessionTimestamp(
  sessions: SessionWithTimestamp[],
): number | null {
  if (sessions.length === 0) return null;
  return Math.max(...sessions.map((s) => s.startedAt));
}

function hoursSince(timestamp: number | null): number | null {
  if (timestamp === null) return null;
  return Math.round(((Date.now() - timestamp) / (1000 * 60 * 60)) * 10) / 10;
}

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
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
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
  },
  handler: async (ctx, args) => {
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

    const lastSession = lastSessionTimestamp(workSessions);

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
      currentStreak: calculateStreak(completed, since),
      lastSessionAt: lastSession,
      hoursSinceLastSession: hoursSince(lastSession),
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

    const streak = calculateStreak(completed, since);
    const lastHours = hoursSince(lastSessionTimestamp(workSessions));

    const lines = [
      `Today: ${todayCompleted} pomodoro${todayCompleted !== 1 ? "s" : ""} completed`,
      `Week: ${completed.length}/${workSessions.length} sessions (${completionRate}% completion), ${totalHours}h focus`,
      `Streak: ${streak} day${streak !== 1 ? "s" : ""}`,
      lastHours !== null ? `Last session: ${lastHours}h ago` : "Last session: never",
    ];

    return lines.join("\n");
  },
});
