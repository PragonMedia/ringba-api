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

// FOR DUPLICATE NOTIFS~
const ALERT_CACHE_PATH = join(__dirname, "api10Cache.json");

// Load alert cache from file or initialize
let alertCache = {};
if (existsSync(ALERT_CACHE_PATH)) {
  alertCache = JSON.parse(readFileSync(ALERT_CACHE_PATH, "utf-8"));
}

// Get today's date in YYYY-MM-DD format
const today = new Date().toISOString().split("T")[0];

// Ensure structure
if (!alertCache[today]) {
  alertCache = { [today]: [] }; // Reset for today
}

// ✅ Function to send a message to Slack
async function sendSlackMessage(message) {
  // Check if already alerted today
  if (alertCache[today]?.includes(message)) {
    console.log("🛑 Duplicate alert skipped:", message);
    return;
  }

  try {
    await axios.post(SLACK_WEBHOOK_URL, {
      text: message,
    });

    console.log("✅ Message sent to Slack:", message);

    // Save alert to cache
    alertCache[today].push(message);
    writeFileSync(ALERT_CACHE_PATH, JSON.stringify(alertCache, null, 2));
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
      // console.log(`${targetName} has target hang-ups above 10%`);
      sendSlackMessage(`${targetName} has target hang-ups above 10%`);
    }
  });
}

runReport();
