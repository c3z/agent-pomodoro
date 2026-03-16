import { useMemo } from "react";

interface Session {
  _id: string;
  type: "work" | "break" | "longBreak";
  startedAt: number;
  completed: boolean;
  interrupted: boolean;
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function getHeatColor(count: number): string {
  if (count === 0) return "bg-surface-lighter";
  if (count <= 2) return "bg-pomored/30";
  if (count <= 4) return "bg-pomored/60";
  return "bg-pomored";
}

function buildGrid(sessions: Session[]): { dayOfWeek: number; weekIndex: number; count: number; date: string }[] {
  // Build a map of date -> completed work session count
  const dayCounts = new Map<string, number>();
  for (const s of sessions) {
    if (s.type !== "work" || !s.completed) continue;
    const d = new Date(s.startedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
  }

  // Build 28-day grid: 4 columns (weeks) x 7 rows (Mon-Sun)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells: { dayOfWeek: number; weekIndex: number; count: number; date: string }[] = [];

  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    // JS getDay: 0=Sun, 1=Mon... Convert to Mon=0, Sun=6
    const jsDay = d.getDay();
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
    const weekIndex = Math.floor((27 - i) / 7);
    const count = dayCounts.get(key) ?? 0;
    cells.push({ dayOfWeek, weekIndex, count, date: key });
  }

  return cells;
}

export function WeeklyHeatmap({ sessions }: { sessions: Session[] | undefined }) {
  const cells = useMemo(() => {
    if (!sessions) return [];
    return buildGrid(sessions);
  }, [sessions]);

  if (!sessions) return null;

  // Organize into a 7x4 grid
  const grid: (typeof cells[number] | null)[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 4 }, () => null)
  );

  for (const cell of cells) {
    if (cell.dayOfWeek >= 0 && cell.dayOfWeek < 7 && cell.weekIndex >= 0 && cell.weekIndex < 4) {
      grid[cell.dayOfWeek][cell.weekIndex] = cell;
    }
  }

  return (
    <div className="flex justify-center">
      <div className="inline-block">
        <div className="text-gray-500 text-xs font-mono mb-2 text-center">
          Last 28 days
        </div>
        <div className="flex gap-1">
          {/* Day labels */}
          <div className="flex flex-col gap-1 mr-1">
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                className="w-4 h-6 flex items-center justify-center text-[10px] font-mono text-gray-600"
              >
                {label}
              </div>
            ))}
          </div>
          {/* Week columns */}
          {[0, 1, 2, 3].map((weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-1">
              {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
                const cell = grid[dayIdx][weekIdx];
                const count = cell?.count ?? 0;
                const dateStr = cell?.date ?? "";
                return (
                  <div
                    key={dayIdx}
                    className={`w-6 h-6 rounded-sm ${getHeatColor(count)} transition-colors`}
                    title={dateStr ? `${dateStr}: ${count} session${count !== 1 ? "s" : ""}` : ""}
                  />
                );
              })}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex items-center justify-center gap-1 mt-2">
          <span className="text-[10px] font-mono text-gray-600">Less</span>
          <div className="w-3 h-3 rounded-sm bg-surface-lighter" />
          <div className="w-3 h-3 rounded-sm bg-pomored/30" />
          <div className="w-3 h-3 rounded-sm bg-pomored/60" />
          <div className="w-3 h-3 rounded-sm bg-pomored" />
          <span className="text-[10px] font-mono text-gray-600">More</span>
        </div>
      </div>
    </div>
  );
}
