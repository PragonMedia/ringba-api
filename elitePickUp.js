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
      error.response?.data || error,
    );
  }
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

function getFormattedUTCDate() {
  const now = new Date();

  // Start date: today at 4:00 AM UTC
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

  // End date: tomorrow at 3:59:59.999 AM UTC
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 1);
  endDate.setUTCHours(3, 59, 59, 999);

  return {
    reportStartComplete: startDate.toISOString(),
    reportEndComplete: endDate.toISOString(),
  };
}

const { reportStartComplete, reportEndComplete } = getFormattedUTCDate();

function getLast30MinBlockUTC() {
  const now = new Date(); // Current time in local timezone (Philippines)

  // Convert to UTC equivalent
  const reportEndUTC = new Date(now.toISOString());
  const reportStartUTC = new Date(reportEndUTC);
  reportStartUTC.setMinutes(reportEndUTC.getMinutes() - 15);

  const reportPreviousStartUTC = new Date(reportEndUTC);
  reportPreviousStartUTC.setMinutes(reportEndUTC.getMinutes() - 60);

  // Extract UTC hour from currTime
  const hour = reportEndUTC.getUTCHours();

  return {
    prevTime: reportStartUTC.toISOString(),
    currTime: reportEndUTC.toISOString(),
    reportPreviousStart: reportPreviousStartUTC.toISOString(),
    hour,
  };
}

const { prevTime, currTime, reportPreviousStart, hour } =
  getLast30MinBlockUTC();

function dynamicBody(reportStart, reportEnd) {
  return {
    reportStart: reportStart,
    reportEnd: reportEnd,
    groupByColumns: [{ column: "buyer", displayName: "Buyer" }],
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
    filters: [
      {
        column: "hasConnected",
        value: "yes",
        isNegativeMatch: false,
        comparisonType: "EQUALS",
      },
      {
        column: "tag:User:qualified",
        value: "yes",
        isNegativeMatch: false,
        comparisonType: "EQUALS",
      },
    ],
    formatTimeZone: "America/New_York",
  };
}

// ✅ Function to Get All Publishers
async function getData(
  campaignName,
  columnName,
  displayName,
  reportStart,
  reportEnd,
) {
  // const token = await getAuthToken();
  // if (!token) {
  //   console.error("❌ Failed to retrieve token. Exiting.");
  //   return;
  // }
  try {
    const response = await axios.post(
      `${BASE_URL}/${RINGBA_ACCOUNT_ID}/insights`,
      dynamicBody(
        campaignName,
        columnName,
        displayName,
        reportStart,
        reportEnd,
      ),
      {
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    const records = response.data?.report?.records || [];
    // console.log(records);

    return records;
  } catch (error) {
    console.error(
      "🚨 Error fetching publishers:",
      error.response?.data || error,
    );
    return [];
  }
}

// groupByColumns: [{ column: "targetName", displayName: "Target" }],
// groupByColumns: [{column: "campaignName", displayName: "Campaign"}],

// GENERIC FUNCTION TO GET OBJECTS TO USE FOR COMPARISSON
function getCallCounts(data) {
  let callCountWithNoValue = 0;
  let lastCallCount = data[data.length - 1]?.callCount || null;
  let hasTag = false;

  for (let obj of data) {
    if (obj.targetName === "Elite" || obj.targetName === "") {
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

console.log(
  `START ${reportPreviousStart} || CURR ${prevTime} || PREV ${currTime}`,
);

function extractEliteAndLast(data) {
  const elite = data.find((item) => item.buyer === "Elite");
  const noValue = data.find((item) => item.buyer === "-no value-");
  const last = data[data.length - 1];

  return [elite, last, noValue];
}

// function getElitePercentage(data) {
//   const elite = data.find((item) => item.buyer === "Elite");
//   const total = data.find((item) => item.buyer === "total");
//   const noValue = data.find((item) => item.buyer === "-no value-");

//   if (!elite || !total || total.callCount === 0) {
//     return null; // avoid division by zero or missing data
//   }
//   const finalTotal = total.callCount - noValue.callCount;

//   const percent = (elite.callCount / finalTotal) * 100;
//   return `${percent.toFixed(2)}%`;
// }

// async function runReport() {
//   // get current
//   const current = await getData(prevTime, currTime);
//   if (!current) {
//     console.log("was not able to get data");
//   }
//   // reportPreviousStart

//   const cleanedData = extractEliteAndLast(current);
//   // console.log(cleanedData);

//   // const previous = await getData()
//   const data = [];

//   cleanedData.map((curr) => {
//     const buyer = curr.buyer ? curr.buyer : "total";
//     const callCount = curr.callCount;

//     data.push({ buyer, callCount });

//     console.log(`Buyer: ${buyer}, Call Count: ${callCount}`);
//   });

//   const percentage = getElitePercentage(data);
//   // console.log(cleanedData);
//   console.log(percentage);
//   // console.log(`Elite has a ${percentage} pick up rate`);
//   sendSlackMessage(`Elite has a ${percentage} pick up rate`);
// }

function getElitePercentage(data) {
  const elite = data.find((item) => item.buyer === "Elite");
  const total = data.find((item) => item.buyer === "total");
  const noValue = data.find((item) => item.buyer === "-no value-");

  if (!elite || !total || total.callCount === 0) {
    return null; // avoid division by zero or missing data
  }
  const finalTotal = total.callCount - noValue.callCount;

  const percent = (elite.callCount / finalTotal) * 100;
  return `${percent.toFixed(2)}%`;
}

async function runReport() {
  // get current
  const current = await getData(prevTime, currTime);
  if (!current) {
    console.log("was not able to get data");
  }
  // reportPreviousStart

  const cleanedData = extractEliteAndLast(current);
  // console.log(cleanedData);

  // const previous = await getData()
  const data = [];

  cleanedData.map((curr) => {
    const buyer = curr.buyer ? curr.buyer : "total";
    const callCount = curr.callCount;

    data.push({ buyer, callCount });

    console.log(`Buyer: ${buyer}, Call Count: ${callCount}`);
  });

  const percentage = getElitePercentage(data);
  // console.log(cleanedData);
  console.log(percentage);
  // console.log(`Elite has a ${percentage} pick up rate`);
  // sendSlackMessage(`Elite has a ${percentage} pick up rate`);

  // Extract noValue and total for percentage calculation
  const total = data.find((item) => item.buyer === "total");
  const noValue = data.find((item) => item.buyer === "-no value-");

  // Calculate noValue percentage: (noValue / total) * 100
  const noValuePercentage =
    total && total.callCount > 0 && noValue
      ? ((noValue.callCount / total.callCount) * 100).toFixed(2)
      : "0.00";

  console.log(
    `${percentage} of calls were picked up by elite, ${noValuePercentage}% hit the floor`,
  );
  sendSlackMessage(
    `${percentage} of calls were picked up by elite, ${noValuePercentage}% hit the floor`,
  );
}

runReport();
