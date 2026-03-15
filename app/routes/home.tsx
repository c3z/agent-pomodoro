import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Stats } from "~/components/Stats";
import { SessionList } from "~/components/SessionList";
import { NavLink } from "react-router";
import { useUserId } from "~/lib/useUserId";

const PERIOD_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "All", days: 3650 },
] as const;

export default function Home() {
  const userId = useUserId();
  const [periodDays, setPeriodDays] = useState(7);
  const statsData = useQuery(
    api.sessions.stats,
    userId ? { userId, sinceDaysAgo: periodDays } : "skip"
  );
  const todaySessions = useQuery(
    api.sessions.todayByUser,
    userId ? { userId } : "skip"
  );

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold font-mono text-white">
          Agent Pomodoro
        </h1>
        <p className="text-gray-500 font-mono text-sm">
          Focus tracking for humans supervised by AI agents
        </p>
      </div>

      <div className="flex justify-center gap-1">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => setPeriodDays(opt.days)}
            className={`px-3 py-1 rounded-lg font-mono text-xs transition-colors ${
              periodDays === opt.days
                ? "bg-surface-lighter text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {statsData === undefined ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-surface-light rounded-xl p-4 animate-pulse"
            >
              <div className="h-3 bg-surface-lighter rounded w-16 mx-auto mb-2" />
              <div className="h-7 bg-surface-lighter rounded w-12 mx-auto" />
            </div>
          ))}
        </div>
      ) : (
        <Stats data={statsData} />
      )}

      <div className="text-center">
        <NavLink
          to="/timer"
          className="inline-block px-8 py-3 bg-pomored hover:bg-pomored-dark text-white rounded-xl font-bold text-lg transition-colors font-mono"
          data-testid="start-pomodoro-link"
        >
          Start Pomodoro
        </NavLink>
      </div>

      <div>
        <h2 className="text-lg font-mono font-bold text-gray-400 mb-4">
          Today's Sessions
        </h2>
        <SessionList sessions={todaySessions ?? []} />
      </div>
    </div>
  );
}
