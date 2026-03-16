import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

async function verifyUserId(ctx: { auth: { getUserIdentity: () => Promise<any> } }, userId: string) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity && identity.subject !== userId) {
    throw new Error("Access denied: userId does not match authenticated user");
  }
}

export const getGoals = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    const goal = await ctx.db
      .query("userGoals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    return goal ?? { dailyPomodoros: 6, weeklyFocusHours: 20 };
  },
});

export const setGoals = mutation({
  args: {
    userId: v.string(),
    dailyPomodoros: v.number(),
    weeklyFocusHours: v.number(),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    if (args.dailyPomodoros < 1 || args.dailyPomodoros > 50) {
      throw new Error("Daily pomodoros must be between 1 and 50");
    }
    if (args.weeklyFocusHours < 1 || args.weeklyFocusHours > 100) {
      throw new Error("Weekly focus hours must be between 1 and 100");
    }

    const existing = await ctx.db
      .query("userGoals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        dailyPomodoros: args.dailyPomodoros,
        weeklyFocusHours: args.weeklyFocusHours,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("userGoals", {
      userId: args.userId,
      dailyPomodoros: args.dailyPomodoros,
      weeklyFocusHours: args.weeklyFocusHours,
      updatedAt: Date.now(),
    });
  },
});
