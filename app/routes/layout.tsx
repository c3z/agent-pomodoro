import { Outlet, NavLink } from "react-router";
import { Providers } from "~/components/Providers";

function Nav() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `font-mono text-sm px-3 py-1.5 rounded-lg transition-colors ${
      isActive
        ? "bg-surface-lighter text-white"
        : "text-gray-500 hover:text-gray-300"
    }`;

  return (
    <nav className="border-b border-surface-lighter">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <NavLink
          to="/"
          className="text-pomored font-bold font-mono text-lg shrink-0"
        >
          <span className="hidden sm:inline">🍅 agent-pomodoro</span>
          <span className="sm:hidden">🍅</span>
        </NavLink>
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
        </div>
        <div id="clerk-user-button" />
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
          <Outlet />
        </main>
      </div>
    </Providers>
  );
}
