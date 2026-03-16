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
});
