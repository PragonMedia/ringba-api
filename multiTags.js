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

if (!SLACK_WEBHOOK_URL) {
  console.warn("⚠️ SLACK_WEBHOOK_URL not set in .env — Slack alerts disabled.");
}
if (!RINGBA_ACCOUNT_ID || !API_TOKEN) {
  console.warn("⚠️ RINGBA_ACCOUNT_ID or RINGBA_API_TOKEN not set — API calls may fail.");
}

function getTodayEST() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(now);
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  return `${y}-${m}-${d}`;
}

// FOR DUPLICATE NOTIFS (date = EST so 1am clear matches)
const ALERT_CACHE_PATH = join(__dirname, "alertCache.json");

// Load alert cache from file or initialize
let alertCache = {};
if (existsSync(ALERT_CACHE_PATH)) {
  alertCache = JSON.parse(readFileSync(ALERT_CACHE_PATH, "utf-8"));
}

const today = getTodayEST();

// Ensure structure
if (!alertCache[today]) {
  alertCache = { [today]: [] }; // Reset for today
}

// ✅ Function to send a message to Slack
// async function sendSlackMessage(message) {
//   try {
//     await axios.post(SLACK_WEBHOOK_URL, {
//       text: message,
//     });
//     console.log("Message sent to Slack:", message);
//   } catch (error) {
//     console.error(
//       "Error sending message to Slack:",
//       error.response?.data || error
//     );
//   }
// }

async function sendSlackMessage(message) {
  if (!SLACK_WEBHOOK_URL) {
    console.warn("Slack skipped (no webhook):", message);
    return;
  }
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
function getFormattedUTCDate() {
  const now = new Date();

  // Offset from your local time to your employer's time (e.g., +12 hours)
  const offsetInHours = -12;
  const employerNow = new Date(now.getTime() + offsetInHours * 60 * 60 * 1000);

  // Use employer's date in UTC
  const startDate = new Date(
    Date.UTC(
      employerNow.getUTCFullYear(),
      employerNow.getUTCMonth(),
      employerNow.getUTCDate(),
      4,
      0,
      0,
      0 // 4:00 AM employer time (local to employer)
    )
  );

  // End date is 3:59:59.999 AM the next day
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 1);
  endDate.setUTCHours(3, 59, 59, 999);

  return {
    reportStart: startDate.toISOString(),
    reportEnd: endDate.toISOString(),
  };
}

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

// DYNAMIC req.body for POST REQ
function dynamicReqBody(
  campaignName,
  publisherName,
  groupByColumn,
  groupByDisplayName
) {
  const { reportStart, reportEnd } = getFormattedUTCDate(4, 0, 0);
  const filters = [
    {
      anyConditionToMatch: [
        {
          column: "isDuplicate",
          comparisonType: "EQUALS",
          isNegativeMatch: false,
          value: "no",
        },
      ],
    },
  ];

  if (campaignName) {
    filters.push({
      anyConditionToMatch: [
        {
          column: "campaignName",
          value: campaignName,
          isNegativeMatch: false,
          comparisonType: "EQUALS",
        },
      ],
    });
  }

  if (publisherName) {
    filters.push({
      anyConditionToMatch: [
        {
          column: "publisherName",
          value: publisherName,
          isNegativeMatch: false,
          comparisonType: "EQUALS",
        },
      ],
    });
  }

  return {
    reportStart,
    reportEnd,
    groupByColumns: [
      { column: groupByColumn, displayName: groupByDisplayName },
    ],
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

// Tags to be filtered. Add more tags here if needed
const tags = [
  { tag: "tag:User:angle", tagName: "User:angle", tagText: "Angle" },
  { tag: "tag:User:key", tagName: "User:key", tagText: "Key" },
  { tag: "tag:User:channel", tagName: "User:channel", tagText: "User Channel" },
  {
    tag: "tag:User:qualified",
    tagName: "User:qualified",
    tagText: "Qualified",
  },
  { tag: "tag:User:age", tagName: "User:age", tagText: "Age" },
  {
    tag: "tag:Ads:Ad Account",
    tagName: "Ads:Ad Account",
    tagText: "Ads Account",
  },
];

// Get Campaign
async function getCampaign() {
  try {
    const response = await axios.post(
      `${BASE_URL}/${RINGBA_ACCOUNT_ID}/insights`,
      dynamicReqBody(null, null, "campaignName", "Campaign"),
      {
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Clean Data
    const campaigns = [];
    const data = response.data?.report?.records || [];
    if (!data) {
      return console.log("Something went wrong");
    }

    data.map((curr) => campaigns.push(curr.campaignName));

    return campaigns;
  } catch (error) {
    console.log("Error fetching campaign data:", error.response?.data || error);
    return null;
  }
}

// Get Publishers
async function getPublishers(campaignName) {
  try {
    const response = await axios.post(
      `${BASE_URL}/${RINGBA_ACCOUNT_ID}/insights`,
      dynamicReqBody(campaignName, null, "publisherName", "Publisher"),
      {
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = response.data?.report?.records || [];
    if (!data) {
      return console.log("Something went wrong");
    }

    return data;
  } catch (error) {}
}

// Get Publisher with tags
async function getPublisherTag(campaignName, publisherName, tag, tagName) {
  try {
    const response = await axios.post(
      `${BASE_URL}/${RINGBA_ACCOUNT_ID}/insights`,
      dynamicReqBody(campaignName, publisherName, tag, tagName),
      {
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = response.data?.report?.records || [];
    if (!data) {
      return console.log("Something went wrong");
    }

    return data;
  } catch (error) {}
}

function getCallCounts(data, tag) {
  if (!Array.isArray(data) || data.length === 0) {
    return { callCountWithNoValue: 0, lastCallCount: 0 };
  }

  let callCountWithNoValue = 0;
  let lastCallCount = data[data.length - 1]?.callCount || 0;

  for (let obj of data) {
    if (obj[tag] === "-no value-" || obj[tag] === "") {
      callCountWithNoValue = obj.callCount;
      break;
    }
  }

  return { callCountWithNoValue, lastCallCount };
}

// Send Report
async function sendReport() {
  const allPublisherNames = [];

  // const token = await getAuthToken();
  // if (!token) {
  //   console.log("❌ Failed to retrieve token. Exiting.");
  //   return;
  // }

  // Get Campaign
  const campaignName = await getCampaign();
  if (!campaignName || campaignName.length === 0) {
    console.log("No campaign found");
    return;
  }

  // Filter Campaign
  const medicareCampaigns = campaignName.filter(
    (curr) =>
      typeof curr === "string" &&
      curr.includes("Medicare") &&
      !curr.includes("Broker") &&
      !curr.includes("Testing")
  );

  if (medicareCampaigns.length === 0) return;

  for (const medicareCampaign of medicareCampaigns) {
    // Get Publisher
    const publishers = await getPublishers(medicareCampaign);
    if (!Array.isArray(publishers) || publishers.length === 0) {
      console.log("No campaign found");
      continue;
    }

    const publisherNames = publishers
      .filter((curr) => typeof curr.publisherName === "string")
      .map((curr) => curr.publisherName);

    allPublisherNames.push(...publisherNames);

    for (const publisherName of publisherNames) {
      // Loop through Tags Array
      for (const tag of tags) {
        const getData = await getPublisherTag(
          medicareCampaign,
          publisherName,
          tag.tag,
          tag.tagName
        );

        const cleanedData = getCallCounts(getData, tag.tag);

        // USE FOR GETTING CLEANED DATA
        if (cleanedData.lastCallCount >= 150) {
        } else {
          console.log(
            `${medicareCampaign} | ${publisherName} |  ${tag.tagText} | ${cleanedData.lastCallCount} is below 150`
          );
        }
        if (
          cleanedData.callCountWithNoValue > 0.02 * cleanedData.lastCallCount &&
          cleanedData.lastCallCount >= 150
        ) {
          // console.log(
          //   `${medicareCampaign} | ${publisherName}'s ${tag.tagText} tag`
          // );
          sendSlackMessage(
            `${medicareCampaign} | ${publisherName} |  ${tag.tagText}'s tag `
          );
        }
      }
    }
  }
}

sendReport();
