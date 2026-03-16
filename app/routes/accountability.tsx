import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { NavLink } from "react-router";
import { useUserId } from "~/lib/useUserId";
import {
  computeAccountability,
  computeTrend,
  gradeColor,
  scoreColor,
  segmentColor,
  type Gap,
  type TimelineSegment,
} from "~/lib/accountability";

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function TrendArrow({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up")
    return <span className="text-breakgreen font-mono text-xl ml-2" title="Trending up">↑</span>;
  if (trend === "down")
    return <span className="text-pomored font-mono text-xl ml-2" title="Trending down">↓</span>;
  return <span className="text-gray-500 font-mono text-xl ml-2" title="Flat">→</span>;
}

function TimelineBar({ segments }: { segments: TimelineSegment[] }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-gray-600 text-xs font-mono">
        <span>9:00</span>
        <span>12:00</span>
        <span>15:00</span>
        <span>18:00</span>
      </div>
      <div className="relative h-6 rounded-full overflow-hidden bg-surface-lighter">
        {segments.map((seg, i) => {
          const width = seg.endPct - seg.startPct;
          if (width <= 0) return null;
          return (
            <div
              key={i}
              className={`absolute inset-y-0 ${segmentColor(seg.kind)} ${
                seg.kind === "protected" ? "opacity-90" : seg.kind === "unprotected" ? "opacity-70" : "opacity-30"
              }`}
              style={{
                left: `${seg.startPct}%`,
                width: `${width}%`,
              }}
              title={`${seg.kind}: ${formatTime(seg.startMs)} - ${formatTime(seg.endMs)}`}
            />
          );
        })}
      </div>
      <div className="flex gap-4 text-xs font-mono text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-breakgreen opacity-90 inline-block" /> Protected
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-pomored opacity-70 inline-block" /> Unprotected
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-surface-lighter opacity-30 inline-block" /> Future
        </span>
      </div>
    </div>
  );
}

function ShameLog({ gaps }: { gaps: Gap[] }) {
  if (gaps.length === 0) {
    return (
      <p className="text-breakgreen font-mono text-sm text-center py-4">
        No unprotected windows. Clean record.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {gaps.map((gap, i) => (
        <div
          key={i}
          className="flex items-center justify-between bg-surface rounded-lg px-4 py-3"
        >
          <div className="font-mono text-sm text-gray-300">
            <span className="text-gray-500">{formatTime(gap.startMs)}</span>
            {" — "}
            <span className="text-gray-500">{formatTime(gap.endMs)}</span>
            <span className="ml-3 text-white">{gap.durationMinutes}min</span>
          </div>
          {gap.durationMinutes >= 30 && (
            <span className="bg-pomored/20 text-pomored text-xs font-mono font-bold px-2 py-1 rounded">
              SHAME
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <div className="h-8 bg-surface-lighter rounded w-48 mx-auto animate-pulse" />
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="h-24 w-40 bg-surface-lighter rounded animate-pulse" />
        <div className="h-6 w-32 bg-surface-lighter rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-surface-light rounded-xl p-4 animate-pulse">
            <div className="h-3 bg-surface-lighter rounded w-16 mx-auto mb-2" />
            <div className="h-7 bg-surface-lighter rounded w-12 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AccountabilityPage() {
  const userId = useUserId();
  const data = useQuery(
    api.sessions.accountabilityToday,
    userId ? { userId } : "skip"
  );

  if (data === undefined) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="font-mono text-3xl font-bold text-white">
            Accountability
          </h1>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  const accountability = computeAccountability(data.todaySessions);
  const trend = computeTrend(data.dailyCounts);

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="font-mono text-3xl font-bold text-white">
          Accountability
        </h1>
        <p className="text-gray-500 font-mono text-sm mt-1">
          The shame board doesn't lie
        </p>
      </div>

      {/* Big Score */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-baseline">
          <span
            className={`text-8xl font-mono font-bold tabular-nums ${scoreColor(
              accountability.score
            )}`}
          >
            {accountability.score}
          </span>
          <span className="text-gray-500 text-2xl font-mono ml-1">%</span>
          <TrendArrow trend={trend} />
        </div>
        <span
          className={`text-4xl font-mono font-bold ${gradeColor(
            accountability.grade
          )}`}
        >
          {accountability.grade}
        </span>
        <p className="text-gray-400 font-mono text-sm text-center max-w-md mt-2">
          {accountability.shameMessage}
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface-light rounded-xl p-4 text-center">
          <div className="text-gray-500 text-xs font-mono uppercase mb-1">
            Protected
          </div>
          <div className="text-2xl font-mono font-bold text-breakgreen">
            {accountability.protectedMinutes}m
          </div>
        </div>
        <div className="bg-surface-light rounded-xl p-4 text-center">
          <div className="text-gray-500 text-xs font-mono uppercase mb-1">
            Unprotected
          </div>
          <div className="text-2xl font-mono font-bold text-pomored">
            {accountability.unprotectedMinutes}m
          </div>
        </div>
        <div className="bg-surface-light rounded-xl p-4 text-center">
          <div className="text-gray-500 text-xs font-mono uppercase mb-1">
            Longest Gap
          </div>
          <div
            className={`text-2xl font-mono font-bold ${
              accountability.longestGapMinutes >= 30
                ? "text-pomored"
                : accountability.longestGapMinutes >= 15
                  ? "text-yellow-400"
                  : "text-breakgreen"
            }`}
          >
            {accountability.longestGapMinutes}m
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-surface-light rounded-xl p-6">
        <h2 className="text-sm font-mono font-bold text-gray-400 uppercase mb-4">
          Today's Timeline
        </h2>
        <TimelineBar segments={accountability.timeline} />
      </div>

      {/* Shame Log */}
      <div className="bg-surface-light rounded-xl p-6">
        <h2 className="text-sm font-mono font-bold text-gray-400 uppercase mb-4">
          Unprotected Windows
        </h2>
        <ShameLog gaps={accountability.gaps} />
      </div>

      {/* CTA */}
      {accountability.score < 75 && !accountability.workdayEnded && (
        <div className="text-center">
          <NavLink
            to="/timer"
            className="inline-block px-8 py-3 bg-pomored hover:bg-pomored-dark text-white rounded-xl font-bold text-lg transition-colors font-mono animate-pulse"
          >
            Start a Pomodoro — now
          </NavLink>
        </div>
      )}
    </div>
  );
}
