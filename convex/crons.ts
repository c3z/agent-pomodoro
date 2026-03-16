import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "generate nudges",
  { minutes: 30 },
  internal.nudges.generateNudges
);

crons.daily(
  "advance habit cycles",
  { hourUTC: 5, minuteUTC: 0 },
  internal.habits.cycleAdvanceAll
);

export default crons;
