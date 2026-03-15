interface Session {
  _id: string;
  type: "work" | "break" | "longBreak";
  durationMinutes: number;
  startedAt: number;
  completedAt?: number;
  completed: boolean;
  interrupted: boolean;
  notes?: string;
}

const TYPE_ICONS: Record<string, string> = {
  work: "🔴",
  break: "🟢",
  longBreak: "🔵",
};

function formatDateLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function groupByDate(sessions: Session[]): Map<string, Session[]> {
  const groups = new Map<string, Session[]>();
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const group = groups.get(key) ?? [];
    group.push(s);
    groups.set(key, group);
  }
  return groups;
}

export function SessionList({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8 font-mono">
        No sessions yet. Start your first pomodoro!
      </div>
    );
  }

  const grouped = groupByDate(sessions);

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([key, daySessions]) => {
        const dateLabel = formatDateLabel(new Date(daySessions[0].startedAt));
        const workCount = daySessions.filter(
          (s) => s.type === "work" && s.completed
        ).length;

        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-mono font-bold text-gray-400">
                {dateLabel}
              </h3>
              <span className="text-xs font-mono text-gray-600">
                {workCount} pomodoro{workCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-1">
              {daySessions.map((s) => {
                const time = new Date(s.startedAt);
                const timeStr = time.toLocaleTimeString("en", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={s._id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                      s.interrupted
                        ? "bg-surface-light/50 opacity-60"
                        : "bg-surface-light"
                    }`}
                  >
                    <span className="text-lg">{TYPE_ICONS[s.type]}</span>
                    <span className="font-mono text-sm text-gray-400">
                      {timeStr}
                    </span>
                    <span className="font-mono text-sm">
                      {s.durationMinutes}min {s.type}
                    </span>
                    {s.completed && (
                      <span className="text-breakgreen text-xs font-mono">
                        ✓
                      </span>
                    )}
                    {s.interrupted && (
                      <span className="text-pomored text-xs font-mono">
                        interrupted
                      </span>
                    )}
                    {s.notes && (
                      <span className="text-gray-500 text-xs ml-auto truncate max-w-48">
                        {s.notes}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
