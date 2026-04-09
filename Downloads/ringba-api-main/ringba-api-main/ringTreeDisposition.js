import "dotenv/config";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "https://api.ringba.com/v2";
const RINGBA_ACCOUNT_ID = process.env.RINGBA_ACCOUNT_ID;
const API_TOKEN = process.env.RINGBA_API_TOKEN;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const CACHE_PATH = path.resolve(__dirname, "ringTreeDispositionCache.json");

async function sendSlackMessage(message) {
  if (!SLACK_WEBHOOK_URL) {
    console.warn("Slack skipped (no webhook):", message);
    return;
  }
  try {
    await axios.post(SLACK_WEBHOOK_URL, { text: message });
    console.log("✅ Message sent to Slack:", message);
  } catch (error) {
    console.error("❌ Error sending to Slack:", error.response?.data ?? error.message);
  }
}

/** Today as MM-DD-YYYY in America/New_York (EST) - for API params */
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
  return `${m}-${d}-${y}`;
}

/** Today as YYYY-MM-DD in EST - for cache date */
function getTodayESTDate() {
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

function loadAlertedRttNames() {
  const today = getTodayESTDate();
  let cache = { date: today, rttNames: [] };
  if (fs.existsSync(CACHE_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
      if (data.date === today && Array.isArray(data.rttNames)) cache = data;
    } catch (e) {
      console.warn("⚠️ Failed to load ringTreeDisposition cache. Starting fresh.");
    }
  }
  return cache;
}

function saveAlertedRttNames(cache) {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.error("❌ Failed to save ringTreeDisposition cache:", e.message);
  }
}

const ACCEPTANCE_REJECTION_KEY = "rejectedCountBy:CallAcceptanceParsingRejection";
const PING_TIMEOUT_KEY = "rejectedCountBy:PingTimeout";

/** Turn raw rtt values array into { rttName, acceptanceRejection, pingTimeout } */
function cleanRttItem(item) {
  const byMessage = Object.fromEntries(
    (item.values || []).map((v) => [v.messageName, v.total])
  );
  return {
    rttName: item.rttName,
    acceptanceRejection: byMessage[ACCEPTANCE_REJECTION_KEY] ?? 0,
    pingTimeout: byMessage[PING_TIMEOUT_KEY] ?? 0,
  };
}

const ACCEPTANCE_REJECTION_THRESHOLD = 300;
const PING_TIMEOUT_PCT_THRESHOLD = 0.15; // 15%

/** Clean full API response: acceptanceRejection > 300 and pingTimeout/acceptanceRejection > 15% */
function cleanRingTreeData(data) {
  const rawValues = data?.values ?? [];
  return rawValues
    .map(cleanRttItem)
    .filter((item) => item.acceptanceRejection > ACCEPTANCE_REJECTION_THRESHOLD)
    .filter(
      (item) =>
        item.acceptanceRejection > 0 &&
        item.pingTimeout / item.acceptanceRejection > PING_TIMEOUT_PCT_THRESHOLD
    );
}

async function fetchRingTreeDisposition() {
  const date = getTodayEST();
  const url = `${BASE_URL}/${RINGBA_ACCOUNT_ID}/stats/rtt`;
  const params = { Start: date, End: date };

  try {
    const response = await axios.get(url, {
      params,
      headers: {
        Authorization: `Token ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const data = response.data;
    console.log("Date (EST):", date);
    console.log("Request URL:", `${url}?Start=${date}&End=${date}`);

    const cache = loadAlertedRttNames();
    const cleaned = cleanRingTreeData(data);
    const alreadyAlerted = new Set(cache.rttNames);

    for (const item of cleaned) {
      if (alreadyAlerted.has(item.rttName)) continue;
      const message = `${item.rttName} has 15%+ ping timouts`;
      console.log(message);
      await sendSlackMessage(message);
      cache.rttNames.push(item.rttName);
      alreadyAlerted.add(item.rttName);
    }
    if (cache.rttNames.length > 0) saveAlertedRttNames(cache);

    return cleaned;
  } catch (error) {
    console.error(
      "Error fetching ring tree disposition:",
      error.response?.data ?? error.message
    );
    throw error;
  }
}

fetchRingTreeDisposition();
