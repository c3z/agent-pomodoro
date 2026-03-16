import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useUserId } from "~/lib/useUserId";

function HabitCheckbox({
  habit,
  userId,
  date,
}: {
  habit: any;
  userId: string;
  date: string;
}) {
  const checkinMut = useMutation(api.habits.checkin);
  const uncheckinMut = useMutation(api.habits.uncheckin);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      if (habit.completed) {
        await uncheckinMut({ habitId: habit._id, userId, date });
      } else {
        await checkinMut({ habitId: habit._id, userId, date });
      }
    } finally {
      setLoading(false);
    }
  };

  const phaseLabel = habit.phase === "hard" ? "H" : "E";
  const phaseColor = habit.phase === "hard" ? "text-pomored" : "text-breakgreen";

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
        habit.completed
          ? "bg-surface-light/50 opacity-75"
          : "bg-surface-light hover:bg-surface-lighter"
      } ${loading ? "opacity-50" : ""}`}
    >
      <div
        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
          habit.completed
            ? "bg-breakgreen border-breakgreen"
            : "border-gray-600"
        }`}
      >
        {habit.completed && (
          <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={`font-mono text-sm ${habit.completed ? "line-through text-gray-500" : "text-white"}`}>
            {habit.name}
          </span>
          {habit.isLinchpin && <span className="text-yellow-500 text-xs">★</span>}
          <span className={`text-[10px] font-mono ${phaseColor}`}>[{phaseLabel}]</span>
        </div>
        {habit.description && (
          <p className="text-gray-600 text-xs font-mono mt-0.5">{habit.description}</p>
        )}
      </div>

      <div className="text-right shrink-0">
        <span className="text-gray-600 text-[10px] font-mono">
          {habit.cyclePhase} d{habit.cycleDay}/21
        </span>
      </div>
    </button>
  );
}

function CycleIndicator({ habit }: { habit: any }) {
  const day = habit.cycleDay ?? 1;
  const pct = Math.round((day / 21) * 100);
  const phaseColors: Record<string, string> = {
    forming: "bg-pomored",
    testing: "bg-yellow-500",
    established: "bg-breakgreen",
  };
  const barColor = phaseColors[habit.cyclePhase] ?? "bg-gray-500";

  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-500 font-mono text-[10px] w-16 shrink-0">
        {habit.name.length > 8 ? habit.name.slice(0, 7) + "…" : habit.name}
      </span>
      <div className="flex-1 h-1.5 bg-surface-lighter rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-gray-600 font-mono text-[10px] w-20 text-right">
        {habit.cyclePhase} {day}/21
      </span>
    </div>
  );
}

function AddHabitForm({ userId, onClose }: { userId: string; onClose: () => void }) {
  const createMut = useMutation(api.habits.create);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [phase, setPhase] = useState<"hard" | "easy">("easy");
  const [linchpin, setLinchpin] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createMut({
        userId,
        name: name.trim(),
        description: desc.trim() || undefined,
        phase,
        isLinchpin: linchpin || undefined,
      });
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-surface-light rounded-xl p-4 space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Habit name (e.g. Morning exercise)"
        className="w-full bg-surface rounded-lg px-3 py-2 font-mono text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-pomored"
        maxLength={100}
        autoFocus
      />
      <input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Description (optional)"
        className="w-full bg-surface rounded-lg px-3 py-2 font-mono text-xs text-gray-400 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-pomored"
        maxLength={500}
      />
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPhase("hard")}
            className={`px-3 py-1 rounded-lg font-mono text-xs transition-colors ${
              phase === "hard" ? "bg-pomored text-white" : "bg-surface text-gray-500"
            }`}
          >
            Hard (Phase 1)
          </button>
          <button
            type="button"
            onClick={() => setPhase("easy")}
            className={`px-3 py-1 rounded-lg font-mono text-xs transition-colors ${
              phase === "easy" ? "bg-breakgreen text-black" : "bg-surface text-gray-500"
            }`}
          >
            Easy (Phase 2)
          </button>
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={linchpin}
            onChange={(e) => setLinchpin(e.target.checked)}
            className="rounded"
          />
          <span className="font-mono text-xs text-gray-400">Linchpin ★</span>
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="px-4 py-1.5 bg-breakgreen text-black rounded-lg font-mono text-xs font-bold disabled:opacity-50"
        >
          Add Habit
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 bg-surface text-gray-400 rounded-lg font-mono text-xs"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function HabitCalendar({ userId, habitId }: { userId: string; habitId: Id<"habits"> }) {
  const calendar = useQuery(api.habits.checkinCalendar, { userId, habitId, days: 30 });
  if (!calendar) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-mono font-bold text-gray-500 uppercase tracking-wider">
        30-Day Grid
      </h2>
      <div className="flex flex-wrap gap-1">
        {calendar.map((day: any) => (
          <div
            key={day.date}
            className={`w-4 h-4 rounded-sm ${
              day.completed ? "bg-breakgreen" : "bg-surface-lighter"
            }`}
            title={`${day.date}${day.completed ? " ✓" : ""}`}
          />
        ))}
      </div>
      <p className="text-gray-600 font-mono text-[10px]">
        {calendar.filter((d: any) => d.completed).length}/{calendar.length} days
      </p>
    </div>
  );
}

export default function Habits() {
  const userId = useUserId();
  const status = useQuery(
    api.habits.dailyStatus,
    userId ? { userId } : "skip"
  );
  const cycles = useQuery(
    api.habits.cycleStatus,
    userId ? { userId } : "skip"
  );
  const stats = useQuery(
    api.habits.habitStats,
    userId ? { userId, sinceDaysAgo: 30 } : "skip"
  );
  const [showAdd, setShowAdd] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<Id<"habits"> | null>(null);

  if (!userId) return null;

  const habits = status?.habits ?? [];
  const total = status?.total ?? 0;
  const done = status?.done ?? 0;
  const target = status?.hubermanTarget;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold font-mono text-white">Habits</h1>
        <p className="text-gray-500 font-mono text-xs">
          Huberman protocol — max 6, target 85%
        </p>
      </div>

      {/* Score */}
      {total > 0 && (
        <div className="text-center">
          <span className={`text-5xl font-mono font-bold tabular-nums ${
            target?.met ? "text-breakgreen" : pct > 0 ? "text-yellow-500" : "text-red-400"
          }`}>
            {done}/{total}
          </span>
          <div className={`font-mono text-sm mt-1 ${
            target?.met ? "text-breakgreen" : "text-gray-500"
          }`}>
            {pct}% — {target?.met ? "ON TARGET" : "below 85%"}
          </div>
        </div>
      )}

      {/* Habit checklist */}
      <div className="space-y-2">
        {habits.map((h: any) => (
          <HabitCheckbox
            key={h._id}
            habit={h}
            userId={userId}
            date={status?.date ?? new Date().toISOString().slice(0, 10)}
          />
        ))}
      </div>

      {/* Add habit */}
      {total < 6 && !showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full p-3 rounded-xl border-2 border-dashed border-gray-700 text-gray-500 font-mono text-sm hover:border-gray-500 hover:text-gray-400 transition-colors"
        >
          + Add habit ({total}/6)
        </button>
      )}
      {showAdd && <AddHabitForm userId={userId} onClose={() => setShowAdd(false)} />}
      {total >= 6 && (
        <p className="text-center text-gray-600 font-mono text-xs">
          6/6 habits — Huberman max reached
        </p>
      )}

      {/* 21-day cycles */}
      {cycles && cycles.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-mono font-bold text-gray-500 uppercase tracking-wider">
            21-Day Cycles
          </h2>
          <div className="bg-surface-light rounded-xl p-4 space-y-2">
            {cycles.map((c: any) => (
              <CycleIndicator key={c._id} habit={c} />
            ))}
          </div>
        </div>
      )}

      {/* Stats (2-day bins) */}
      {stats && stats.stats.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-mono font-bold text-gray-500 uppercase tracking-wider">
            Completion Rates (30d)
          </h2>
          <div className="space-y-2">
            {stats.stats.map((s: any) => {
              const barW = Math.min(100, s.binCompletionRate);
              return (
                <button
                  key={s._id}
                  onClick={() => setSelectedHabit(selectedHabit === s._id ? null : s._id)}
                  className="w-full bg-surface-light rounded-lg p-3 text-left hover:bg-surface-lighter transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-gray-300">
                      {s.name} {s.isLinchpin ? "★" : ""}
                    </span>
                    <span className="font-mono text-xs text-gray-500">
                      {s.binCompletionRate}% bins · {s.completionRate}% daily
                    </span>
                  </div>
                  <div className="h-1.5 bg-surface-lighter rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.binCompletionRate >= 85 ? "bg-breakgreen" : s.binCompletionRate >= 50 ? "bg-yellow-500" : "bg-red-400"}`}
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 30-day Calendar (for selected habit) */}
      {selectedHabit && userId && (
        <HabitCalendar userId={userId} habitId={selectedHabit} />
      )}

      {/* Empty state */}
      {total === 0 && !showAdd && (
        <div className="text-center py-8 space-y-3">
          <p className="text-gray-500 font-mono text-sm">No habits yet.</p>
          <p className="text-gray-600 font-mono text-xs max-w-sm mx-auto">
            Start with 2-3 habits. Huberman protocol: max 6, target 4-5/day (85%).
            Hard habits in the morning, easy in the afternoon.
          </p>
        </div>
      )}
    </div>
  );
}
