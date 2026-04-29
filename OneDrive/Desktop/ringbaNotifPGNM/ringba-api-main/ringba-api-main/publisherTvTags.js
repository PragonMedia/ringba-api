import "dotenv/config";
import axios from "axios";

const BASE_URL = "https://api.ringba.com/v2";
const RINGBA_ACCOUNT_ID = process.env.RINGBA_ACCOUNT_ID;
const RINGBA_USERNAME = process.env.RINGBA_USERNAME;
const RINGBA_PASSWORD = process.env.RINGBA_PASSWORD;
const RINGBA_API_TOKEN = process.env.RINGBA_API_TOKEN;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

const VALUE_COLUMNS = [
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
];

if (!RINGBA_ACCOUNT_ID) {
  console.warn("⚠️ RINGBA_ACCOUNT_ID not set in .env");
}
if (!RINGBA_API_TOKEN && (!RINGBA_USERNAME || !RINGBA_PASSWORD)) {
  console.warn(
    "⚠️ Set RINGBA_API_TOKEN or RINGBA_USERNAME/RINGBA_PASSWORD in .env",
  );
}
if (!SLACK_WEBHOOK_URL) {
  console.warn("⚠️ SLACK_WEBHOOK_URL not set in .env — Slack alerts disabled.");
}

function getReportWindowUTC() {
  const now = new Date();
  const startDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      4,
      0,
      0,
      0,
    ),
  );
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 1);
  endDate.setUTCHours(3, 59, 59, 999);

  return {
    reportStart: startDate.toISOString(),
    reportEnd: endDate.toISOString(),
  };
}

async function getAuthToken() {
  if (RINGBA_API_TOKEN) return RINGBA_API_TOKEN;
  if (!RINGBA_USERNAME || !RINGBA_PASSWORD) return null;

  try {
    const params = new URLSearchParams();
    params.append("grant_type", "password");
    params.append("username", RINGBA_USERNAME);
    params.append("password", RINGBA_PASSWORD);

    const response = await axios.post(`${BASE_URL}/token`, params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
    });
    return response.data?.access_token ?? null;
  } catch (error) {
    console.error("❌ Error getting token:", error.response?.data || error);
    return null;
  }
}

function getBaseFilters() {
  return [
    {
      anyConditionToMatch: [
        {
          column: "publisherName",
          value: "Elite",
          isNegativeMatch: true,
          comparisonType: "EQUALS",
        },
      ],
    },
    {
      anyConditionToMatch: [
        {
          column: "isDuplicate",
          value: "no",
          isNegativeMatch: false,
          comparisonType: "EQUALS",
        },
      ],
    },
  ];
}

function buildInsightsBody({
  groupByColumn,
  groupByDisplayName,
  campaignName = null,
  publisherName = null,
}) {
  const { reportStart, reportEnd } = getReportWindowUTC();
  const filters = getBaseFilters();

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

  // TODO: Add TV channel filter here when ready.
  // Example:
  // filters.push({
  //   anyConditionToMatch: [
  //     {
  //       column: "tag:User:channel",
  //       value: "TV",
  //       isNegativeMatch: false,
  //       comparisonType: "CONTAINS",
  //     },
  //   ],
  // });

  return {
    reportStart,
    reportEnd,
    groupByColumns: [{ column: groupByColumn, displayName: groupByDisplayName }],
    valueColumns: VALUE_COLUMNS,
    orderByColumns: [{ column: "callCount", direction: "desc" }],
    formatTimespans: true,
    formatPercentages: true,
    generateRollups: true,
    maxResultsPerGroup: 1000,
    filters,
    formatTimeZone: "America/New_York",
  };
}

async function postInsights(token, body) {
  const response = await axios.post(
    `${BASE_URL}/${RINGBA_ACCOUNT_ID}/insights`,
    body,
    {
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
    },
  );
  return response.data?.report?.records ?? [];
}

function getParagonMedicareCampaigns(campaignRecords) {
  return campaignRecords
    .map((record) => record.campaignName)
    .filter((name) => typeof name === "string")
    .filter((name) => {
      const lower = name.toLowerCase();
      return lower.includes("paragon") && lower.includes("medicare");
    });
}

async function sendSlackMessage(message) {
  if (!SLACK_WEBHOOK_URL) {
    console.warn("Slack skipped (no webhook):", message);
    return;
  }
  try {
    await axios.post(SLACK_WEBHOOK_URL, { text: message });
    console.log("✅ Message sent to Slack:", message);
  } catch (error) {
    console.error("❌ Error sending message to Slack:", error.response?.data || error);
  }
}

async function runReport() {
  const token = await getAuthToken();
  if (!token) {
    console.error("❌ Missing valid auth token. Exiting.");
    return;
  }

  const campaignRecords = await postInsights(
    token,
    buildInsightsBody({
      groupByColumn: "campaignName",
      groupByDisplayName: "Campaign",
    }),
  );

  const paragonMedicareCampaigns = getParagonMedicareCampaigns(campaignRecords);
  if (paragonMedicareCampaigns.length === 0) {
    console.log('No campaigns matched "Paragon Medicare".');
    return;
  }

  console.log("Matched campaigns:", paragonMedicareCampaigns);

  // TODO: Add publisher/tag checks and alert rules.
  // This scaffold currently confirms campaign matching only.
  await sendSlackMessage(
    `Publisher TV Tags\nScaffold active. Matched ${paragonMedicareCampaigns.length} Paragon Medicare campaign(s).`,
  );
}

runReport().catch((error) => {
  console.error("❌ publisherTvTags failed:", error.response?.data || error);
});
