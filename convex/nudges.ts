import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * generateNudges — called by cron every 30 minutes.
 * Checks each user's activity and creates nudges when:
 * - No work session in last 2 hours during work hours (9-18) → "idle_warning"
 * - No sessions today at all and it's past 11:00 → "no_session_today"
 * Max 1 nudge per type per day to avoid spam.
 */
export const generateNudges = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const today = new Date(now);
    const hour = today.getHours();

    // Only generate nudges during work hours (9-18)
    if (hour < 9 || hour >= 18) return;

    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayTs = startOfDay.getTime();

    // Find all users who have had any session ever (use latest session per user)
    const recentSessions = await ctx.db
      .query("pomodoroSessions")
      .order("desc")
      .take(200);

    // Deduplicate to get unique user IDs
    const userIds = [...new Set(recentSessions.map((s) => s.userId))];

    for (const userId of userIds) {
      // Get today's nudges to enforce max 1 per type per day
      const todayNudges = await ctx.db
        .query("nudges")
        .withIndex("by_user_pending", (q) =>
          q.eq("userId", userId)
        )
        .filter((q) => q.gte(q.field("createdAt"), startOfDayTs))
        .collect();

      const todayNudgeTypes = new Set(todayNudges.map((n) => n.type));

      // Get today's sessions for this user
      const todaySessions = await ctx.db
        .query("pomodoroSessions")
        .withIndex("by_user_date", (q) =>
          q.eq("userId", userId).gte("startedAt", startOfDayTs)
        )
        .collect();

      const todayWorkSessions = todaySessions.filter((s) => s.type === "work");

      // Check: no sessions today at all and it's past 11:00
      if (
        hour >= 11 &&
        todayWorkSessions.length === 0 &&
        !todayNudgeTypes.has("no_session_today")
      ) {
        await ctx.db.insert("nudges", {
          userId,
          type: "no_session_today",
          message: `No pomodoro sessions today and it's already ${hour}:00. Time to start focusing.`,
          createdAt: now,
          delivered: false,
        });
        todayNudgeTypes.add("no_session_today");
      }

      // Check: no work session in last 2 hours (idle warning)
      if (!todayNudgeTypes.has("idle_warning")) {
        const twoHoursAgo = now - 2 * 60 * 60 * 1000;
        const recentWork = todayWorkSessions.filter(
          (s) => s.startedAt >= twoHoursAgo || (s.completedAt && s.completedAt >= twoHoursAgo)
        );

        // Only nudge if they had sessions earlier today but went idle,
        // OR if it's past noon with no sessions at all
        const hadEarlierWork = todayWorkSessions.length > 0 && recentWork.length === 0;
        const pastNoonNoWork = hour >= 12 && todayWorkSessions.length === 0;

        if (hadEarlierWork || pastNoonNoWork) {
          const lastSession = todayWorkSessions.length > 0
            ? todayWorkSessions[todayWorkSessions.length - 1]
            : null;
          const idleMinutes = lastSession
            ? Math.round((now - (lastSession.completedAt || lastSession.startedAt)) / 60_000)
            : null;

          const msg = idleMinutes
            ? `No pomodoro for ${idleMinutes} minutes. Last session ended ${idleMinutes}min ago. Get back to work.`
            : `It's ${hour}:00 and you haven't started a single pomodoro today.`;

          await ctx.db.insert("nudges", {
            userId,
            type: "idle_warning",
            message: msg,
            createdAt: now,
            delivered: false,
          });
        }
      }
    }
  },
});

/**
 * getPendingNudges — return undelivered nudges for a user
 */
export const getPendingNudges = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("nudges")
      .withIndex("by_user_pending", (q) =>
        q.eq("userId", args.userId).eq("delivered", false)
      )
      .order("asc")
      .collect();
  },
});

/**
 * markDelivered — mark nudges as delivered
 */
export const markDelivered = internalMutation({
  args: { nudgeIds: v.array(v.id("nudges")) },
  handler: async (ctx, args) => {
    for (const id of args.nudgeIds) {
      await ctx.db.patch(id, { delivered: true });
    }
  },
});
