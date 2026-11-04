import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval(
  "refresh USD IDR reference rate",
  { hours: 1 },
  internal.router.exchangeRates.refresh,
);
export default crons;
