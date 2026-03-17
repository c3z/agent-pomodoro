import { describe, it, expect } from "vitest";
import {
  computeAccountability,
  buildPresenceIntervals,
  type RawSession,
} from "./accountability";

// Helper: create a timestamp for today at given hour:minute
function todayAt(hour: number, minute = 0): number {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

// Helper: generate heartbeat windows (1-min buckets) for a time range
function heartbeatsFor(startHour: number, startMin: number, endHour: number, endMin: number): number[] {
  const start = todayAt(startHour, startMin);
  const end = todayAt(endHour, endMin);
  const windows: number[] = [];
  for (let t = start; t < end; t += 60_000) {
    windows.push(t);
  }
  return windows;
}

function makeSession(
  startHour: number,
  startMin: number,
  durationMinutes: number,
  completed = true
): RawSession {
  return {
    type: "work",
    durationMinutes,
    startedAt: todayAt(startHour, startMin),
    completedAt: completed ? todayAt(startHour, startMin) + durationMinutes * 60_000 : undefined,
    completed,
    interrupted: false,
  };
}

describe("computeAccountability", () => {
  describe("legacy behavior (no heartbeats)", () => {
    it("returns 100% before workday starts", () => {
      const result = computeAccountability([], todayAt(7, 0), 9, 18);
      expect(result.score).toBe(100);
      expect(result.grade).toBe("S");
      expect(result.workdayStarted).toBe(false);
      expect(result.hasPresenceData).toBe(false);
    });

    it("returns 0% with no sessions during workday", () => {
      const result = computeAccountability([], todayAt(12, 0), 9, 18);
      expect(result.score).toBe(0);
      expect(result.grade).toBe("F");
      expect(result.unprotectedMinutes).toBe(180);
      expect(result.awayMinutes).toBe(0);
    });

    it("calculates correct score with sessions", () => {
      const sessions = [makeSession(9, 0, 25), makeSession(9, 30, 25)];
      const result = computeAccountability(sessions, todayAt(10, 0), 9, 18);
      // 50 min protected out of 60 min elapsed
      expect(result.protectedMinutes).toBe(50);
      expect(result.unprotectedMinutes).toBe(10);
      expect(result.score).toBe(83);
    });

    it("all non-protected time is unprotected", () => {
      const sessions = [makeSession(9, 0, 25)];
      const result = computeAccountability(sessions, todayAt(10, 0), 9, 18);
      expect(result.protectedMinutes).toBe(25);
      expect(result.unprotectedMinutes).toBe(35);
      expect(result.awayMinutes).toBe(0);
      expect(result.hasPresenceData).toBe(false);
    });

    it("timeline has only protected/unprotected/future", () => {
      const sessions = [makeSession(9, 0, 25)];
      const result = computeAccountability(sessions, todayAt(10, 0), 9, 18);
      const kinds = result.timeline.map((s) => s.kind);
      expect(kinds).not.toContain("away");
    });
  });

  describe("with heartbeat presence data", () => {
    it("away time is excluded from score", () => {
      // User was at desk 9:00-10:00, then away 10:00-12:00
      const heartbeats = heartbeatsFor(9, 0, 10, 0);
      const sessions = [makeSession(9, 0, 25)]; // 25 min protected

      const result = computeAccountability(sessions, todayAt(12, 0), 9, 18, heartbeats);

      expect(result.hasPresenceData).toBe(true);
      expect(result.protectedMinutes).toBe(25);
      // Only 60 min at desk, 25 protected, so 35 unprotected
      expect(result.unprotectedMinutes).toBe(35);
      // 10:00-12:00 = 120 min away
      expect(result.awayMinutes).toBe(120);
      // Score = 25 / (25 + 35) = 42%
      expect(result.score).toBe(42);
    });

    it("100% score when all desk time is protected", () => {
      // User at desk 9:00-9:30, pomodoro covers 9:00-9:25
      const heartbeats = heartbeatsFor(9, 0, 9, 30);
      const sessions = [makeSession(9, 0, 25)];

      const result = computeAccountability(sessions, todayAt(12, 0), 9, 18, heartbeats);

      expect(result.protectedMinutes).toBe(25);
      // 5 min at desk without pomodoro
      expect(result.unprotectedMinutes).toBe(5);
      // 9:30-12:00 = 150 min away
      expect(result.awayMinutes).toBe(150);
      // 25 / (25 + 5) = 83%
      expect(result.score).toBe(83);
    });

    it("fully away day = 100% score", () => {
      // No heartbeats, no sessions
      const result = computeAccountability([], todayAt(12, 0), 9, 18, []);

      // Empty array = hasPresenceData false
      expect(result.hasPresenceData).toBe(false);
      // Falls back to legacy: 0 sessions in 3 hours = 0%
      expect(result.score).toBe(0);
    });

    it("timeline shows away segments", () => {
      // At desk 9:00-9:30, then away
      const heartbeats = heartbeatsFor(9, 0, 9, 30);
      const sessions = [makeSession(9, 0, 25)];

      const result = computeAccountability(sessions, todayAt(11, 0), 9, 18, heartbeats);

      const kinds = result.timeline.map((s) => s.kind);
      expect(kinds).toContain("protected");
      expect(kinds).toContain("away");
      expect(kinds).toContain("future");
    });

    it("mixed presence creates correct segments", () => {
      // At desk 9:00-10:00, away 10:00-11:00, back at desk 11:00-12:00
      const heartbeats = [
        ...heartbeatsFor(9, 0, 10, 0),
        ...heartbeatsFor(11, 0, 12, 0),
      ];
      const sessions = [
        makeSession(9, 0, 25),   // 9:00-9:25 protected
        makeSession(11, 0, 25),  // 11:00-11:25 protected
      ];

      const result = computeAccountability(sessions, todayAt(12, 0), 9, 18, heartbeats);

      expect(result.protectedMinutes).toBe(50);
      // At desk 120 min total, 50 protected, 70 unprotected
      expect(result.unprotectedMinutes).toBe(70);
      // Away: 10:00-11:00 = 60 min
      expect(result.awayMinutes).toBe(60);
      // Score: 50 / (50 + 70) = 42%
      expect(result.score).toBe(42);
    });

    it("gaps only count when user was at desk", () => {
      // At desk 9:00-9:30, away 9:30-11:00
      const heartbeats = heartbeatsFor(9, 0, 9, 30);
      const sessions = [makeSession(9, 0, 25)]; // 9:00-9:25

      const result = computeAccountability(sessions, todayAt(11, 0), 9, 18, heartbeats);

      // Gap 9:25-11:00 has some presence (9:25-9:30), so it shows
      // But the important thing: most of it is away, not red
      expect(result.gaps.length).toBe(1);
      expect(result.gaps[0].durationMinutes).toBe(95);
    });

    it("gap is suppressed when entire gap is away", () => {
      // At desk 9:00-9:25 (exactly matches pomodoro), away after
      const heartbeats = heartbeatsFor(9, 0, 9, 25);
      const sessions = [makeSession(9, 0, 25)]; // 9:00-9:25

      const result = computeAccountability(sessions, todayAt(11, 0), 9, 18, heartbeats);

      // Gap 9:25-11:00 has NO presence, so no gaps reported
      expect(result.gaps.length).toBe(0);
    });

    it("large at-desk gap still shows in gaps", () => {
      // At desk 9:00-10:00, pomodoro 9:00-9:25 only
      const heartbeats = heartbeatsFor(9, 0, 10, 0);
      const sessions = [makeSession(9, 0, 25)];

      const result = computeAccountability(sessions, todayAt(10, 0), 9, 18, heartbeats);

      // 9:25-10:00 = 35 min gap, user was at desk
      expect(result.gaps.length).toBe(1);
      expect(result.gaps[0].durationMinutes).toBe(35);
    });
  });
});

describe("buildPresenceIntervals", () => {
  it("merges adjacent heartbeat windows", () => {
    const windows = heartbeatsFor(9, 0, 9, 10);
    const result = buildPresenceIntervals(windows, todayAt(9, 0), todayAt(18, 0));
    // Should merge into single interval
    expect(result.length).toBe(1);
  });

  it("creates separate intervals for gaps > 5 min", () => {
    const windows = [
      ...heartbeatsFor(9, 0, 9, 5),
      ...heartbeatsFor(9, 15, 9, 20),
    ];
    const result = buildPresenceIntervals(windows, todayAt(9, 0), todayAt(18, 0));
    expect(result.length).toBe(2);
  });

  it("clips to working window", () => {
    // Heartbeats before work start
    const windows = heartbeatsFor(8, 0, 10, 0);
    const result = buildPresenceIntervals(windows, todayAt(9, 0), todayAt(18, 0));
    expect(result.length).toBe(1);
    expect(result[0].start).toBe(todayAt(9, 0));
  });

  it("returns empty for no heartbeats", () => {
    const result = buildPresenceIntervals([], todayAt(9, 0), todayAt(18, 0));
    expect(result).toEqual([]);
  });
});
