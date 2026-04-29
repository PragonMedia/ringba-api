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
const RINGBA_AUTH_HEADER = process.env.RINGBA_AUTH_HEADER || "Bearer";
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const MIN_TARGET_DIALED = 50;
const BUSY_CALL_ALERT_PCT = 0.2; // 20%
const MIN_CALLS_SINCE_LAST_ALERT = 30;
const ALERT_CACHE_PATH = join(__dirname, "targetBusyCallAlertCache.json");
const RUN_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const LOG_ONLY_MODE = false; // false = send Slack alerts (deployment mode)

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

const INSIGHTS_EVENTS_PATH = "insights/events/beta";
const MAX_RESULTS_PER_GROUP = 1000;

function isEasternDST(y, m, d) {
  const march1Dow = new Date(y, 2, 1).getDay();
  const secondSunMarch = 8 + (7 - march1Dow) % 7;
  const nov1Dow = new Date(y, 10, 1).getDay();
  const firstSunNov = 1 + (7 - nov1Dow) % 7;
  return (
    (m > 3 && m < 11) ||
    (m === 3 && d >= secondSunMarch) ||
    (m === 11 && d < firstSunNov)
  );
}

function getStartOfTodayEST() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const y = parseInt(parts.find((p) => p.type === "year").value, 10);
  const m = parseInt(parts.find((p) => p.type === "month").value, 10);
  const d = parseInt(parts.find((p) => p.type === "day").value, 10);
  const utcHour = isEasternDST(y, m, d) ? 4 : 5;
  return new Date(Date.UTC(y, m - 1, d, utcHour, 0, 0, 0)).toISOString();
}

function getEndOfTodayEST() {
  const start = new Date(getStartOfTodayEST());
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
}

function toISOSeconds(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

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

  return res.json();
}

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

function getTodayEST() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  return `${y}-${m}-${d}`;
}

function getHourEST() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  });
  return parseInt(fmt.formatToParts(now).find((p) => p.type === "hour").value, 10);
}

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

function getBusyValue(record) {
  const candidates = [
    "busyCall",
    "busyCalls",
    "busy",
    "busySignal",
    "busyCount",
    "targetBusy",
    "targetBusyCall",
    "targetBusyCount",
  ];
  for (const key of candidates) {
    if (key in record) return Number(record[key]) || 0;
  }
  return 0;
}

function getTargetsWithHighBusyCall(records) {
  return records
    .filter((r) => {
      const dialed = Number(r.targetDialed) || 0;
      const busy = getBusyValue(r);
      if (dialed < MIN_TARGET_DIALED) return false;
      return busy / dialed >= BUSY_CALL_ALERT_PCT;
    })
    .map((r) => {
      const dialed = Number(r.targetDialed) || 0;
      const busy = getBusyValue(r);
      const pct = dialed ? ((busy / dialed) * 100).toFixed(1) : "0";
      return {
        targetName: r.targetName,
        targetDialed: dialed,
        busyCall: busy,
        busyCallPct: pct + "%",
      };
    });
}

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

async function sendSlackAlert(payload) {
  if (!SLACK_WEBHOOK_URL) {
    console.warn("SLACK_WEBHOOK_URL not set; skipping Slack.");
    return;
  }
  const webhook = new IncomingWebhook(SLACK_WEBHOOK_URL);
  await webhook.send(payload);
}

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
  console.log(summary, "| rows:", count);

  const records = data?.report?.records ?? [];
  const highBusyCall = getTargetsWithHighBusyCall(records);
  const recordsOverMinDialed = records.filter((r) => (Number(r.targetDialed) || 0) >= MIN_TARGET_DIALED);
  const recordsWithAnyBusy = recordsOverMinDialed.filter((r) => getBusyValue(r) > 0);

  const today = getTodayEST();
  const cache = loadAlertCache();
  const todayCache = cache[today] || {};

  const toAlert = highBusyCall.filter((t) => {
    const lastDialed = todayCache[t.targetName] ?? 0;
    const minRequired = lastDialed + MIN_CALLS_SINCE_LAST_ALERT;
    return t.targetDialed >= minRequired;
  });

  for (const t of toAlert) {
    console.log(`${t.targetName} has more than 20% busy calls`);
  }

  if (toAlert.length) {
    const bullets = toAlert
      .map((t) => `• ${t.targetName} has more than 20% busy calls`)
      .join("\n");

    if (LOG_ONLY_MODE) {
      console.log(`Target Busy Call\n${bullets}`);
    } else if (SLACK_WEBHOOK_URL) {
      await sendSlackAlert({
        text: `Target Busy Call\n${bullets}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Target Busy Call*\n${bullets}`,
            },
          },
        ],
      });
    }

    for (const t of toAlert) {
      todayCache[t.targetName] = t.targetDialed;
    }
    cache[today] = todayCache;
    saveAlertCache(cache);
    console.log(
      LOG_ONLY_MODE
        ? `Log-only alert generated for ${toAlert.length} target(s) with high busy calls.`
        : `Slack alert sent for ${toAlert.length} target(s) with high busy calls.`,
    );
  } else {
    console.log(
      `No busy-call alerts: ${recordsOverMinDialed.length} target(s) had ${MIN_TARGET_DIALED}+ dialed, ` +
        `${recordsWithAnyBusy.length} had any busy calls, ${highBusyCall.length} met the 20% rule, ` +
        `${toAlert.length} passed re-alert gate.`,
    );
  }
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
