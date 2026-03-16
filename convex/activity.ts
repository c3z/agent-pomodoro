import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

const WINDOW_MS = 60_000;
const SESSION_GAP_MS = 5 * 60_000;

export const recordHeartbeat = internalMutation({
  args: {
    userId: v.string(),
    source: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const windowStart = Math.floor(args.timestamp / WINDOW_MS) * WINDOW_MS;

    // Check for active work pomodoro
    const recentSessions = await ctx.db
      .query("pomodoroSessions")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(10);
    const active = recentSessions.find(
      (s) => !s.completed && !s.interrupted && s.type === "work"
    );
    const hadActivePomodoro = active !== undefined;

    // Dedup: one record per user per minute bucket
    const existing = await ctx.db
      .query("workActivity")
      .withIndex("by_user_window", (q) =>
        q.eq("userId", args.userId).eq("windowStart", windowStart)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        timestamp: args.timestamp,
        hadActivePomodoro,
        source: args.source,
      });
      return { inserted: false, windowStart, hadActivePomodoro };
    }

    await ctx.db.insert("workActivity", {
      userId: args.userId,
      source: args.source,
      windowStart,
      timestamp: args.timestamp,
      hadActivePomodoro,
    });

    return { inserted: true, windowStart, hadActivePomodoro };
  },
});

export const getAccountability = internalQuery({
  args: {
    userId: v.string(),
    sinceDaysAgo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = Math.min(args.sinceDaysAgo ?? 7, 90);
    const sinceTs = Date.now() - days * 24 * 60 * 60 * 1000;

    const records = await ctx.db
      .query("workActivity")
      .withIndex("by_user_window", (q) =>
        q.eq("userId", args.userId).gte("windowStart", sinceTs)
      )
      .order("asc")
      .collect();

    const totalWindows = records.length;
    const protectedWindows = records.filter((r) => r.hadActivePomodoro).length;
    const unprotectedWindows = totalWindows - protectedWindows;
    const score =
      totalWindows === 0
        ? 100
        : Math.round((protectedWindows / totalWindows) * 100);

    return {
      period: `${days}d`,
      score,
      totalWindows,
      protectedWindows,
      unprotectedWindows,
      verdict:
        score >= 80
          ? "disciplined"
          : score >= 50
            ? "inconsistent"
            : "chaotic",
    };
  },
});

export const getShameLog = internalQuery({
  args: {
    userId: v.string(),
    sinceDaysAgo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = Math.min(args.sinceDaysAgo ?? 7, 90);
    const sinceTs = Date.now() - days * 24 * 60 * 60 * 1000;

    const records = await ctx.db
      .query("workActivity")
      .withIndex("by_user_window", (q) =>
        q.eq("userId", args.userId).gte("windowStart", sinceTs)
      )
      .order("asc")
      .collect();

    if (records.length === 0) return { period: `${days}d`, shameWindows: [] };

    type WorkSession = {
      startedAt: number;
      endedAt: number;
      windowCount: number;
      unprotectedCount: number;
      source: string;
    };

    const sessions: WorkSession[] = [];
    let current: WorkSession = {
      startedAt: records[0].windowStart,
      endedAt: records[0].windowStart + WINDOW_MS,
      windowCount: 1,
      unprotectedCount: records[0].hadActivePomodoro ? 0 : 1,
      source: records[0].source,
    };

    for (let i = 1; i < records.length; i++) {
      const r = records[i];
      const gap = r.windowStart - records[i - 1].windowStart;

      if (gap <= SESSION_GAP_MS) {
        current.endedAt = r.windowStart + WINDOW_MS;
        current.windowCount++;
        if (!r.hadActivePomodoro) current.unprotectedCount++;
      } else {
        sessions.push(current);
        current = {
          startedAt: r.windowStart,
          endedAt: r.windowStart + WINDOW_MS,
          windowCount: 1,
          unprotectedCount: r.hadActivePomodoro ? 0 : 1,
          source: r.source,
        };
      }
    }
    sessions.push(current);

    const shameWindows = sessions
      .filter((s) => s.unprotectedCount === s.windowCount)
      .map((s) => ({
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        durationMinutes: Math.round((s.endedAt - s.startedAt) / 60_000),
        source: s.source,
      }));

    return { period: `${days}d`, shameWindows };
  },
});

export const getActivityStats = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const days = 7;
    const sinceTs = Date.now() - days * 24 * 60 * 60 * 1000;

    const records = await ctx.db
      .query("workActivity")
      .withIndex("by_user_window", (q) =>
        q.eq("userId", args.userId).gte("windowStart", sinceTs)
      )
      .order("asc")
      .collect();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRecords = records.filter(
      (r) => r.windowStart >= todayStart.getTime()
    );
    const todayMinutes = todayRecords.length;
    const todayProtected = todayRecords.filter((r) => r.hadActivePomodoro).length;

    const totalWindows = records.length;
    const protectedWindows = records.filter((r) => r.hadActivePomodoro).length;
    const score =
      totalWindows === 0
        ? 100
        : Math.round((protectedWindows / totalWindows) * 100);

    const lastRecord =
      records.length > 0 ? records[records.length - 1] : null;
    const minutesSinceLast = lastRecord
      ? Math.round((Date.now() - lastRecord.timestamp) / 60_000)
      : null;

    const lines: string[] = [];
    lines.push(
      `Today: ${todayMinutes}min active coding, ${todayProtected}min protected by pomodoro`
    );
    lines.push(
      `Week: ${totalWindows}min active, accountability score ${score}% (${protectedWindows}/${totalWindows} windows protected)`
    );
    if (minutesSinceLast !== null) {
      lines.push(`Last activity: ${minutesSinceLast}min ago`);
    } else {
      lines.push("Last activity: none this week");
    }
    lines.push(
      score >= 80
        ? "Assessment: disciplined"
        : score >= 50
          ? "Assessment: inconsistent — working without pomodoro too often"
          : "Assessment: chaotic — most work outside pomodoro sessions"
    );

    return lines.join("\n");
  },
});
