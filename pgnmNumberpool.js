import "dotenv/config";
import axios from "axios";

const BASE_URL = "https://api.ringba.com/v2";
const RINGBA_ACCOUNT_ID = process.env.RINGBA_ACCOUNT_ID;
const USERNAME = process.env.RINGBA_USERNAME;
const PASSWORD = process.env.RINGBA_PASSWORD;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const API_TOKEN = process.env.RINGBA_API_TOKEN;

// ✅ Function to send a message to Slack
async function sendSlackMessage(message) {
  try {
    await axios.post(SLACK_WEBHOOK_URL, {
      text: message,
    });
    console.log("Message sent to Slack:", message);
  } catch (error) {
    console.error(
      "Error sending message to Slack:",
      error.response?.data || error
    );
  }
}

//  Function to Get Authentication Token
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

function getFormattedUTCDate(hours, minutes, seconds) {
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
  endDate.setUTCDate(startDate.getUTCDate() + 1); // Add 1 day for the end time
  endDate.setUTCHours(3, 59, 59, 999); // Set time to 3:59 AM

  // Return the formatted dates in ISO format
  return {
    reportStart: startDate.toISOString(),
    reportEnd: endDate.toISOString(),
  };
}

// ✅ Function to Get All Publishers
async function getNumberPoolData() {
  try {
    const { reportStart, reportEnd } = getFormattedUTCDate(4, 0, 0);

    const response = await axios.post(
      `${BASE_URL}/${RINGBA_ACCOUNT_ID}/insights`,
      {
        reportStart: reportStart,
        reportEnd: reportEnd,
        groupByColumns: [
          {
            column: "numberPoolName",
            displayName: "Number Pool",
          },
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
        orderByColumns: [
          {
            column: "callCount",
            direction: "desc",
          },
        ],
        formatTimespans: true,
        formatPercentages: true,
        generateRollups: true,
        maxResultsPerGroup: 1000,
        filters: [
          {
            anyConditionToMatch: [
              {
                column: "campaignName",
                value: "Broker",
                isNegativeMatch: true,
                comparisonType: "CONTAINS",
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
        ],
        formatTimeZone: "America/New_York",
      },
      {
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const records = response.data?.report?.records || [];
    // console.log(records);

    return records;
  } catch (error) {
    console.error(
      "🚨 Error fetching publishers:",
      error.response?.data || error
    );
    return [];
  }
}

// GENERIC FUNCTION TO GET OBJECTS TO USE FOR COMPARISSON
function getCallCounts(data) {
  let callCountWithNoValue = 0;
  let lastCallCount = data[data.length - 1]?.callCount || null;
  let hasTag = false;

  for (let obj of data) {
    if (obj.numberPoolName === "-no value-" || obj.numberPoolName === "") {
      callCountWithNoValue = obj.callCount;
      hasTag = true;
      break;
    }

    if (!hasTag) {
      let callCountWithNoValue = 0;
    }
  }

  return { callCountWithNoValue, lastCallCount };
}

async function runReport() {
  const numberPool = await getNumberPoolData();
  if (!numberPool) {
    console.log("No numberpool pulled from API");
  }

  const cleanNumberPoolData = getCallCounts(numberPool);
  if (
    cleanNumberPoolData.callCountWithNoValue >
    0.02 * cleanNumberPoolData.lastCallCount
  ) {
    // sendSlackMessage("Number pool is above 2%");
    sendSlackMessage("Number pool's no value is above 2%");
  }
}

runReport();
