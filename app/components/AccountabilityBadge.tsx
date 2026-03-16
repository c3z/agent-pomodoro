import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { NavLink } from "react-router";
import { useUserId } from "~/lib/useUserId";
import {
  computeAccountability,
  scoreColor,
} from "~/lib/accountability";

/**
 * Self-contained accountability badge.
 * Runs its own useQuery. Only shows when score < 90 and workday has started.
 * Small pill with pulsing dot, score %, and longest gap. Links to /accountability.
 */
export function AccountabilityBadge() {
  const userId = useUserId();
  const data = useQuery(
    api.sessions.accountabilityToday,
    userId ? { userId } : "skip"
  );

  if (!data) return null;

  const acc = computeAccountability(data.todaySessions);

  // Only show when workday started and score is below 90
  if (!acc.workdayStarted || acc.score >= 90) return null;

  const dotColor =
    acc.score >= 75
      ? "bg-yellow-400"
      : acc.score >= 55
        ? "bg-pomored"
        : "bg-red-500";

  return (
    <NavLink
      to="/accountability"
      className="inline-flex items-center gap-2 bg-surface-light hover:bg-surface-lighter rounded-full px-3 py-1.5 transition-colors group"
      title="Accountability score — click for details"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75`}
        />
        <span
          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor}`}
        />
      </span>
      <span className={`font-mono text-xs font-bold ${scoreColor(acc.score)}`}>
        {acc.score}%
      </span>
      {acc.longestGapMinutes > 0 && (
        <span className="text-gray-500 font-mono text-xs">
          gap {acc.longestGapMinutes}m
        </span>
      )}
    </NavLink>
  );
}
