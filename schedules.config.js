/**
 * Centralized schedule config for all API scripts.
 * Each entry: { script, schedule, args?, timezone?, description? }
 *
 * Cron format: "minute hour day-of-month month day-of-week"
 * Use timezone to run in a specific TZ (e.g. "America/New_York" for EST).
 *
 * Examples:

 */
export default [
  {
    script: "clearCache.js",
    schedule: "0 1 * * 1-6",
    timezone: "America/New_York",
    description: "Clear all cache JSON files — 1am EST (Mon–Sat)",
  },
  {
    script: "targetNoAnswer.js",
    args: ["pull"],
    schedule: "*/10 9-17 * * 1-6",
    timezone: "America/New_York",
    description: "Target no-answer — every 10 min, 9am–5pm EST (Mon–Sat)",
  },
  {
    script: "multiTags.js",
    schedule: "0 9,11,13,15,17 * * 1-6",
    timezone: "America/New_York",
    description: "Multi tags — every 2 hrs, 9am–5pm EST (Mon–Sat)",
  },
  {
    script: "pgnmNumberpool.js",
    schedule: "0 9,11,13,15,17 * * 1-6",
    timezone: "America/New_York",
    description: "Number pool — every 2 hrs, 9am–5pm EST (Mon–Sat)",
  },
  {
    script: "targetHangpUps.js",
    schedule: "*/3 9-17 * * 1-6",
    timezone: "America/New_York",
    description: "Target hangups — every 3 min, 9am–5pm EST (Mon–Sat)",
  },
  {
    script: "consecutiveCalls.js",
    schedule: "*/10 9-17 * * 1-6",
    timezone: "America/New_York",
    description: "Consecutive calls — every 10 min, 9am–5pm EST (Mon–Sat)",
  },
  {
    script: "consecutiveCallsSameBid.js",
    schedule: "*/30 9-17 * * 1-6",
    timezone: "America/New_York",
    description: "Consecutive calls same bid — every 30 min, 9am–5pm EST (Mon–Sat)",
  },
  {
    script: "elitePickUp.js",
    schedule: "0,15,30,45 9-17 * * 1-6",
    timezone: "America/New_York",
    description: "Elite pick up — every 15 min, 9am–5pm EST (Mon–Sat)",
  },
  {
    script: "campaignDropRate.js",
    schedule: "0,30 9-17 * * 1-6",
    timezone: "America/New_York",
    description: "Campaign drop rate — every 30 min, 9am–5pm EST (Mon–Sat)",
  },
  // Add your 5 more APIs here with their schedules
  // { script: "myScript.js", schedule: "0 */2 * * *", timezone: "America/New_York", description: "Every 2 hours" },
];
