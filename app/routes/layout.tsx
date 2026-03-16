import { useState, useEffect } from "react";
import { Outlet, NavLink } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Providers } from "~/components/Providers";
import { AuthGate, AuthNav } from "~/components/AuthGate";
import { useUserId } from "~/lib/useUserId";

function ActiveSessionPill() {
  const userId = useUserId();
  const session = useQuery(
    api.sessions.activeSession,
    userId ? { userId } : "skip"
  );
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session]);

  if (!session) return null;

  const remaining = Math.max(
    0,
    Math.ceil(
      (session.startedAt + session.durationMinutes * 60000 - now) / 1000
    )
  );
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <span className="inline-flex items-center gap-1.5 bg-surface-light rounded-full px-2 py-0.5 ml-2">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-breakgreen opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-breakgreen" />
      </span>
      <span className="text-xs font-mono text-breakgreen tabular-nums">
        {mm}:{ss}
      </span>
    </span>
  );
}

function Nav() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `font-mono text-xs sm:text-sm px-2 sm:px-3 py-1.5 rounded-lg transition-colors ${
      isActive
        ? "bg-surface-lighter text-white"
        : "text-gray-500 hover:text-gray-300"
    }`;

  return (
    <nav className="border-b border-surface-lighter">
      <div className="max-w-4xl mx-auto px-2 sm:px-4 h-14 flex items-center justify-between gap-1">
        <div className="flex items-center shrink-0">
          <NavLink
            to="/"
            className="text-pomored font-bold font-mono text-lg"
          >
            <span className="hidden sm:inline">🍅 agent-pomodoro</span>
            <span className="sm:hidden">🍅</span>
          </NavLink>
          <ActiveSessionPill />
        </div>
        <div className="flex gap-1">
          <NavLink to="/" end className={linkClass}>
            <span className="hidden sm:inline">Dashboard</span>
            <span className="sm:hidden">Home</span>
          </NavLink>
          <NavLink to="/timer" className={linkClass}>
            Timer
          </NavLink>
          <NavLink to="/history" className={linkClass}>
            <span className="hidden sm:inline">History</span>
            <span className="sm:hidden">Log</span>
          </NavLink>
          <NavLink to="/accountability" className={linkClass}>
            <span className="hidden sm:inline">Accountability</span>
            <span className="sm:hidden">Score</span>
          </NavLink>
          <NavLink to="/settings" className={linkClass}>
            <span className="hidden sm:inline">Settings</span>
            <span className="sm:hidden">API</span>
          </NavLink>
        </div>
        <AuthNav />
      </div>
    </nav>
  );
}

export default function Layout() {
  return (
    <Providers>
      <div className="min-h-screen">
        <Nav />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <AuthGate>
            <Outlet />
          </AuthGate>
        </main>
      </div>
    </Providers>
  );
}
