import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

const MAX_ACTIVE_HABITS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

function computeCycleDay(cycleStartedAt: number, now = Date.now()): number {
  return Math.min(21, Math.floor((now - cycleStartedAt) / DAY_MS) + 1);
}

// Auth: HTTP API path uses Bearer token (authenticateRequest in http.ts) — identity is null.
// Frontend path uses Clerk JWT — identity is present, must match userId.
async function verifyUserId(
  ctx: { auth: { getUserIdentity: () => Promise<any> } },
  userId: string
) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity && identity.subject !== userId) {
    throw new Error("Access denied: userId does not match authenticated user");
  }
}

async function getActiveHabits(ctx: any, userId: string) {
  return ctx.db
    .query("habits")
    .withIndex("by_user_active", (q: any) =>
      q.eq("userId", userId).eq("archivedAt", undefined)
    )
    .collect();
}

// ── Queries ──────────────────────────────────────────────────────────

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    const habits = await getActiveHabits(ctx, args.userId);
    return habits.sort((a: any, b: any) => a.position - b.position);
  },
});

export const dailyStatus = query({
  args: {
    userId: v.string(),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    const date =
      args.date ?? new Date().toISOString().slice(0, 10);

    const habits = await getActiveHabits(ctx, args.userId);
    const sorted = habits.sort((a: any, b: any) => a.position - b.position);

    const checkins = await ctx.db
      .query("habitCheckins")
      .withIndex("by_user_date", (q: any) =>
        q.eq("userId", args.userId).eq("date", date)
      )
      .collect();

    const checkinMap = new Map(
      checkins.map((c: any) => [c.habitId, c])
    );

    const items = sorted.map((h: any) => {
      const checkin = checkinMap.get(h._id);
      const cycleDay = computeCycleDay(h.cycleStartedAt);
      return {
        _id: h._id,
        name: h.name,
        description: h.description,
        phase: h.phase,
        isLinchpin: h.isLinchpin,
        color: h.color,
        position: h.position,
        cyclePhase: h.cyclePhase,
        cycleDay,
        completed: checkin?.completed ?? false,
        notes: checkin?.notes,
      };
    });

    const total = items.length;
    const done = items.filter((i: { completed: boolean }) => i.completed).length;
    const hubermanRequired = Math.min(total, Math.ceil(total * 0.85));
    const hubermanMet = done >= hubermanRequired;

    return { date, habits: items, total, done, hubermanTarget: { required: hubermanRequired, pct: 85, met: hubermanMet } };
  },
});

export const habitStats = query({
  args: {
    userId: v.string(),
    sinceDaysAgo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    const days = args.sinceDaysAgo ?? 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceDate = since.toISOString().slice(0, 10);

    const habits = await getActiveHabits(ctx, args.userId);

    const relevantCheckins = await ctx.db
      .query("habitCheckins")
      .withIndex("by_user_date", (q: any) =>
        q.eq("userId", args.userId).gte("date", sinceDate)
      )
      .collect();

    const checkinsByHabit = new Map<string, typeof relevantCheckins>();
    for (const c of relevantCheckins) {
      const list = checkinsByHabit.get(c.habitId) ?? [];
      list.push(c);
      checkinsByHabit.set(c.habitId, list);
    }

    const stats = habits.map((h: any) => {
      const checkins = checkinsByHabit.get(h._id) ?? [];
      const completedDays = checkins.filter((c: any) => c.completed).length;
      const daysSinceCreated = Math.floor((Date.now() - h.createdAt) / DAY_MS) + 1;
      const totalDays = Math.min(days, daysSinceCreated);
      const completionRate = totalDays > 0
        ? Math.round((completedDays / totalDays) * 100)
        : 0;

      // 21-day cycle progress
      const cycleDay = computeCycleDay(h.cycleStartedAt);

      // 2-day bins (Huberman): pair consecutive days, count bins where at least 1 done
      const dates = checkins
        .filter((c: any) => c.completed)
        .map((c: any) => c.date)
        .sort();
      const allDates: string[] = [];
      for (let d = new Date(sinceDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
        allDates.push(d.toISOString().slice(0, 10));
      }
      const completedSet = new Set(dates);
      let totalBins = 0;
      let completedBins = 0;
      for (let i = 0; i < allDates.length; i += 2) {
        totalBins++;
        const d1 = completedSet.has(allDates[i]);
        const d2 = i + 1 < allDates.length && completedSet.has(allDates[i + 1]);
        if (d1 || d2) completedBins++;
      }
      const binCompletionRate = totalBins > 0
        ? Math.round((completedBins / totalBins) * 100)
        : 0;

      return {
        _id: h._id,
        name: h.name,
        phase: h.phase,
        isLinchpin: h.isLinchpin,
        cyclePhase: h.cyclePhase,
        cycleDay,
        completedDays,
        totalDays,
        completionRate,
        binCompletionRate,
        totalBins,
        completedBins,
      };
    });

    return { period: `${days}d`, stats };
  },
});

// Cross-correlation: pomodoro performance on habit-done vs habit-missed days
export const habitPomodoroCorrelation = query({
  args: { userId: v.string(), sinceDaysAgo: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    const days = args.sinceDaysAgo ?? 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceDate = since.toISOString().slice(0, 10);
    const sinceTs = since.getTime();

    const habits = await getActiveHabits(ctx, args.userId);
    if (habits.length === 0) return { correlations: [] };

    const checkins = await ctx.db
      .query("habitCheckins")
      .withIndex("by_user_date", (q: any) =>
        q.eq("userId", args.userId).gte("date", sinceDate)
      )
      .collect();

    const sessions = await ctx.db
      .query("pomodoroSessions")
      .withIndex("by_user_date", (q: any) =>
        q.eq("userId", args.userId).gte("startedAt", sinceTs)
      )
      .collect();

    const workSessions = sessions.filter((s: any) => s.type === "work" && s.completed);

    // Group sessions by date
    const sessionsByDate = new Map<string, any[]>();
    for (const s of workSessions) {
      const date = new Date(s.startedAt).toISOString().slice(0, 10);
      const list = sessionsByDate.get(date) ?? [];
      list.push(s);
      sessionsByDate.set(date, list);
    }

    // Per-habit: compare pomodoro count on done vs missed days
    const correlations = habits.map((h: any) => {
      const habitCheckins = checkins.filter((c: any) => c.habitId === h._id);
      const doneDates = new Set(
        habitCheckins.filter((c: any) => c.completed).map((c: any) => c.date)
      );

      let donePomodoros = 0, doneDayCount = 0;
      let missedPomodoros = 0, missedDayCount = 0;

      for (const [date, daySessions] of sessionsByDate) {
        if (doneDates.has(date)) {
          donePomodoros += daySessions.length;
          doneDayCount++;
        } else {
          missedPomodoros += daySessions.length;
          missedDayCount++;
        }
      }

      const avgDone = doneDayCount > 0 ? Math.round((donePomodoros / doneDayCount) * 10) / 10 : 0;
      const avgMissed = missedDayCount > 0 ? Math.round((missedPomodoros / missedDayCount) * 10) / 10 : 0;
      const delta = avgDone > 0 && avgMissed > 0
        ? Math.round(((avgDone - avgMissed) / avgMissed) * 100)
        : 0;

      return {
        habitName: h.name,
        isLinchpin: h.isLinchpin,
        avgPomodorosOnDoneDays: avgDone,
        avgPomodorosOnMissedDays: avgMissed,
        deltaPct: delta,
        doneDays: doneDayCount,
        missedDays: missedDayCount,
      };
    });

    return { period: `${days}d`, correlations };
  },
});

export const checkinCalendar = query({
  args: {
    userId: v.string(),
    habitId: v.id("habits"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    const numDays = args.days ?? 30;
    const since = new Date();
    since.setDate(since.getDate() - numDays);
    const sinceDate = since.toISOString().slice(0, 10);

    const checkins = await ctx.db
      .query("habitCheckins")
      .withIndex("by_habit_date", (q: any) =>
        q.eq("habitId", args.habitId).gte("date", sinceDate)
      )
      .collect();

    const completedDates = new Set(
      checkins.filter((c: any) => c.completed).map((c: any) => c.date)
    );

    const calendar: { date: string; completed: boolean }[] = [];
    for (let d = new Date(sinceDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      calendar.push({ date: ds, completed: completedDates.has(ds) });
    }

    return calendar;
  },
});

export const cycleStatus = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    const habits = await getActiveHabits(ctx, args.userId);

    return habits.map((h: any) => {
      const cycleDay = computeCycleDay(h.cycleStartedAt);
      const daysRemaining = Math.max(0, 21 - cycleDay);
      return {
        _id: h._id,
        name: h.name,
        cyclePhase: h.cyclePhase,
        cycleDay,
        daysRemaining,
        cycleStartedAt: h.cycleStartedAt,
      };
    });
  },
});


// ── Mutations ────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    phase: v.union(v.literal("hard"), v.literal("easy")),
    isLinchpin: v.optional(v.boolean()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);

    if (!args.name || args.name.trim().length === 0) {
      throw new Error("Habit name is required");
    }
    if (args.name.length > 100) {
      throw new Error("Habit name must be 100 characters or less");
    }
    if (args.description && args.description.length > 500) {
      throw new Error("Description must be 500 characters or less");
    }

    const active = await getActiveHabits(ctx, args.userId);
    if (active.length >= MAX_ACTIVE_HABITS) {
      throw new Error(
        `Maximum ${MAX_ACTIVE_HABITS} active habits allowed (Huberman protocol). Archive one first.`
      );
    }

    if (args.color && !/^#[0-9a-fA-F]{3,8}$/.test(args.color)) {
      throw new Error("color must be a hex color (e.g. #ff6b6b)");
    }

    const position = active.length;
    const now = Date.now();

    return await ctx.db.insert("habits", {
      userId: args.userId,
      name: args.name.trim(),
      description: args.description?.trim(),
      phase: args.phase,
      isLinchpin: args.isLinchpin ?? false,
      color: args.color,
      position,
      cycleStartedAt: now,
      cyclePhase: "forming",
      createdAt: now,
    });
  },
});

export const update = mutation({
  args: {
    habitId: v.id("habits"),
    userId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    phase: v.optional(v.union(v.literal("hard"), v.literal("easy"))),
    isLinchpin: v.optional(v.boolean()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== args.userId || habit.archivedAt) {
      throw new Error("Habit not found");
    }

    if (args.name !== undefined) {
      if (!args.name || args.name.trim().length === 0) {
        throw new Error("Habit name is required");
      }
      if (args.name.length > 100) {
        throw new Error("Habit name must be 100 characters or less");
      }
    }
    if (args.description !== undefined && args.description.length > 500) {
      throw new Error("Description must be 500 characters or less");
    }
    if (args.color !== undefined && args.color && !/^#[0-9a-fA-F]{3,8}$/.test(args.color)) {
      throw new Error("color must be a hex color (e.g. #ff6b6b)");
    }

    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.description !== undefined) patch.description = args.description.trim();
    if (args.phase !== undefined) patch.phase = args.phase;
    if (args.isLinchpin !== undefined) patch.isLinchpin = args.isLinchpin;
    if (args.color !== undefined) patch.color = args.color;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.habitId, patch);
    }
  },
});

export const archive = mutation({
  args: {
    habitId: v.id("habits"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== args.userId) {
      throw new Error("Habit not found");
    }
    if (habit.archivedAt) {
      throw new Error("Habit already archived");
    }

    await ctx.db.patch(args.habitId, { archivedAt: Date.now() });
  },
});

export const checkin = mutation({
  args: {
    habitId: v.id("habits"),
    userId: v.string(),
    date: v.optional(v.string()),
    completed: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== args.userId || habit.archivedAt) {
      throw new Error("Habit not found");
    }

    const date = args.date ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("Date must be YYYY-MM-DD format");
    }

    if (args.notes && args.notes.length > 500) {
      throw new Error("Notes must be 500 characters or less");
    }

    const completed = args.completed ?? true;

    const existing = await ctx.db
      .query("habitCheckins")
      .withIndex("by_habit_date", (q) =>
        q.eq("habitId", args.habitId).eq("date", date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        completed,
        notes: args.notes,
        completedAt: completed ? Date.now() : undefined,
      });
      return existing._id;
    }

    return await ctx.db.insert("habitCheckins", {
      userId: args.userId,
      habitId: args.habitId,
      date,
      completed,
      notes: args.notes,
      completedAt: completed ? Date.now() : undefined,
    });
  },
});

export const uncheckin = mutation({
  args: {
    habitId: v.id("habits"),
    userId: v.string(),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== args.userId) {
      throw new Error("Habit not found");
    }

    const date = args.date ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("Date must be YYYY-MM-DD format");
    }

    const existing = await ctx.db
      .query("habitCheckins")
      .withIndex("by_habit_date", (q) =>
        q.eq("habitId", args.habitId).eq("date", date)
      )
      .first();

    if (!existing) {
      throw new Error("No checkin found for this habit on this date");
    }

    await ctx.db.delete(existing._id);
  },
});

// Shared cycle transition logic
async function advanceHabitCycles(ctx: any, habits: any[]) {
  const now = Date.now();
  const advanced: string[] = [];

  for (const h of habits) {
    if (computeCycleDay(h.cycleStartedAt, now) > 21) {
      if (h.cyclePhase === "forming") {
        await ctx.db.patch(h._id, { cyclePhase: "testing", cycleStartedAt: now });
        advanced.push(`${h.name}: forming → testing`);
      } else if (h.cyclePhase === "testing") {
        await ctx.db.patch(h._id, { cyclePhase: "established", cycleStartedAt: now });
        advanced.push(`${h.name}: testing → established`);
      }
    }
  }

  return { advanced };
}

// Per-user cycle advance (callable from frontend/API)
export const cycleAdvance = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    const habits = await getActiveHabits(ctx, args.userId);
    return advanceHabitCycles(ctx, habits);
  },
});

// Cron job: advance cycles for ALL users
export const cycleAdvanceAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("habits")
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .collect();
    return advanceHabitCycles(ctx, active);
  },
});
