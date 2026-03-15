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

export function SessionList({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8 font-mono">
        No sessions yet. Start your first pomodoro!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((s) => {
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
            <span className="font-mono text-sm text-gray-400">{timeStr}</span>
            <span className="font-mono text-sm">
              {s.durationMinutes}min {s.type}
            </span>
            {s.completed && (
              <span className="text-breakgreen text-xs font-mono">✓</span>
            )}
            {s.interrupted && (
              <span className="text-pomored text-xs font-mono">interrupted</span>
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
  );
}
