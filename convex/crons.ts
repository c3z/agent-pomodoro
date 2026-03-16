import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "generate nudges",
  { minutes: 30 },
  internal.nudges.generateNudges
);

export default crons;
