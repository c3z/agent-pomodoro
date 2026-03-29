/**
 * accountability.ts — Pure computation library for accountability scoring.
 * No React, no Convex. Just math and shame.
 */

// ---------- Types ----------

export interface RawSession {
  type: "work" | "break" | "longBreak";
  durationMinutes: number;
  startedAt: number;
  completedAt?: number;
  completed: boolean;
  interrupted: boolean;
}

export interface Gap {
  startMs: number;
  endMs: number;
  durationMinutes: number;
}

export type SegmentKind = "protected" | "unprotected" | "break" | "away" | "future";

export interface TimelineSegment {
  kind: SegmentKind;
  startMs: number;
  endMs: number;
  /** 0-100, position within working window */
  startPct: number;
  /** 0-100 */
  endPct: number;
}

export type Grade = "S" | "A" | "B" | "C" | "F";

export interface AccountabilityData {
  score: number;
  grade: Grade;
  shameMessage: string;
  protectedMinutes: number;
  unprotectedMinutes: number;
  awayMinutes: number;
  longestGapMinutes: number;
  gaps: Gap[];
  timeline: TimelineSegment[];
  workdayStarted: boolean;
  workdayEnded: boolean;
  /** 0-100 how far through the workday we are */
  workdayProgress: number;
  /** Whether heartbeat data is available (enables away detection) */
  hasPresenceData: boolean;
}

// ---------- Constants ----------

const MIN_GAP_MS = 5 * 60 * 1000; // 5 minutes

// ---------- Workday Hours (localStorage) ----------

const WORKDAY_KEY = "apom_workday";

export function loadWorkdayHours(): { start: number; end: number } {
  try {
    const raw = localStorage.getItem(WORKDAY_KEY);
    if (!raw) return { start: 9, end: 18 };
    return JSON.parse(raw);
  } catch {
    return { start: 9, end: 18 };
  }
}

export function saveWorkdayHours(start: number, end: number) {
  localStorage.setItem(WORKDAY_KEY, JSON.stringify({ start, end }));
}

// ---------- Helpers ----------

function todayAtHour(hour: number, nowMs: number): number {
  const d = new Date(nowMs);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

function gradeFromScore(score: number): Grade {
  if (score >= 90) return "S";
  if (score >= 75) return "A";
  if (score >= 55) return "B";
  if (score >= 35) return "C";
  return "F";
}

function shameMessageForGrade(grade: Grade, score: number, longestGapMin: number): string {
  switch (grade) {
    case "S":
      return "Machine-level discipline. The agents approve.";
    case "A":
      return "Solid work. A few cracks in the armor, but respectable.";
    case "B":
      return `${Math.round(100 - score)}% of your workday unprotected. That's not focus, that's hope.`;
    case "C":
      return `Longest gap: ${longestGapMin} minutes of pure chaos. Your future self is disappointed.`;
    case "F":
      return "Did you even sit down today? The timer exists for a reason.";
  }
}

interface Interval {
  start: number;
  end: number;
}

/**
 * Merge overlapping/touching intervals. Returns sorted, non-overlapping intervals.
 */
function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push({ ...sorted[i] });
    }
  }
  return merged;
}

// ---------- Presence (heartbeat) helpers ----------

const PRESENCE_GAP_MS = 5 * 60 * 1000; // 5 min — merge heartbeat windows within this gap
const HEARTBEAT_WINDOW_MS = 5 * 60 * 1000; // each heartbeat covers 5 minutes

/**
 * Convert an array of heartbeat windowStart timestamps into merged "at desk" intervals.
 */
export function buildPresenceIntervals(
  heartbeatWindows: number[],
  workStart: number,
  workEnd: number
): Interval[] {
  if (heartbeatWindows.length === 0) return [];

  const raw: Interval[] = heartbeatWindows
    .map((ws) => ({
      start: Math.max(ws, workStart),
      end: Math.min(ws + HEARTBEAT_WINDOW_MS, workEnd),
    }))
    .filter((iv) => iv.start < iv.end);

  if (raw.length === 0) return [];

  // Merge with PRESENCE_GAP tolerance (bridge small gaps between heartbeats)
  const sorted = [...raw].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start - last.end <= PRESENCE_GAP_MS) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push({ ...sorted[i] });
    }
  }
  return merged;
}

/**
 * Check if a point in time falls within any of the given intervals.
 */
function isInIntervals(ms: number, intervals: Interval[]): boolean {
  for (const iv of intervals) {
    if (ms >= iv.start && ms < iv.end) return true;
    if (iv.start > ms) break; // sorted, no need to check further
  }
  return false;
}

// ---------- Main ----------

export function computeAccountability(
  sessions: RawSession[],
  nowMs?: number,
  workStartHour: number = 9,
  workEndHour: number = 18,
  heartbeatWindows?: number[]
): AccountabilityData {
  const now = nowMs ?? Date.now();
  const workStart = todayAtHour(workStartHour, now);
  const workEnd = todayAtHour(workEndHour, now);
  const workingWindowMs = (workEndHour - workStartHour) * 60 * 60 * 1000;

  const hasPresenceData = Array.isArray(heartbeatWindows) && heartbeatWindows.length > 0;
  const workdayStarted = now >= workStart;
  const workdayEnded = now >= workEnd;
  const effectiveNow = workdayEnded ? workEnd : now;
  const workdayProgress = !workdayStarted
    ? 0
    : Math.min(100, ((effectiveNow - workStart) / workingWindowMs) * 100);

  // Before workday: empty results
  if (!workdayStarted) {
    return {
      score: 100,
      grade: "S",
      shameMessage: "Workday hasn't started yet. Enjoy the calm.",
      protectedMinutes: 0,
      unprotectedMinutes: 0,
      awayMinutes: 0,
      longestGapMinutes: 0,
      gaps: [],
      timeline: [
        {
          kind: "future",
          startMs: workStart,
          endMs: workEnd,
          startPct: 0,
          endPct: 100,
        },
      ],
      workdayStarted: false,
      workdayEnded: false,
      workdayProgress: 0,
      hasPresenceData: false,
    };
  }

  // Build protected intervals from sessions that overlap the working window
  const protectedIntervals: Interval[] = [];
  for (const s of sessions) {
    const sessionEnd = s.completedAt
      ? s.completedAt
      : s.completed || s.interrupted
        ? s.startedAt + s.durationMinutes * 60 * 1000
        : // Active session — runs until now or its full duration, whichever is less
          Math.min(now, s.startedAt + s.durationMinutes * 60 * 1000);

    // Clip to working window
    const clippedStart = Math.max(s.startedAt, workStart);
    const clippedEnd = Math.min(sessionEnd, workEnd);
    if (clippedStart >= clippedEnd) continue;

    protectedIntervals.push({ start: clippedStart, end: clippedEnd });
  }

  const merged = mergeIntervals(protectedIntervals);

  // Build presence intervals from heartbeats (if available)
  const presenceIntervals = hasPresenceData
    ? buildPresenceIntervals(heartbeatWindows!, workStart, workEnd)
    : null;

  // Calculate protected minutes
  let protectedMs = 0;
  for (const iv of merged) {
    protectedMs += iv.end - iv.start;
  }

  // Calculate elapsed working time
  const elapsedMs = effectiveNow - workStart;
  const protectedMinutes = Math.round(protectedMs / 60000);

  // Calculate away vs unprotected time
  let awayMs = 0;
  let unprotectedMs = 0;

  if (presenceIntervals) {
    // With presence data: unprotected = at desk without pomodoro, away = not at desk
    // Walk through elapsed time in 1-minute steps for accuracy
    const stepMs = 60 * 1000;
    for (let t = workStart; t < effectiveNow; t += stepMs) {
      if (isInIntervals(t, merged)) continue; // protected — skip
      if (isInIntervals(t, presenceIntervals)) {
        unprotectedMs += stepMs;
      } else {
        awayMs += stepMs;
      }
    }
  } else {
    // No presence data: all non-protected time is unprotected (legacy behavior)
    unprotectedMs = elapsedMs - protectedMs;
  }

  const unprotectedMinutes = Math.round(unprotectedMs / 60000);
  const awayMinutes = Math.round(awayMs / 60000);

  // Score: protected / (protected + unprotected). Away is excluded.
  const accountableMs = protectedMs + unprotectedMs;
  const score =
    accountableMs > 0
      ? Math.round((protectedMs / accountableMs) * 100)
      : 100;

  // Detect gaps — only count unprotected-at-desk gaps (not away)
  const gaps: Gap[] = [];
  let cursor = workStart;
  for (const iv of merged) {
    if (iv.start - cursor >= MIN_GAP_MS) {
      const gapEnd = Math.min(iv.start, effectiveNow);
      if (gapEnd > cursor) {
        // If we have presence data, only count gap if user was at desk
        if (presenceIntervals) {
          const gapHasPresence = presenceIntervals.some(
            (p) => p.start < gapEnd && p.end > cursor
          );
          if (gapHasPresence) {
            gaps.push({
              startMs: cursor,
              endMs: gapEnd,
              durationMinutes: Math.round((gapEnd - cursor) / 60000),
            });
          }
        } else {
          gaps.push({
            startMs: cursor,
            endMs: gapEnd,
            durationMinutes: Math.round((gapEnd - cursor) / 60000),
          });
        }
      }
    }
    cursor = iv.end;
  }
  // Gap after last session until now
  if (effectiveNow - cursor >= MIN_GAP_MS) {
    if (presenceIntervals) {
      const gapHasPresence = presenceIntervals.some(
        (p) => p.start < effectiveNow && p.end > cursor
      );
      if (gapHasPresence) {
        gaps.push({
          startMs: cursor,
          endMs: effectiveNow,
          durationMinutes: Math.round((effectiveNow - cursor) / 60000),
        });
      }
    } else {
      gaps.push({
        startMs: cursor,
        endMs: effectiveNow,
        durationMinutes: Math.round((effectiveNow - cursor) / 60000),
      });
    }
  }

  const longestGapMinutes =
    gaps.length > 0 ? Math.max(...gaps.map((g) => g.durationMinutes)) : 0;

  // Build timeline segments — now with "away" support
  const timeline: TimelineSegment[] = [];
  const toPct = (ms: number) =>
    Math.max(0, Math.min(100, ((ms - workStart) / workingWindowMs) * 100));

  let tlCursor = workStart;
  for (const iv of merged) {
    // Gap before this session — split into away/unprotected
    if (iv.start > tlCursor) {
      const gapEnd = Math.min(iv.start, effectiveNow);
      if (gapEnd > tlCursor) {
        pushGapSegments(timeline, tlCursor, gapEnd, presenceIntervals, toPct);
      }
    }
    // Protected session
    timeline.push({
      kind: "protected",
      startMs: iv.start,
      endMs: iv.end,
      startPct: toPct(iv.start),
      endPct: toPct(iv.end),
    });
    tlCursor = iv.end;
  }

  // Gap after last session until now
  if (effectiveNow > tlCursor) {
    pushGapSegments(timeline, tlCursor, effectiveNow, presenceIntervals, toPct);
  }

  // Future portion (after now until workday end)
  if (!workdayEnded && effectiveNow < workEnd) {
    timeline.push({
      kind: "future",
      startMs: effectiveNow,
      endMs: workEnd,
      startPct: toPct(effectiveNow),
      endPct: 100,
    });
  }

  const grade = gradeFromScore(score);

  return {
    score: Math.max(0, Math.min(100, score)),
    grade,
    shameMessage: shameMessageForGrade(grade, score, longestGapMinutes),
    protectedMinutes,
    unprotectedMinutes,
    awayMinutes,
    longestGapMinutes,
    gaps,
    timeline,
    workdayStarted,
    workdayEnded,
    workdayProgress,
    hasPresenceData,
  };
}

/**
 * Push gap segments, splitting by presence data into "unprotected" vs "away".
 */
function pushGapSegments(
  timeline: TimelineSegment[],
  start: number,
  end: number,
  presenceIntervals: Interval[] | null,
  toPct: (ms: number) => number
) {
  if (!presenceIntervals) {
    // No presence data — entire gap is unprotected (legacy)
    timeline.push({
      kind: "unprotected",
      startMs: start,
      endMs: end,
      startPct: toPct(start),
      endPct: toPct(end),
    });
    return;
  }

  // Split gap by presence intervals into away/unprotected chunks
  let cursor = start;
  for (const p of presenceIntervals) {
    if (p.end <= cursor) continue;
    if (p.start >= end) break;

    // Away chunk before presence
    if (p.start > cursor) {
      const awayEnd = Math.min(p.start, end);
      timeline.push({
        kind: "away",
        startMs: cursor,
        endMs: awayEnd,
        startPct: toPct(cursor),
        endPct: toPct(awayEnd),
      });
    }

    // Unprotected chunk during presence
    const unpStart = Math.max(p.start, cursor);
    const unpEnd = Math.min(p.end, end);
    if (unpEnd > unpStart) {
      timeline.push({
        kind: "unprotected",
        startMs: unpStart,
        endMs: unpEnd,
        startPct: toPct(unpStart),
        endPct: toPct(unpEnd),
      });
    }

    cursor = Math.max(cursor, unpEnd);
  }

  // Remaining away chunk after last presence
  if (cursor < end) {
    timeline.push({
      kind: "away",
      startMs: cursor,
      endMs: end,
      startPct: toPct(cursor),
      endPct: toPct(end),
    });
  }
}

/**
 * Compute a simple trend from daily session counts.
 * Returns "up", "down", or "flat".
 */
export function computeTrend(dailyCounts: number[]): "up" | "down" | "flat" {
  if (dailyCounts.length < 2) return "flat";
  // Compare average of last 3 days vs first 4 days
  const recent = dailyCounts.slice(-3);
  const older = dailyCounts.slice(0, 4);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const diff = recentAvg - olderAvg;
  if (diff > 0.5) return "up";
  if (diff < -0.5) return "down";
  return "flat";
}

/**
 * Grade color class
 */
export function gradeColor(grade: Grade): string {
  switch (grade) {
    case "S":
      return "text-breakgreen";
    case "A":
      return "text-breakgreen";
    case "B":
      return "text-yellow-400";
    case "C":
      return "text-pomored";
    case "F":
      return "text-pomored";
  }
}

/**
 * Score to color class
 */
export function scoreColor(score: number): string {
  if (score >= 75) return "text-breakgreen";
  if (score >= 55) return "text-yellow-400";
  return "text-pomored";
}

/**
 * Timeline segment color class
 */
export function segmentColor(kind: SegmentKind): string {
  switch (kind) {
    case "protected":
      return "bg-breakgreen";
    case "unprotected":
      return "bg-pomored";
    case "break":
      return "bg-blue-400";
    case "away":
      return "bg-blue-400/50";
    case "future":
      return "bg-surface-lighter";
  }
}
