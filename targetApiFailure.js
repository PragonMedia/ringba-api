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
const CACHE_PATH = path.resolve(__dirname, "targetApiFailureCache.json");
const LOG_ONLY_MODE = false; // false = send Slack alerts (deployment mode)

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
      console.warn("⚠️ Failed to load targetApiFailure cache. Starting fresh.");
    }
  }
  return cache;
}

function saveAlertedRttNames(cache) {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.error("❌ Failed to save targetApiFailure cache:", e.message);
  }
}

const ACCEPTANCE_REJECTION_KEY = "rejectedCountBy:CallAcceptanceParsingRejection";
const API_FAILED_KEY = "rejectedCountBy:ApiFailed";

/** Turn raw rtt values array into { rttName, acceptanceRejection, apiFailed } */
function cleanRttItem(item) {
  const byMessage = Object.fromEntries(
    (item.values || []).map((v) => [v.messageName, v.total]),
  );
  return {
    rttName: item.rttName,
    acceptanceRejection: byMessage[ACCEPTANCE_REJECTION_KEY] ?? 0,
    apiFailed: byMessage[API_FAILED_KEY] ?? 0,
  };
}

const ACCEPTANCE_REJECTION_THRESHOLD = 300;
const API_FAILED_PCT_THRESHOLD = 0.1; // 10%

/** Clean full API response: acceptanceRejection > 300 and apiFailed/acceptanceRejection > 10% */
function cleanRingTreeData(data) {
  const rawValues = data?.values ?? [];
  return rawValues
    .map(cleanRttItem)
    .filter((item) => item.acceptanceRejection > ACCEPTANCE_REJECTION_THRESHOLD)
    .filter(
      (item) =>
        item.acceptanceRejection > 0 &&
        item.apiFailed / item.acceptanceRejection > API_FAILED_PCT_THRESHOLD,
    );
}

async function fetchTargetApiFailure() {
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
    const toAlert = cleaned.filter((item) => !alreadyAlerted.has(item.rttName));

    if (toAlert.length > 0) {
      const bullets = toAlert
        .map((item) => `• ${item.rttName} has 10%+ API failed`)
        .join("\n");
      const message = `*Target API Failure*\n${bullets}`;
      console.log(message);
      if (!LOG_ONLY_MODE) {
        await sendSlackMessage(message);
      } else {
        console.log("LOG_ONLY_MODE enabled: Slack message not sent.");
      }

      for (const item of toAlert) {
        cache.rttNames.push(item.rttName);
      }
    }

    if (cache.rttNames.length > 0) saveAlertedRttNames(cache);
    return cleaned;
  } catch (error) {
    console.error(
      "Error fetching target API failed data:",
      error.response?.data ?? error.message,
    );
    throw error;
  }
}

fetchTargetApiFailure();
