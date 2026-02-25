/**
 * Ringba → Slack alerts (target no-answer)
 *
 * 1. Fetches insights/events/beta (today EST full day).
 * 2. Only considers records with targetDialed >= 30.
 * 3. Sends Slack alert when a target's noAnswer is >= 20% of their targetDialed.
 * 4. Do not re-alert a target until it has 30+ more calls than when we last alerted.
 *
 * Schedule: every 10 min, 9am–5pm EST (Mon–Sat).
 *
 * Usage:
 *   node targetNoAnswer.js       — run every 10 min (9am–5pm EST only)
 *   node targetNoAnswer.js pull  — single run (no schedule)
 *   node targetNoAnswer.js alert — test Slack webhook
 *
 * Env: RINGBA_ACCOUNT_ID, RINGBA_API_TOKEN, SLACK_WEBHOOK_URL
 */

import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { IncomingWebhook } from "@slack/webhook";

const __dirname = dirname(fileURLToPath(import.meta.url));

const RINGBA_BASE = "https://api.ringba.com/v2";
const RINGBA_USERNAME = process.env.RINGBA_USERNAME;
const RINGBA_PASSWORD = process.env.RINGBA_PASSWORD;
const RINGBA_ACCOUNT_ID = process.env.RINGBA_ACCOUNT_ID;
const RINGBA_API_TOKEN = process.env.RINGBA_API_TOKEN;
/** Set to "X-API-Key" if your API token expects that header instead of Bearer */
const RINGBA_AUTH_HEADER = process.env.RINGBA_AUTH_HEADER || "Bearer";
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const ALERT_CALL_THRESHOLD = parseInt(process.env.ALERT_CALL_THRESHOLD || "1", 10);
const MIN_TARGET_DIALED = 30;
const NO_ANSWER_ALERT_PCT = 0.2; // 20%
const MIN_CALLS_SINCE_LAST_ALERT = 30; // don't re-alert until +30 more calls
const ALERT_CACHE_PATH = join(__dirname, "targetNoAnswerAlertCache.json");
const RUN_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// --- Auth ---

async function getToken(refresh = null) {
  const body = refresh
    ? new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refresh.refresh_token,
        user_name: refresh.userName,
      })
    : new URLSearchParams({
        grant_type: "password",
        username: RINGBA_USERNAME,
        password: RINGBA_PASSWORD,
      });

  const res = await fetch(`${RINGBA_BASE}/Token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ringba auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    token_type: data.token_type || "Bearer",
    refresh_token: data.refresh_token,
    userName: data.userName,
    expires: data[".expires"] ? new Date(data[".expires"]) : null,
  };
}

let cachedToken = null;

async function ensureToken() {
  if (RINGBA_API_TOKEN) {
    return { token_type: "Token", access_token: RINGBA_API_TOKEN };
  }
  if (cachedToken && cachedToken.expires && new Date() < new Date(cachedToken.expires)) {
    return cachedToken;
  }
  cachedToken = await getToken(cachedToken);
  return cachedToken;
}

// --- Insights events (beta) ---
// Endpoint: POST https://api.ringba.com/v2/{accountId}/insights/events/beta
// Payload: [{ reportStart, reportEnd, maxResultsPerGroup }] (ISO dates, report window in EST)

const INSIGHTS_EVENTS_PATH = "insights/events/beta";
const MAX_RESULTS_PER_GROUP = 1000;

/** Whether (y, m, d) in America/New_York is in DST (EDT). */
function isEasternDST(y, m, d) {
  const march1Dow = new Date(y, 2, 1).getDay();
  const secondSunMarch = 8 + (7 - march1Dow) % 7;
  const nov1Dow = new Date(y, 10, 1).getDay();
  const firstSunNov = 1 + (7 - nov1Dow) % 7;
  return (m > 3 && m < 11) || (m === 3 && d >= secondSunMarch) || (m === 11 && d < firstSunNov);
}

/** Start of today 00:00:00 in America/New_York as ISO string. */
function getStartOfTodayEST() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(now);
  const y = parseInt(parts.find((p) => p.type === "year").value, 10);
  const m = parseInt(parts.find((p) => p.type === "month").value, 10);
  const d = parseInt(parts.find((p) => p.type === "day").value, 10);
  const utcHour = isEasternDST(y, m, d) ? 4 : 5;
  return new Date(Date.UTC(y, m - 1, d, utcHour, 0, 0, 0)).toISOString();
}

/** End of today 23:59:59 in America/New_York (returns 04:59:59 UTC next day in winter). */
function getEndOfTodayEST() {
  const start = new Date(getStartOfTodayEST());
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
}

/** ISO string without milliseconds (e.g. 2026-02-20T05:00:00Z) for Ringba. */
function toISOSeconds(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Build payload for insights/events/beta. Full day in EST: reportStart=midnight, reportEnd=23:59:59. */
function buildInsightsPayload() {
  const reportStart = toISOSeconds(new Date(getStartOfTodayEST()));
  const reportEnd = toISOSeconds(new Date(getEndOfTodayEST()));
  return { reportStart, reportEnd, maxResultsPerGroup: MAX_RESULTS_PER_GROUP };
}

async function fetchInsightsEvents(token, options = {}) {
  const accountId = options.accountId || RINGBA_ACCOUNT_ID;
  const url = `${RINGBA_BASE}/${accountId}/${INSIGHTS_EVENTS_PATH}`;
  const requestBody = options.body ?? buildInsightsPayload();

  const headers = { "Content-Type": "application/json" };
  if (RINGBA_AUTH_HEADER === "X-API-Key") {
    headers["X-API-Key"] = token.access_token;
  } else {
    headers.Authorization = `${token.token_type || "Bearer"} ${token.access_token}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Ringba response:", res.status, text || "(empty body)");
    throw new Error(`Ringba insights/events failed: ${res.status} ${text || "(empty body)"}`);
  }

  const data = await res.json();
  return data;
}

/** Build a short summary from insights/events response for Slack */
function summarizeInsightsResponse(data) {
  if (data == null) return { summary: "No data", count: 0 };

  const arr = data?.report?.records ?? data?.report ?? data?.data ?? data?.events ?? data?.result ?? [];
  const list = Array.isArray(arr) ? arr : [];
  const count = list.length;
  const success = data?.isSuccessful === true;

  if (count === 0) {
    const summary = success
      ? "Report succeeded, 0 rows in window."
      : (typeof data === "object" ? `Response keys: ${Object.keys(data).join(", ")}` : "Empty response");
    return { summary, count: 0 };
  }

  return {
    summary: `${count} event(s) from insights/events/beta`,
    count,
    sample: list[0],
  };
}

/** Get today's date in EST (YYYY-MM-DD) for cache key */
function getTodayEST() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(now);
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  return `${y}-${m}-${d}`;
}

/** Current hour in America/New_York (0–23) */
function getHourEST() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false });
  return parseInt(fmt.formatToParts(now).find((p) => p.type === "hour").value, 10);
}

/** Load alert cache: { "YYYY-MM-DD": { targetName: lastTargetDialedWhenAlerted } }. Clears at 1am EST. */
function loadAlertCache() {
  const today = getTodayEST();
  const hourEST = getHourEST();

  let cache = {};
  if (existsSync(ALERT_CACHE_PATH)) {
    try {
      cache = JSON.parse(readFileSync(ALERT_CACHE_PATH, "utf-8"));
    } catch {
      cache = {};
    }
  }

  if (hourEST === 1) {
    cache = { [today]: {} };
    saveAlertCache(cache);
  } else {
    const keys = Object.keys(cache);
    if (keys.length && keys.some((k) => k !== today)) {
      cache = { [today]: cache[today] || {} };
      saveAlertCache(cache);
    }
  }

  return cache;
}

function saveAlertCache(cache) {
  writeFileSync(ALERT_CACHE_PATH, JSON.stringify(cache, null, 2));
}

/** Returns records where targetDialed >= MIN_TARGET_DIALED and noAnswer >= 20% of targetDialed */
function getTargetsWithHighNoAnswer(records) {
  return records.filter((r) => {
    const dialed = Number(r.targetDialed) || 0;
    const noAns = Number(r.noAnswer) || 0;
    if (dialed < MIN_TARGET_DIALED) return false;
    return noAns / dialed >= NO_ANSWER_ALERT_PCT;
  }).map((r) => {
    const dialed = Number(r.targetDialed) || 0;
    const noAns = Number(r.noAnswer) || 0;
    const pct = dialed ? ((noAns / dialed) * 100).toFixed(1) : "0";
    return { targetName: r.targetName, targetDialed: dialed, noAnswer: noAns, noAnswerPct: pct + "%" };
  });
}

/** True if current time is between 9am and 5pm America/New_York */
function isWithin9to5EST() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour").value, 10);
  const weekday = parts.find((p) => p.type === "weekday").value;
  const isWeekday = !["Sat", "Sun"].includes(weekday);
  return isWeekday && hour >= 9 && hour < 17;
}

// --- Slack ---

async function sendSlackAlert(payload) {
  if (!SLACK_WEBHOOK_URL) {
    console.warn("SLACK_WEBHOOK_URL not set; skipping Slack.");
    return;
  }
  const webhook = new IncomingWebhook(SLACK_WEBHOOK_URL);
  await webhook.send(payload);
}

// --- Main ---

async function pullAndAlert() {
  const hasToken = !!RINGBA_API_TOKEN;
  const hasCreds = RINGBA_USERNAME && RINGBA_PASSWORD;
  if (!RINGBA_ACCOUNT_ID) {
    throw new Error("Set RINGBA_ACCOUNT_ID in .env");
  }
  if (!hasToken && !hasCreds) {
    throw new Error("Set either RINGBA_API_TOKEN or RINGBA_USERNAME + RINGBA_PASSWORD in .env");
  }

  const token = await ensureToken();
  const payload = buildInsightsPayload();
  const data = await fetchInsightsEvents(token, { body: payload });
  const { summary, count } = summarizeInsightsResponse(data);

  const records = data?.report?.records ?? [];
  const highNoAnswer = getTargetsWithHighNoAnswer(records);

  const today = getTodayEST();
  const cache = loadAlertCache();
  const todayCache = cache[today] || {};

  const toAlert = highNoAnswer.filter((t) => {
    const lastDialed = todayCache[t.targetName] ?? 0;
    const minRequired = lastDialed + MIN_CALLS_SINCE_LAST_ALERT;
    return t.targetDialed >= minRequired;
  });

  for (const t of toAlert) {
    console.log(`${t.targetName} has more than 20% no answer calls`);
  }

  if (toAlert.length && SLACK_WEBHOOK_URL) {
    const bullets = toAlert
      .map((t) => `• ${t.targetName} has more than 20% no answer calls`)
      .join("\n");
    await sendSlackAlert({
      text: `Ringba high no-answer alert\n${bullets}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Ringba high no-answer alert*\n${bullets}`,
          },
        },
      ],
    });
    for (const t of toAlert) {
      todayCache[t.targetName] = t.targetDialed;
    }
    cache[today] = todayCache;
    saveAlertCache(cache);
    console.log("Slack alert sent for", toAlert.length, "target(s) with high no-answer.");
  }

  return { data, count, highNoAnswer, toAlert };
}

async function testAlert() {
  await sendSlackAlert({
    text: "Ringba → Slack test alert. If you see this, the webhook works.",
  });
  console.log("Test alert sent to Slack.");
}

async function runOnce() {
  if (!isWithin9to5EST()) {
    console.log("Outside 9am–5pm EST; skipping run.");
    return;
  }
  await pullAndAlert();
}

async function main() {
  const cmd = process.argv[2] || "schedule";
  if (cmd === "alert") {
    await testAlert();
    return;
  }
  if (cmd === "pull" || cmd === "once") {
    await pullAndAlert();
    return;
  }
  // default: schedule every 10 min, only 9am–5pm EST
  console.log("Scheduling every 10 min (9am–5pm EST). Press Ctrl+C to stop.");
  async function tick() {
    try {
      await runOnce();
    } catch (err) {
      console.error(err);
    }
    setTimeout(tick, RUN_INTERVAL_MS);
  }
  await tick();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
