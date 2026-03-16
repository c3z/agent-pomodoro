import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";

async function verifyUserId(ctx: { auth: { getUserIdentity: () => Promise<any> } }, userId: string) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity && identity.subject !== userId) {
    throw new Error("Access denied: userId does not match authenticated user");
  }
}

function computeStreak(completed: Array<{ startedAt: number }>, maxDays: number): number {
  const daySet = new Set<string>();
  for (const s of completed) {
    const d = new Date(s.startedAt);
    daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < maxDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (daySet.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

function computeHoursSince(sessions: Array<{ startedAt: number }>): number | null {
  if (sessions.length === 0) return null;
  const lastSession = Math.max(...sessions.map((s) => s.startedAt));
  return Math.round(((Date.now() - lastSession) / (1000 * 60 * 60)) * 10) / 10;
}

async function findActiveSession(ctx: any, userId: string) {
  const recent = await ctx.db
    .query("pomodoroSessions")
    .withIndex("by_user_date", (q: any) => q.eq("userId", userId))
    .order("desc")
    .take(10);
  return recent.find((s: any) => !s.completed && !s.interrupted) ?? null;
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
    currentTask: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    if (args.durationMinutes <= 0 || args.durationMinutes > 120) {
      throw new Error("Duration must be between 1 and 120 minutes");
    }
    if (args.currentTask && args.currentTask.length > 200) {
      throw new Error("Task must be under 200 characters");
    }
    if (args.tags && (args.tags.length > 10 || args.tags.some((t) => t.length > 50))) {
      throw new Error("Maximum 10 tags, each under 50 characters");
    }

    // Idempotency guard: check for existing active session
    const active = await findActiveSession(ctx, args.userId);

    if (active) {
      if (active.type === args.type) {
        // Same type — idempotent, return existing session
        return active._id;
      }
      // Different type — conflict
      throw new Error(
        `CONFLICT: Active ${active.type} session already running (${active._id})`
      );
    }

    const task = args.currentTask?.trim().slice(0, 200) || undefined;
    const tags = args.tags?.map((t) => t.trim()).filter(Boolean).slice(0, 10);
    return await ctx.db.insert("pomodoroSessions", {
      userId: args.userId,
      type: args.type,
      durationMinutes: args.durationMinutes,
      startedAt: Date.now(),
      completed: false,
      interrupted: false,
      ...(task ? { currentTask: task } : {}),
      ...(tags && tags.length > 0 ? { tags } : {}),
    });
  },
});

export const setTask = mutation({
  args: {
    userId: v.string(),
    currentTask: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    if (args.currentTask.length > 200) {
      throw new Error("Task must be under 200 characters");
    }
    const active = await findActiveSession(ctx, args.userId);
    if (!active) {
      throw new Error("No active session to set task on");
    }
    const task = args.currentTask.trim().slice(0, 200);
    await ctx.db.patch(active._id, {
      currentTask: task || undefined,
    });
    return active._id;
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
    await verifyUserId(ctx, args.userId);
    if (args.notes && args.notes.length > 500) {
      throw new Error("Notes must be under 500 characters");
    }
    if (args.tags && (args.tags.length > 10 || args.tags.some((t) => t.length > 50))) {
      throw new Error("Maximum 10 tags, each under 50 characters");
    }
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) {
      throw new Error("Session not found or access denied");
    }
    if (session.completed || session.interrupted) {
      throw new Error("Session already finished");
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
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    if (args.reason && args.reason.length > 200) {
      throw new Error("Reason must be under 200 characters");
    }
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) {
      throw new Error("Session not found or access denied");
    }
    if (session.completed || session.interrupted) {
      throw new Error("Session already finished");
    }
    const reason = args.reason?.trim().slice(0, 200) || undefined;
    await ctx.db.patch(args.sessionId, {
      interrupted: true,
      completedAt: Date.now(),
      ...(reason ? { interruptReason: reason } : {}),
    });
  },
});

export const listByUser = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
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
    await verifyUserId(ctx, args.userId);
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
    await verifyUserId(ctx, args.userId);
    const since = Math.min(args.sinceDaysAgo ?? 7, 365);
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

    const streak = computeStreak(completed, since);
    const hoursSinceLastSession = computeHoursSince(workSessions);
    const lastSession =
      workSessions.length > 0
        ? Math.max(...workSessions.map((s) => s.startedAt))
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
      hoursSinceLastSession,
      avgSessionsPerDay: Math.round((workSessions.length / since) * 10) / 10,
    };
  },
});

export const agentSummary = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
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

    const streak = computeStreak(completed, since);
    const hoursSince = computeHoursSince(workSessions);

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

export const activeSession = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    return await findActiveSession(ctx, args.userId);
  },
});

export const accountabilityToday = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startTs = startOfDay.getTime();

    const todaySessions = await ctx.db
      .query("pomodoroSessions")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).gte("startedAt", startTs)
      )
      .order("asc")
      .collect();

    // 7 daily completed-work-session counts (index 0 = 7 days ago, 6 = yesterday)
    const sevenDaysAgo = startTs - 7 * 24 * 60 * 60 * 1000;
    const weekSessions = await ctx.db
      .query("pomodoroSessions")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).gte("startedAt", sevenDaysAgo)
      )
      .order("asc")
      .collect();

    const dailyCounts: number[] = Array(7).fill(0);
    for (const s of weekSessions) {
      if (s.type !== "work" || !s.completed) continue;
      if (s.startedAt >= startTs) continue;
      const dayIndex = Math.floor(
        (s.startedAt - sevenDaysAgo) / (24 * 60 * 60 * 1000)
      );
      if (dayIndex >= 0 && dayIndex < 7) dailyCounts[dayIndex]++;
    }

    return { todaySessions, dailyCounts };
  },
});

export const linkCommits = mutation({
  args: {
    sessionId: v.id("pomodoroSessions"),
    userId: v.string(),
    commits: v.array(v.object({
      hash: v.string(),
      message: v.string(),
      filesChanged: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) {
      throw new Error("Session not found or access denied");
    }
    // Max 50 commits per session, sanitize fields
    const commits = args.commits.slice(0, 50).map((c) => ({
      hash: c.hash.slice(0, 40),
      message: c.message.slice(0, 200),
      filesChanged: Math.max(0, c.filesChanged),
    }));
    await ctx.db.patch(args.sessionId, { commits });
  },
});

export const tagAnalytics = query({
  args: {
    userId: v.string(),
    sinceDaysAgo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    const since = Math.min(args.sinceDaysAgo ?? 30, 365);
    const sinceTs = Date.now() - since * 24 * 60 * 60 * 1000;

    const sessions = await ctx.db
      .query("pomodoroSessions")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).gte("startedAt", sinceTs)
      )
      .collect();

    // Only count completed work sessions
    const completed = sessions.filter(
      (s) => s.type === "work" && s.completed
    );

    const tagMap = new Map<string, { count: number; totalMinutes: number }>();
    for (const s of completed) {
      if (s.tags && s.tags.length > 0) {
        for (const tag of s.tags) {
          const existing = tagMap.get(tag) ?? { count: 0, totalMinutes: 0 };
          existing.count += 1;
          existing.totalMinutes += s.durationMinutes;
          tagMap.set(tag, existing);
        }
      }
    }

    return Array.from(tagMap.entries())
      .map(([tag, data]) => ({
        tag,
        count: data.count,
        totalMinutes: data.totalMinutes,
      }))
      .sort((a, b) => b.count - a.count);
  },
});

// ── Sprint #28: Focus Rhythm Analysis ────────────────────────────────

export const focusRhythm = query({
  args: {
    userId: v.string(),
    sinceDaysAgo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    const since = Math.min(args.sinceDaysAgo ?? 30, 365);
    const sinceTs = Date.now() - since * 24 * 60 * 60 * 1000;

    const sessions = await ctx.db
      .query("pomodoroSessions")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).gte("startedAt", sinceTs)
      )
      .collect();

    const workSessions = sessions.filter((s) => s.type === "work");

    // Bucket by hour-of-day (0-23)
    const byHour: Array<{ hour: number; total: number; completed: number; interrupted: number; completionRate: number }> = [];
    for (let h = 0; h < 24; h++) {
      byHour.push({ hour: h, total: 0, completed: 0, interrupted: 0, completionRate: 0 });
    }

    // Bucket by day-of-week (0=Sunday .. 6=Saturday)
    const byDayOfWeek: Array<{ day: number; dayName: string; total: number; completed: number; interrupted: number; completionRate: number }> = [];
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    for (let d = 0; d < 7; d++) {
      byDayOfWeek.push({ day: d, dayName: dayNames[d], total: 0, completed: 0, interrupted: 0, completionRate: 0 });
    }

    for (const s of workSessions) {
      const dt = new Date(s.startedAt);
      const hour = dt.getHours();
      const dow = dt.getDay();

      byHour[hour].total++;
      byDayOfWeek[dow].total++;

      if (s.completed) {
        byHour[hour].completed++;
        byDayOfWeek[dow].completed++;
      }
      if (s.interrupted) {
        byHour[hour].interrupted++;
        byDayOfWeek[dow].interrupted++;
      }
    }

    // Calculate completion rates
    for (const b of byHour) {
      b.completionRate = b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0;
    }
    for (const b of byDayOfWeek) {
      b.completionRate = b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0;
    }

    // Find best/worst (only consider buckets with at least 1 session)
    function bestBy<T>(items: T[], key: (item: T) => number): T | null {
      return items.length > 0 ? items.reduce((a, b) => key(a) > key(b) ? a : b) : null;
    }
    function worstBy<T>(items: T[], key: (item: T) => number): T | null {
      return items.length > 0 ? items.reduce((a, b) => key(a) < key(b) ? a : b) : null;
    }
    const rate = (b: { completionRate: number }) => b.completionRate;
    const activeHours = byHour.filter((b) => b.total > 0);
    const activeDays = byDayOfWeek.filter((b) => b.total > 0);

    const bestHour = bestBy(activeHours, rate)?.hour ?? null;
    const worstHour = worstBy(activeHours, rate)?.hour ?? null;
    const bestDay = bestBy(activeDays, rate)?.day ?? null;
    const worstDay = worstBy(activeDays, rate)?.day ?? null;

    return {
      period: `${since}d`,
      totalSessions: workSessions.length,
      byHour,
      byDayOfWeek,
      bestHour,
      worstHour,
      bestDay,
      worstDay,
      bestDayName: bestDay !== null ? dayNames[bestDay] : null,
      worstDayName: worstDay !== null ? dayNames[worstDay] : null,
    };
  },
});

// ── Sprint #29: Weekly Retrospective ─────────────────────────────────

export const weeklyRetro = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

    // Fetch last 14 days of sessions
    const allSessions = await ctx.db
      .query("pomodoroSessions")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).gte("startedAt", fourteenDaysAgo)
      )
      .collect();

    const workSessions = allSessions.filter((s) => s.type === "work");
    const thisWeek = workSessions.filter((s) => s.startedAt >= sevenDaysAgo);
    const prevWeek = workSessions.filter((s) => s.startedAt < sevenDaysAgo);

    // Per-day breakdown for this week
    const perDay: Array<{
      date: string;
      sessions: number;
      completed: number;
      interrupted: number;
      focusMinutes: number;
      tags: string[];
    }> = [];

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now - i * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const daySessions = thisWeek.filter(
        (s) => s.startedAt >= dayStart.getTime() && s.startedAt < dayEnd.getTime()
      );
      const completed = daySessions.filter((s) => s.completed);
      const interrupted = daySessions.filter((s) => s.interrupted);
      const focusMinutes = completed.reduce((sum, s) => sum + s.durationMinutes, 0);

      const tagSet = new Set<string>();
      for (const s of completed) {
        if (s.tags) s.tags.forEach((t) => tagSet.add(t));
      }

      perDay.push({
        date: dayStart.toISOString().slice(0, 10),
        sessions: daySessions.length,
        completed: completed.length,
        interrupted: interrupted.length,
        focusMinutes,
        tags: Array.from(tagSet),
      });
    }

    // Top tags for the week
    const tagMap = new Map<string, number>();
    for (const s of thisWeek.filter((s) => s.completed)) {
      if (s.tags) {
        for (const tag of s.tags) {
          tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
        }
      }
    }
    const topTags = Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    // Compare with previous week
    const thisCompleted = thisWeek.filter((s) => s.completed);
    const prevCompleted = prevWeek.filter((s) => s.completed);
    const thisFocusMin = thisCompleted.reduce((sum, s) => sum + s.durationMinutes, 0);
    const prevFocusMin = prevCompleted.reduce((sum, s) => sum + s.durationMinutes, 0);
    const thisRate = thisWeek.length > 0 ? Math.round((thisCompleted.length / thisWeek.length) * 100) : 0;
    const prevRate = prevWeek.length > 0 ? Math.round((prevCompleted.length / prevWeek.length) * 100) : 0;

    return {
      thisWeek: {
        sessions: thisWeek.length,
        completed: thisCompleted.length,
        interrupted: thisWeek.filter((s) => s.interrupted).length,
        completionRate: thisRate,
        focusMinutes: thisFocusMin,
        focusHours: Math.round((thisFocusMin / 60) * 10) / 10,
        avgSessionsPerDay: Math.round((thisWeek.length / 7) * 10) / 10,
      },
      previousWeek: {
        sessions: prevWeek.length,
        completed: prevCompleted.length,
        interrupted: prevWeek.filter((s) => s.interrupted).length,
        completionRate: prevRate,
        focusMinutes: prevFocusMin,
        focusHours: Math.round((prevFocusMin / 60) * 10) / 10,
        avgSessionsPerDay: Math.round((prevWeek.length / 7) * 10) / 10,
      },
      deltas: {
        sessions: thisWeek.length - prevWeek.length,
        completed: thisCompleted.length - prevCompleted.length,
        completionRate: thisRate - prevRate,
        focusMinutes: thisFocusMin - prevFocusMin,
        focusHours: Math.round(((thisFocusMin - prevFocusMin) / 60) * 10) / 10,
      },
      perDay,
      topTags,
    };
  },
});

// ── Sprint #30: Pomodoro Debt + Regression Detection ─────────────────

export const pomodoroDebt = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);

    // Get daily target from userGoals
    const goal = await ctx.db
      .query("userGoals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const dailyTarget = goal?.dailyPomodoros ?? 6;

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const sessions = await ctx.db
      .query("pomodoroSessions")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).gte("startedAt", sevenDaysAgo)
      )
      .collect();

    const workCompleted = sessions.filter((s) => s.type === "work" && s.completed);

    // Build per-day history (7 days ago through today = 8 slots, but last 7 full days + today)
    const weekHistory: Array<{
      date: string;
      target: number;
      completed: number;
      delta: number;
    }> = [];

    let debtCarried = 0;

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now - i * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayCompleted = workCompleted.filter(
        (s) => s.startedAt >= dayStart.getTime() && s.startedAt < dayEnd.getTime()
      ).length;

      const isToday = i === 0;
      // Only accumulate debt from past days (not today — it's still in progress)
      if (!isToday) {
        const deficit = dailyTarget - dayCompleted;
        if (deficit > 0) {
          debtCarried += deficit;
        }
      }

      weekHistory.push({
        date: dayStart.toISOString().slice(0, 10),
        target: dailyTarget,
        completed: dayCompleted,
        delta: dayCompleted - dailyTarget,
      });
    }

    // Today's stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCompleted = workCompleted.filter(
      (s) => s.startedAt >= todayStart.getTime()
    ).length;

    // Today's effective target = base + carried debt (capped at 2x base)
    const todayTarget = Math.min(dailyTarget + debtCarried, dailyTarget * 2);

    return {
      dailyTarget,
      todayCompleted,
      todayTarget,
      debtCarried,
      todayRemaining: Math.max(0, todayTarget - todayCompleted),
      weekHistory,
    };
  },
});

export const trends = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

    const allSessions = await ctx.db
      .query("pomodoroSessions")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).gte("startedAt", fourteenDaysAgo)
      )
      .collect();

    const workSessions = allSessions.filter((s) => s.type === "work");
    const current7d = workSessions.filter((s) => s.startedAt >= sevenDaysAgo);
    const previous7d = workSessions.filter((s) => s.startedAt < sevenDaysAgo);

    const curCompleted = current7d.filter((s) => s.completed);
    const prevCompleted = previous7d.filter((s) => s.completed);
    const curFocusMin = curCompleted.reduce((sum, s) => sum + s.durationMinutes, 0);
    const prevFocusMin = prevCompleted.reduce((sum, s) => sum + s.durationMinutes, 0);
    const curRate = current7d.length > 0 ? Math.round((curCompleted.length / current7d.length) * 100) : 0;
    const prevRate = previous7d.length > 0 ? Math.round((prevCompleted.length / previous7d.length) * 100) : 0;
    const curAvgPerDay = Math.round((current7d.length / 7) * 10) / 10;
    const prevAvgPerDay = Math.round((previous7d.length / 7) * 10) / 10;
    const curFocusHours = Math.round((curFocusMin / 60) * 10) / 10;
    const prevFocusHours = Math.round((prevFocusMin / 60) * 10) / 10;

    // Detect regression: completion rate dropped by >10pp OR sessions/day dropped by >30%
    const rateDelta = curRate - prevRate;
    const sessionsDelta = curAvgPerDay - prevAvgPerDay;
    const regression =
      (prevRate > 0 && rateDelta < -10) ||
      (prevAvgPerDay > 0 && sessionsDelta / prevAvgPerDay < -0.3);

    return {
      current7d: {
        completionRate: curRate,
        avgSessionsPerDay: curAvgPerDay,
        totalFocusHours: curFocusHours,
        totalSessions: current7d.length,
        completedSessions: curCompleted.length,
        accountabilityScore: curRate,
      },
      previous7d: {
        completionRate: prevRate,
        avgSessionsPerDay: prevAvgPerDay,
        totalFocusHours: prevFocusHours,
        totalSessions: previous7d.length,
        completedSessions: prevCompleted.length,
        accountabilityScore: prevRate,
      },
      deltas: {
        completionRate: rateDelta,
        avgSessionsPerDay: Math.round(sessionsDelta * 10) / 10,
        totalFocusHours: Math.round((curFocusHours - prevFocusHours) * 10) / 10,
        totalSessions: current7d.length - previous7d.length,
      },
      regression,
    };
  },
});

/**
 * @deprecated Use GET /api/me with API key auth instead.
 * This scans the entire DB and is a privacy concern — returns whatever userId
 * happened to use the app most recently, regardless of auth.
 * Kept for backward compatibility; will be removed in a future sprint.
 */
export const activeUserId = internalQuery({
  args: {},
  handler: async (ctx) => {
    const latest = await ctx.db
      .query("pomodoroSessions")
      .order("desc")
      .first();
    return latest?.userId ?? null;
  },
});
