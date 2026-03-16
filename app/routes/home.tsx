import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Stats } from "~/components/Stats";
import { SessionList } from "~/components/SessionList";
import { WeeklyHeatmap } from "~/components/WeeklyHeatmap";
import { AccountabilityBadge } from "~/components/AccountabilityBadge";
import { NavLink } from "react-router";
import { useUserId } from "~/lib/useUserId";
import {
  computeAccountability,
  loadWorkdayHours,
  scoreColor,
  gradeColor,
} from "~/lib/accountability";

const PERIOD_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "All", days: 3650 },
] as const;

function DashboardScore({ userId }: { userId: string }) {
  const data = useQuery(
    api.sessions.accountabilityToday,
    userId ? { userId } : "skip"
  );

  if (!data) return null;

  const workday = loadWorkdayHours();
  const acc = computeAccountability(
    data.todaySessions,
    undefined,
    workday.start,
    workday.end
  );

  // Only show during workday hours
  if (!acc.workdayStarted) return null;

  return (
    <NavLink
      to="/accountability"
      className="flex flex-col items-center gap-1 group"
    >
      <div className="flex items-baseline">
        <span
          className={`text-6xl font-mono font-bold tabular-nums ${scoreColor(
            acc.score
          )} group-hover:opacity-80 transition-opacity`}
        >
          {acc.score}
        </span>
        <span className="text-gray-500 text-xl font-mono ml-1">%</span>
      </div>
      <span
        className={`text-2xl font-mono font-bold ${gradeColor(acc.grade)}`}
      >
        {acc.grade}
      </span>
      <span className="text-gray-600 font-mono text-xs">
        accountability today
      </span>
    </NavLink>
  );
}

function GoalProgressBars({ userId }: { userId: string }) {
  const goals = useQuery(api.goals.getGoals, { userId });
  const todaySessions = useQuery(api.sessions.todayByUser, { userId });
  const weekStats = useQuery(api.sessions.stats, { userId, sinceDaysAgo: 7 });

  if (!goals || !todaySessions || !weekStats) return null;

  const todayCompleted = todaySessions.filter(
    (s) => s.type === "work" && s.completed
  ).length;
  const dailyTarget = goals.dailyPomodoros;
  const dailyPct = Math.min(100, Math.round((todayCompleted / dailyTarget) * 100));

  const weeklyHours = weekStats.totalFocusHours;
  const weeklyTarget = goals.weeklyFocusHours;
  const weeklyPct = Math.min(100, Math.round((weeklyHours / weeklyTarget) * 100));

  // Calculate if behind pace for daily (based on hours elapsed in workday 9-18)
  const now = new Date();
  const workdayHour = Math.max(0, Math.min(9, now.getHours() - 9));
  const expectedDailyPct = Math.round((workdayHour / 9) * 100);
  const dailyOnTrack = dailyPct >= expectedDailyPct || todayCompleted >= dailyTarget;

  // Weekly pace: days passed this week (Mon=1)
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
  const expectedWeeklyPct = Math.round((dayOfWeek / 7) * 100);
  const weeklyOnTrack = weeklyPct >= expectedWeeklyPct || weeklyHours >= weeklyTarget;

  return (
    <div className="w-full max-w-md space-y-3">
      {/* Daily progress */}
      <div>
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-gray-400 font-mono text-xs">Today</span>
          <span className={`font-mono text-xs font-bold ${dailyOnTrack ? "text-breakgreen" : "text-red-400"}`}>
            {todayCompleted}/{dailyTarget} pomodoros
          </span>
        </div>
        <div className="h-2 bg-surface-lighter rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              dailyOnTrack ? "bg-breakgreen" : "bg-red-400"
            }`}
            style={{ width: `${dailyPct}%` }}
          />
        </div>
      </div>

      {/* Weekly progress */}
      <div>
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-gray-400 font-mono text-xs">This week</span>
          <span className={`font-mono text-xs font-bold ${weeklyOnTrack ? "text-breakgreen" : "text-red-400"}`}>
            {weeklyHours}/{weeklyTarget}h focus
          </span>
        </div>
        <div className="h-2 bg-surface-lighter rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              weeklyOnTrack ? "bg-breakgreen" : "bg-red-400"
            }`}
            style={{ width: `${weeklyPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

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
  const recentSessions = useQuery(
    api.sessions.listByUser,
    userId ? { userId, limit: 200 } : "skip"
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

      {/* Big Accountability Score */}
      {userId && <DashboardScore userId={userId} />}

      {/* Goal Progress Bars */}
      {userId && (
        <div className="flex justify-center">
          <GoalProgressBars userId={userId} />
        </div>
      )}

      {/* Weekly Heatmap */}
      <WeeklyHeatmap sessions={recentSessions} />

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

      {/* Accountability Badge */}
      <div className="flex justify-center">
        <AccountabilityBadge />
      </div>

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
