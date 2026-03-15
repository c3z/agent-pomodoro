import { Stats } from "~/components/Stats";
import { SessionList } from "~/components/SessionList";
import { NavLink } from "react-router";

// Placeholder data for dev mode (without Convex)
const PLACEHOLDER_STATS = {
  period: "7d",
  totalWorkSessions: 0,
  completedSessions: 0,
  interruptedSessions: 0,
  completionRate: 0,
  totalFocusMinutes: 0,
  totalFocusHours: 0,
  currentStreak: 0,
  lastSessionAt: null,
  hoursSinceLastSession: null,
  avgSessionsPerDay: 0,
};

export default function Home() {
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

      <Stats data={PLACEHOLDER_STATS} />

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
        <SessionList sessions={[]} />
      </div>
    </div>
  );
}
