import "dotenv/config";
import axios from "axios";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = "https://api.ringba.com/v2";
const RINGBA_ACCOUNT_ID = process.env.RINGBA_ACCOUNT_ID;
const USERNAME = process.env.RINGBA_USERNAME;
const PASSWORD = process.env.RINGBA_PASSWORD;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const API_TOKEN = process.env.RINGBA_API_TOKEN;

// Batch cache path (resolve to absolute so it's correct when run by scheduler)
const BATCH_CACHE_PATH = path.resolve(__dirname, "processedBatches.json");
const BID_BATCH_CACHE_PATH = path.resolve(__dirname, "processedBidBatches.json");

/** Today YYYY-MM-DD in America/New_York (matches schedule) */
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

let processedBidBatches = { date: "", batches: [] };
let processedBatches = { date: "", batches: [] };

function loadBatchCache() {
  const today = getTodayEST();
  processedBatches = { date: today, batches: [] };
  if (fs.existsSync(BATCH_CACHE_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(BATCH_CACHE_PATH, "utf-8"));
      if (data.date === today && Array.isArray(data.batches)) {
        processedBatches = data;
      }
    } catch (e) {
      console.warn("⚠️ Failed to load batch cache. Starting fresh.");
    }
  }
}

function loadBidBatchCache() {
  const today = getTodayEST();
  processedBidBatches = { date: today, batches: [] };
  if (fs.existsSync(BID_BATCH_CACHE_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(BID_BATCH_CACHE_PATH, "utf-8"));
      if (data.date === today && Array.isArray(data.batches)) {
        processedBidBatches = data;
      }
    } catch (e) {
      console.warn("⚠️ Failed to load bid batch cache. Starting fresh.");
    }
  }
}

function saveBatchCache() {
  try {
    fs.writeFileSync(BATCH_CACHE_PATH, JSON.stringify(processedBatches, null, 2));
    if (processedBatches.batches.length > 0) {
      console.log("💾 Batch cache saved:", processedBatches.batches.length, "batch(es) →", BATCH_CACHE_PATH);
    }
  } catch (e) {
    console.error("❌ Failed to save batch cache:", e.message, "path:", BATCH_CACHE_PATH);
  }
}
// RULE 2
function saveBidBatchCache() {
  fs.writeFileSync(
    BID_BATCH_CACHE_PATH,
    JSON.stringify(processedBidBatches, null, 2)
  );
}

// Create a unique hash per 3-call window using inboundCallIds
function hashBatch(win) {
  const ids = win
    .map((c) => c.inboundCallId)
    .sort()
    .join("|");
  return crypto.createHash("md5").update(ids).digest("hex");
}

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

const targetReqBody = {
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
  filters: [],
  formatTimeZone: "America/New_York",
};

function getCallLogs(targetName) {
  return {
    reportStart: reportStart,
    reportEnd: reportEnd,
    orderByColumns: [
      {
        column: "callDt",
        direction: "asc",
      },
    ],
    filters: [
      {
        anyConditionToMatch: [
          {
            column: "targetName",
            value: targetName,
            isNegativeMatch: false,
            comparisonType: "EQUALS",
          },
        ],
      },
      // {
      //   anyConditionToMatch: [
      //     {
      //       column: "endCallSource",
      //       value: "Target",
      //       isNegativeMatch: false,
      //       comparisonType: "EQUALS",
      //     },
      //   ],
      // },
    ],
    valueColumns: [
      { column: "campaignName" },
      { column: "publisherName" },
      { column: "targetName" },
      { column: "targetNumber" },
      { column: "buyer" },
      { column: "targetGroupName" },
      { column: "campaignId" },
      { column: "publisherId" },
      { column: "publisherSubId" },
      { column: "targetId" },
      { column: "targetSubId" },
      { column: "buyerId" },
      { column: "targetBuyerSubId" },
      { column: "targetGroupId" },
      { column: "inboundCallId" },
      { column: "callDt" },
      { column: "inboundPhoneNumber" },
      { column: "number" },
      { column: "numberId" },
      { column: "callCompletedDt" },
      { column: "callConnectionDt" },
      { column: "endCallSource" },
      { column: "hasConnected" },
      { column: "isIncomplete" },
      { column: "hasRecording" },
      { column: "isLive" },
      { column: "recordingUrl" },
      { column: "isFromNumberPool" },
      { column: "numberPoolId" },
      { column: "numberPoolName" },
      { column: "timeToCallInSeconds" },
      { column: "callLengthInSeconds" },
      { column: "connectedCallLengthInSeconds" },
      { column: "timeToConnectInSeconds" },
      { column: "noPayoutReason" },
      { column: "noConversionReason" },
      { column: "blockReason" },
      { column: "incompleteCallReason" },
      { column: "offlineConversionUploaded" },
      { column: "hasRpcCalculation" },
      { column: "googleAdsIntegrationType" },
      { column: "googleAdsUploadErrorCode" },
      { column: "googleAdsSuccessfulUpload" },
      { column: "hasPayout" },
      { column: "isDuplicate" },
      { column: "hasPreviouslyConnected" },
      { column: "previouseCallDateTime" },
      { column: "previouseCallTargetName" },
      { column: "hasConverted" },
      { column: "wasBlocked" },
      { column: "convAdjustmentsApprovedAmount" },
      { column: "conversionAmount" },
      { column: "profitNet" },
      { column: "profitGross" },
      { column: "payoutAmount" },
      { column: "hasVoiceMail" },
      { column: "totalCost" },
      { column: "telcoCost" },
      { column: "wasConversionAdjusted" },
      { column: "conversionAdjustedCalls" },
      { column: "wasPayoutAdjusted" },
      { column: "hasAnnotations" },
      { column: "convAdjustmentsRejectedCount" },
      { column: "convAdjustmentRequestCount" },
      { column: "convAdjustmentsApproved" },
      { column: "tcpaCount" },
      { column: "wasBlockedByTCPA" },
      { column: "tcpaCost" },
      { column: "dataEnrichmentCount" },
      { column: "icpCost" },
      { column: "customDataEnrichmentCount" },
      { column: "customDEappendedTagsCount" },
      { column: "customDataEnrichmentSuccess" },
      { column: "ivrDepth" },
      { column: "reroutedToChild" },
      { column: "reroutedFromParent" },
      { column: "globalCallId" },
      { column: "rerouteDepth" },
      { column: "transcriptionCost" },
      { column: "transcriptionCount" },
      { column: "transcriptionId" },
      { column: "hasTranscription" },
      { column: "pendingTranscription" },
      { column: "pingDynamicCallLengthInSeconds" },
      { column: "ringTreeWinningBidTargetName" },
      { column: "ringTreeWinningBidTargetId" },
      { column: "ringTreeWinningBid" },
      { column: "ringTreeWinningBidMinimumRevenueAmount" },
      { column: "ringTreeWinningBidDynamicDuration" },
      { column: "ringTreeWinningBidMaxDynamicDuration" },
      { column: "pingTotalBidAmount" },
      { column: "pingSuccessCount" },
      { column: "pingFailCount" },
      { column: "bidAmount" },
      { column: "winningBid" },
      { column: "winningBidCallAccepted" },
      { column: "winningBidCallRejected" },
      { column: "avgPingTreeBidAmount" },
    ],
    formatTimespans: true,
    formatPercentages: true,
    formatDateTime: true,
    formatTimeZone: "America/New_York",
    size: 150,
    offset: 0,
  };
}

// GET TARGETS
async function getAllTargets() {
  try {
    const response = await axios.post(
      `${BASE_URL}/${RINGBA_ACCOUNT_ID}/insights`,
      targetReqBody,
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

    // console.log(data);

    const targetList = data
      .map((curr) => curr.targetName)
      .filter((curr) => curr !== undefined && curr !== "-no value-");

    return targetList;
  } catch (error) {
    console.log("Error fetching campaign data:", error.response?.data || error);
    return null;
  }
}

async function getAllCallLogs(targetName) {
  try {
    const response = await axios.post(
      `${BASE_URL}/${RINGBA_ACCOUNT_ID}/calllogs`,
      getCallLogs(targetName),
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

    const callLogList = data.map((curr) => {
      return {
        targetName: curr.targetName,
        inboundPhoneNumber: curr.inboundPhoneNumber,
        inboundCallId: curr.inboundCallId,
        callLengthInSeconds: curr.connectedCallLengthInSeconds
          ? curr.connectedCallLengthInSeconds
          : "",
        endCallSource: curr.endCallSource ? curr.endCallSource : "",
      };
    });

    return callLogList;
  } catch (error) {
    console.log("Error fetching campaign data:", error.response?.data || error);
    return null;
  }
}

// function hmsToSeconds(timeStr) {
//   if (typeof timeStr === "number") return timeStr;
//   const parts = timeStr.split(":").map(Number);
//   if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
//   return parseInt(timeStr, 10); // fallback
// }

function hmsToSeconds(timeStr) {
  if (typeof timeStr === "number") return timeStr;

  if (!timeStr || typeof timeStr !== "string") return 100; // handle empty string, null, or non-strings

  const parts = timeStr.split(":").map(Number);

  if (parts.some(isNaN)) return 100; // handle invalid numbers like "1:xx:3"

  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];

  const fallback = parseInt(timeStr, 10);
  return isNaN(fallback) ? 0 : fallback;
}

function groupDropBatchByTargetStrict(batch) {
  const result = [];
  const usedCallIds = new Set();

  // If hmsToSeconds returned 100, that means it's invalid — treat as 0
  const normalizeDuration = (value) => {
    const secs = hmsToSeconds(value);
    return secs === 100 ? 0 : secs;
  };

  let i = 0;
  while (i <= batch.length - 3) {
    const a = batch[i];
    const b = batch[i + 1];
    const c = batch[i + 2];

    const unused =
      !usedCallIds.has(a.inboundCallId) &&
      !usedCallIds.has(b.inboundCallId) &&
      !usedCallIds.has(c.inboundCallId);

    const allHaveTargetEnd =
      a.endCallSource === "Target" &&
      b.endCallSource === "Target" &&
      c.endCallSource === "Target";

    const aTime = normalizeDuration(a.callLengthInSeconds);
    const bTime = normalizeDuration(b.callLengthInSeconds);
    const cTime = normalizeDuration(c.callLengthInSeconds);
    const allShort = aTime <= 20 && bTime <= 20 && cTime <= 20;

    if (unused && allShort && allHaveTargetEnd) {
      result.push([a, b, c]);
      usedCallIds.add(a.inboundCallId);
      usedCallIds.add(b.inboundCallId);
      usedCallIds.add(c.inboundCallId);
      i += 3;
    } else {
      i++;
    }
  }

  return result;
}

async function runReport() {
  loadBatchCache();
  loadBidBatchCache();

  const allTargets = await getAllTargets();
  if (!allTargets) return console.log("Problem fetching target list");

  for (const target of allTargets) {
    const allCallLogs = await getAllCallLogs(target);
    if (!allCallLogs) {
      console.log(`⚠️ Problem fetching call log list for ${target}`);
      continue;
    }

    // console.log(
    //   `📞 Retrieved ${allCallLogs.length} call logs for target: ${target}`
    // );

    const allGroups = groupDropBatchByTargetStrict(allCallLogs);

    for (const group of allGroups) {
      const batchId = hashBatch(group);
      if (processedBatches.batches.includes(batchId)) {
        console.log("🛑 Duplicate batch skipped");
        continue;
      }

      processedBatches.batches.push(batchId);
      saveBatchCache();

      const targetName = group[0].targetName;
      const messageLines = [
        `\n${targetName} has dropped three consecutive calls`,
      ];
      group.forEach((call) => {
        messageLines.push(`${call.inboundPhoneNumber} / ${call.inboundCallId}`);
      });

      // console.log(messageLines.join("\n"));
      sendSlackMessage(messageLines.join("\n"));
    }
  }
}

runReport();
