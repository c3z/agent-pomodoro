interface StatsData {
  period: string;
  totalWorkSessions: number;
  completedSessions: number;
  interruptedSessions: number;
  completionRate: number;
  totalFocusMinutes: number;
  totalFocusHours: number;
  currentStreak: number;
  lastSessionAt: number | null;
  hoursSinceLastSession: number | null;
  avgSessionsPerDay: number;
}

export function Stats({ data }: { data: StatsData }) {
  const getStreakColor = (streak: number) => {
    if (streak >= 5) return "text-breakgreen";
    if (streak >= 3) return "text-yellow-400";
    return "text-pomored";
  };

  const getHoursColor = (hours: number | null) => {
    if (hours === null) return "text-gray-500";
    if (hours > 24) return "text-pomored";
    if (hours > 8) return "text-yellow-400";
    return "text-breakgreen";
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Streak"
        value={`${data.currentStreak}d`}
        color={getStreakColor(data.currentStreak)}
      />
      <StatCard
        label="Focus Time"
        value={`${data.totalFocusHours}h`}
        sublabel={`${data.period}`}
        color="text-blue-400"
      />
      <StatCard
        label="Completion"
        value={`${data.completionRate}%`}
        sublabel={`${data.completedSessions}/${data.totalWorkSessions}`}
        color={data.completionRate >= 80 ? "text-breakgreen" : "text-yellow-400"}
      />
      <StatCard
        label="Since Last"
        value={
          data.hoursSinceLastSession !== null
            ? data.hoursSinceLastSession < 1
              ? "< 1h"
              : `${data.hoursSinceLastSession}h`
            : "—"
        }
        color={getHoursColor(data.hoursSinceLastSession)}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  color = "text-white",
}: {
  label: string;
  value: string;
  sublabel?: string;
  color?: string;
}) {
  return (
    <div className="bg-surface-light rounded-xl p-4 text-center">
      <div className="text-gray-500 text-xs font-mono uppercase mb-1">
        {label}
      </div>
      <div className={`text-2xl font-mono font-bold ${color}`}>{value}</div>
      {sublabel && (
        <div className="text-gray-600 text-xs font-mono mt-1">{sublabel}</div>
      )}
    </div>
  );
}
