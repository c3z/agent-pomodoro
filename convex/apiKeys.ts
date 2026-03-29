import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";

async function verifyUserId(ctx: { auth: { getUserIdentity: () => Promise<any> } }, userId: string) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity && identity.subject !== userId) {
    throw new Error("Access denied: userId does not match authenticated user");
  }
}

export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    keyHash: v.string(),
    keyPrefix: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    if (existing.filter((k) => !k.revoked).length >= 5) {
      throw new Error("Maximum 5 active API keys per user");
    }
    return await ctx.db.insert("apiKeys", {
      userId: args.userId,
      name: args.name,
      keyHash: args.keyHash,
      keyPrefix: args.keyPrefix,
      createdAt: Date.now(),
      revoked: false,
    });
  },
});

export const listByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return keys.map((k) => ({
      _id: k._id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      revoked: k.revoked,
    }));
  },
});

export const revoke = mutation({
  args: {
    keyId: v.id("apiKeys"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyUserId(ctx, args.userId);
    const key = await ctx.db.get(args.keyId);
    if (!key || key.userId !== args.userId) {
      throw new Error("API key not found or access denied");
    }
    await ctx.db.patch(args.keyId, { revoked: true });
  },
});

export const validateByHash = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", args.keyHash))
      .first();
    if (!key || key.revoked) return null;
    return { userId: key.userId, keyId: key._id, lastUsedAt: key.lastUsedAt ?? null };
  },
});

export const touchLastUsed = internalMutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.keyId, { lastUsedAt: Date.now() });
  },
});
