import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  pomodoroSessions: defineTable({
    userId: v.string(),
    type: v.union(
      v.literal("work"),
      v.literal("break"),
      v.literal("longBreak")
    ),
    durationMinutes: v.number(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    completed: v.boolean(),
    interrupted: v.boolean(),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    currentTask: v.optional(v.string()),
    interruptReason: v.optional(v.string()),
    commits: v.optional(v.array(v.object({
      hash: v.string(),
      message: v.string(),
      filesChanged: v.number(),
    }))),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "startedAt"])
    .index("by_completed", ["userId", "completed", "startedAt"]),

  apiKeys: defineTable({
    userId: v.string(),
    name: v.string(),
    keyHash: v.string(),
    keyPrefix: v.string(),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    revoked: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_hash", ["keyHash"]),

  workActivity: defineTable({
    userId: v.string(),
    source: v.string(),
    windowStart: v.number(),
    timestamp: v.number(),
    hadActivePomodoro: v.boolean(),
  })
    .index("by_user_window", ["userId", "windowStart"]),

  nudges: defineTable({
    userId: v.string(),
    type: v.string(),        // "idle_warning", "no_session_today"
    message: v.string(),
    createdAt: v.number(),
    delivered: v.boolean(),
  })
    .index("by_user_pending", ["userId", "delivered", "createdAt"]),

  userGoals: defineTable({
    userId: v.string(),
    dailyPomodoros: v.number(),
    weeklyFocusHours: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  habits: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    phase: v.union(v.literal("hard"), v.literal("easy")),
    isLinchpin: v.boolean(),
    color: v.optional(v.string()),
    position: v.number(),
    cycleStartedAt: v.number(),
    cyclePhase: v.union(
      v.literal("forming"),
      v.literal("testing"),
      v.literal("established")
    ),
    createdAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "archivedAt"]),

  habitCheckins: defineTable({
    userId: v.string(),
    habitId: v.id("habits"),
    date: v.string(),
    completed: v.boolean(),
    notes: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  })
    .index("by_habit_date", ["habitId", "date"])
    .index("by_user_date", ["userId", "date"]),
});
