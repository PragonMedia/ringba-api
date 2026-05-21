import "dotenv/config";
import axios from "axios";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = "https://api.ringba.com/v2";
const RINGBA_ACCOUNT_ID = process.env.RINGBA_ACCOUNT_ID;
const USERNAME = process.env.RINGBA_USERNAME;
const PASSWORD = process.env.RINGBA_PASSWORD;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const API_TOKEN = process.env.RINGBA_API_TOKEN;

/** Today as YYYY-MM-DD in America/New_York — cache date key (same pattern as targetPingTimeout.js) */
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

const CACHE_PATH = join(__dirname, "targetHangUpsCache.json");

function loadAlertedTargetNames() {
  const today = getTodayESTDate();
  let cache = { date: today, targetNames: [] };
  if (existsSync(CACHE_PATH)) {
    try {
      const data = JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
      if (data.date === today && Array.isArray(data.targetNames)) cache = data;
    } catch (e) {
      console.warn("⚠️ Failed to load target hang-ups cache. Starting fresh.");
    }
  }
  return cache;
}

function saveAlertedTargetNames(cache) {
  try {
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.error("❌ Failed to save target hang-ups cache:", e.message);
  }
}

async function sendSlackMessage(message) {
  if (!SLACK_WEBHOOK_URL) {
    console.warn("Slack skipped (no webhook):", message);
    return;
  }
  try {
    await axios.post(SLACK_WEBHOOK_URL, {
      text: message,
    });
    console.log("✅ Message sent to Slack:", message);
  } catch (error) {
    console.error(
      "❌ Error sending message to Slack:",
      error.response?.data || error
    );
  }
}

// Get current time for filtering
function currentDate(hours, minutes, seconds) {
  const now = new Date();

  // Set to fixed UTC 4:00 AM for the start time
  const startDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      4,
      0,
      0,
      0
    )
  );

  // Set the end time to 3:59 AM UTC the next day
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 1);
  endDate.setUTCHours(3, 59, 59, 999);

  // Return the formatted dates in ISO format
  return {
    reportStart: startDate.toISOString(),
    reportEnd: endDate.toISOString(),
  };
}

const { reportStart, reportEnd } = currentDate();

console.log(reportStart, reportEnd);

// Auth
async function getAuthToken() {
  try {
    const params = new URLSearchParams();
    params.append("grant_type", "password");
    params.append("username", USERNAME);
    params.append("password", PASSWORD);

    const response = await axios.post(`${BASE_URL}/token`, params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
    });

    return response.data.access_token;
  } catch (error) {
    console.error("Error getting token:", error.response?.data || error);
    return null;
  }
}

function targetReqBody(filter) {
  const filters = [];

  if (filter) {
    filters.push({
      anyConditionToMatch: [
        {
          column: "endCallSource",
          value: filter,
          isNegativeMatch: false,
          comparisonType: "EQUALS",
        },
      ],
    });
  }
  if (filter) {
    filters.push({
      anyConditionToMatch: [
        {
          column: "connectedCallLengthInSeconds",
          value: "20",
          isNegativeMatch: false,
          comparisonType: "LESS_THAN",
        },
      ],
    });
  }

  return {
    reportStart: reportStart,
    reportEnd: reportEnd,
    groupByColumns: [{ column: "targetName", displayName: "Target" }],
    valueColumns: [
      { column: "callCount", aggregateFunction: null },
      { column: "liveCallCount", aggregateFunction: null },
      { column: "completedCalls", aggregateFunction: null },
      { column: "endedCalls", aggregateFunction: null },
      { column: "connectedCallCount", aggregateFunction: null },
      { column: "payoutCount", aggregateFunction: null },
      { column: "convertedCalls", aggregateFunction: null },
      { column: "nonConnectedCallCount", aggregateFunction: null },
      { column: "duplicateCalls", aggregateFunction: null },
      { column: "blockedCalls", aggregateFunction: null },
      { column: "incompleteCalls", aggregateFunction: null },
      { column: "earningsPerCallGross", aggregateFunction: null },
      { column: "conversionAmount", aggregateFunction: null },
      { column: "payoutAmount", aggregateFunction: null },
      { column: "profitGross", aggregateFunction: null },
      { column: "profitMarginGross", aggregateFunction: null },
      { column: "convertedPercent", aggregateFunction: null },
      { column: "callLengthInSeconds", aggregateFunction: null },
      { column: "avgHandleTime", aggregateFunction: null },
      { column: "totalCost", aggregateFunction: null },
    ],
    orderByColumns: [{ column: "callCount", direction: "desc" }],
    formatTimespans: true,
    formatPercentages: true,
    generateRollups: true,
    maxResultsPerGroup: 1000,
    filters,
    formatTimeZone: "America/New_York",
  };
}

// GET TARGETS
async function getAllTargets(filter) {
  try {
    // if (!token) {
    //   console.log("❌ Failed to retrieve token. Exiting.");
    //   return;
    // }

    const response = await axios.post(
      `${BASE_URL}/${RINGBA_ACCOUNT_ID}/insights`,
      targetReqBody(filter),
      {
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = response.data?.report?.records || [];
    if (!data) {
      return console.log("Buyers was not retrieved");
    }

    const targetList = data
      .map((curr) => {
        return {
          targetName: curr.targetName,
          callCount: curr.callCount,
        };
      })
      .filter(
        !filter
          ? (curr) =>
              curr.targetName !== "-no value-" &&
              curr.targetName !== undefined &&
              curr.callCount > 30
          : (curr) =>
              curr.targetName !== "-no value-" && curr.targetName !== undefined
      );

    return targetList;
  } catch (error) {
    console.log("Error fetching campaign data:", error.response?.data || error);
    return null;
  }
}

async function runReport() {
  const allTargets = await getAllTargets();
  if (!allTargets) return console.log("Problem fetching target list");

  const allTargetsDropCalls = await getAllTargets("Target");
  if (!allTargetsDropCalls)
    return console.log("Problem fetching target list drop calls");

  const qualifyingSet = new Set();

  // compute
  allTargets.forEach((currA) => {
    const targetName = currA.targetName || "undefined";
    const callCountA = currA.callCount;

    const matchB = allTargetsDropCalls.find(
      (currB) => currB.targetName === currA.targetName
    );
    const callCountB = matchB ? matchB.callCount : 0;

    // console.log(`${targetName} || ${callCountA} || ${callCountB}`);
    if (callCountB > 0.1 * callCountA) {
      qualifyingSet.add(targetName);
    }
  });

  const qualifyingTargetNames = [...qualifyingSet];

  const cache = loadAlertedTargetNames();
  const alreadyAlerted = new Set(cache.targetNames);
  const toAlert = qualifyingTargetNames.filter((name) => !alreadyAlerted.has(name));

  if (toAlert.length > 0) {
    const bullets = toAlert
      .map((targetName) => `• ${targetName} has target hang-ups above 10%`)
      .join("\n");
    const message = `*Target hang-ups*\n${bullets}`;
    await sendSlackMessage(message);

    for (const name of toAlert) {
      cache.targetNames.push(name);
      alreadyAlerted.add(name);
    }
  }

  if (cache.targetNames.length > 0) saveAlertedTargetNames(cache);
}

runReport();
