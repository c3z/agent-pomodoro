import { ConvexReactClient } from "convex/react";

const convexUrl = typeof window !== "undefined"
  ? (window as any).__CONVEX_URL__ || import.meta.env.VITE_CONVEX_URL
  : process.env.VITE_CONVEX_URL;

export const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;
