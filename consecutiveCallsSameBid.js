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

// Batch cache path (resolve to absolute; separate file from consecutiveCalls.js)
const BATCH_CACHE_PATH = path.resolve(__dirname, "processedBatchesSameBid.json");
const BID_BATCH_CACHE_PATH = path.resolve(__dirname, "processedBidBatches.json");
const LOCK_FILE_PATH = path.resolve(__dirname, ".api7r2v1.lock");

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
let processedBatchesSet = new Set();

function loadBatchCache() {
  const today = getTodayEST();
  processedBatches = { date: today, batches: [] };
  processedBatchesSet = new Set();
  if (fs.existsSync(BATCH_CACHE_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(BATCH_CACHE_PATH, "utf-8"));
      if (data.date === today && Array.isArray(data.batches)) {
        processedBatches = data;
        processedBatches.batches = [...new Set(data.batches)];
        processedBatchesSet = new Set(processedBatches.batches);
        if (processedBatches.batches.length > 0) {
          console.log(`📂 Loaded ${processedBatches.batches.length} unique batches from cache`);
        }
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

// Lock file management to prevent concurrent runs
function acquireLock() {
  try {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      const lockData = fs.readFileSync(LOCK_FILE_PATH, "utf-8");
      const lockInfo = JSON.parse(lockData);
      const now = Date.now();
      const lockAge = now - lockInfo.timestamp;
      const MAX_LOCK_AGE = 30 * 60 * 1000; // 30 minutes

      if (lockAge > MAX_LOCK_AGE) {
        console.log(
          `⚠️ Stale lock file detected (${Math.round(
            lockAge / 1000 / 60,
          )} minutes old). Removing...`,
        );
        fs.unlinkSync(LOCK_FILE_PATH);
      } else {
        console.log(
          `🚫 Another instance is already running (started at ${new Date(
            lockInfo.timestamp,
          ).toISOString()}, PID: ${lockInfo.pid}). Exiting.`,
        );
        return false;
      }
    }

    const lockInfo = {
      pid: process.pid,
      timestamp: Date.now(),
      script: "api7r2v1.js",
    };
    fs.writeFileSync(LOCK_FILE_PATH, JSON.stringify(lockInfo, null, 2));
    return true;
  } catch (error) {
    console.error("❌ Error acquiring lock:", error.message);
    return false;
  }
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      fs.unlinkSync(LOCK_FILE_PATH);
      console.log("🔓 Lock released");
    }
  } catch (error) {
    console.error("⚠️ Error releasing lock:", error.message);
  }
}

function saveBatchCache() {
  try {
    processedBatches.batches = Array.from(processedBatchesSet);
    fs.writeFileSync(BATCH_CACHE_PATH, JSON.stringify(processedBatches, null, 2));
    if (processedBatches.batches.length > 0) {
      console.log("💾 Same-bid batch cache saved:", processedBatches.batches.length, "batch(es) →", BATCH_CACHE_PATH);
    }
  } catch (e) {
    console.error("❌ Failed to save same-bid batch cache:", e.message, "path:", BATCH_CACHE_PATH);
  }
}

function saveBidBatchCache() {
  try {
    fs.writeFileSync(
      BID_BATCH_CACHE_PATH,
      JSON.stringify(processedBidBatches, null, 2),
    );
  } catch (e) {
    console.error("❌ Failed to save bid batch cache:", e.message);
  }
}

// Create a unique hash per 3-call window using inboundCallIds
function hashBatch(win) {
  if (!Array.isArray(win) || win.length !== 3) {
    return null;
  }

  const ids = win
    .filter((c) => c && c.inboundCallId)
    .map((c) => c.inboundCallId)
    .sort()
    .join("|");

  if (!ids) {
    return null;
  }

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
      error.response?.data || error,
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
      0,
    ),
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
        timeout: 30000, // 30 second timeout
      },
    );

    const data = response.data?.report?.records || [];
    if (!data || data.length === 0) {
      console.warn("⚠️ No target data retrieved from API");
      return null;
    }

    const targetList = data
      .filter((curr) => curr != null)
      .map((curr) => curr.targetName)
      .filter(
        (curr) => curr !== undefined && curr !== null && curr !== "-no value-",
      );

    return targetList.length > 0 ? targetList : null;
  } catch (error) {
    console.error(
      "Error fetching TARGET data:",
      error.response?.data || error.message,
    );
    return null;
  }
}

// GET List of inboundCall Id per target with pagination support
async function getInbounceCallId(targetName) {
  try {
    const allCallLogList = [];
    let offset = 0;
    const pageSize = 150;
    let hasMore = true;

    while (hasMore) {
      const requestBody = getCallLogs(targetName);
      requestBody.offset = offset;
      requestBody.size = pageSize;

      const response = await axios.post(
        `${BASE_URL}/${RINGBA_ACCOUNT_ID}/calllogs`,
        requestBody,
        {
          headers: {
            Authorization: `Token ${API_TOKEN}`,
            "Content-Type": "application/json",
          },
          timeout: 30000, // 30 second timeout
        },
      );

      const data = response.data?.report?.records || [];

      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      // Extract inboundCallIds with null safety
      data.forEach((curr) => {
        if (curr && curr.inboundCallId) {
          allCallLogList.push(curr.inboundCallId);
        }
      });

      // Check if we got fewer results than page size (last page)
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }

      // Safety limit to prevent infinite loops (10k calls = ~67 pages)
      if (offset >= 10000) {
        console.log(
          `⚠️ Hit 10k call limit for ${targetName}, stopping pagination`,
        );
        hasMore = false;
      }
    }

    return allCallLogList.length > 0 ? allCallLogList : null;
  } catch (error) {
    console.error(
      `Error fetching CALL LOGS data for ${targetName}:`,
      error.response?.data || error.message,
    );
    return null;
  }
}

// Get details for callLogs - accepts array of call IDs
async function getDetailsPeroCallLog(batchIds) {
  try {
    // Ensure batchIds is an array
    const idsArray = Array.isArray(batchIds) ? batchIds : [batchIds];

    // Filter out any null/undefined IDs
    const validIds = idsArray.filter((id) => id != null && id !== "");

    if (validIds.length === 0) {
      console.warn("⚠️ No valid call IDs provided to getDetailsPeroCallLog");
      return [];
    }

    const response = await axios.post(
      `${BASE_URL}/${RINGBA_ACCOUNT_ID}/calllogs/detail`,
      {
        inboundCallIds: validIds,
        formatTimespans: true,
        formatPercentages: true,
        formatDateTime: true,
        formatTimeZone: "America/New_York",
      },
      {
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 second timeout
      },
    );

    const data = response.data?.report?.records || [];

    if (!data || data.length === 0) {
      return [];
    }

    const processData = data
      .filter((curr) => curr != null) // Filter out null records
      .map((curr) => {
        return {
          targetName: curr.targetName || "",
          inboundPhoneNumber: curr.inboundPhoneNumber || "",
          inboundCallId: curr.inboundCallId || "",
          callLengthInSeconds: curr.callLengthInSeconds || null,
          endCallSource: curr.endCallSource || "",
          bidAmount: processEvents(curr.events, curr.targetName),
        };
      })
      .filter((item) => item.inboundCallId !== ""); // Filter out items without call ID

    return processData;
  } catch (error) {
    console.error(
      "Error fetching DETAILS data:",
      error.response?.data || error.message,
    );
    return null;
  }
}

// HELPER FUNCTION BATCH CALL IDS INTO CHUNKS OF 50
function batchCallIds(callIds) {
  if (!Array.isArray(callIds) || callIds.length === 0) {
    return [];
  }

  const allBatches = [];
  const batchSize = 50;

  // Handle flat array of call IDs
  for (let i = 0; i < callIds.length; i += batchSize) {
    const batch = callIds.slice(i, i + batchSize).filter((id) => id != null);
    if (batch.length > 0) {
      allBatches.push(batch);
    }
  }

  return allBatches;
}

// HELPER FUNCTION PROCESS EVENTS ARRAY
function processEvents(events, targetName) {
  // Null/undefined safety checks
  if (!events || !Array.isArray(events) || events.length === 0) {
    return null;
  }

  const summaryEvent = events.find(
    (event) =>
      event &&
      event.name === "PingTreePingingSummary" &&
      event.acceptedRingTreeTargets &&
      typeof event.acceptedRingTreeTargets === "string" &&
      event.acceptedRingTreeTargets.trim() !== "",
  );

  if (!summaryEvent) {
    return null;
  }

  const acceptedRingTreeTarget = summaryEvent.acceptedRingTreeTargets;

  // Split targets by newlines
  const targets = acceptedRingTreeTarget.split(/\r?\n/);

  for (const target of targets) {
    if (!target || typeof target !== "string") continue;

    const match = target.match(/^(.+?)\[(\d+(\.\d+)?),/); // extract name and bidAmount

    if (match && match.length >= 3) {
      const acceptedTargetName = match[1].trim();

      if (acceptedTargetName === targetName) {
        const bidAmount = parseFloat(match[2]);
        return isNaN(bidAmount) ? null : bidAmount;
      }
    }
  }

  // No match found
  return null;
}

function hmsToSeconds(timeStr) {
  if (timeStr == null) return null;
  if (typeof timeStr === "number") return timeStr;
  if (typeof timeStr !== "string") return null;

  const parts = timeStr.split(":").map(Number);
  if (parts.length === 3) {
    const seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    return isNaN(seconds) ? null : seconds;
  }

  const parsed = parseInt(timeStr, 10);
  return isNaN(parsed) ? null : parsed;
}

function groupDropBatchByTargetStrict(batch) {
  if (!Array.isArray(batch) || batch.length < 3) {
    return [];
  }

  const result = [];
  const usedCallIds = new Set();

  let i = 0;
  while (i <= batch.length - 3) {
    const a = batch[i];
    const b = batch[i + 1];
    const c = batch[i + 2];

    // Null/undefined safety checks
    if (!a || !b || !c) {
      i++;
      continue;
    }

    // Ensure all have inboundCallId
    if (!a.inboundCallId || !b.inboundCallId || !c.inboundCallId) {
      i++;
      continue;
    }

    const unused =
      !usedCallIds.has(a.inboundCallId) &&
      !usedCallIds.has(b.inboundCallId) &&
      !usedCallIds.has(c.inboundCallId);

    const allHaveTargetEnd =
      a.endCallSource === "Target" &&
      b.endCallSource === "Target" &&
      c.endCallSource === "Target";

    const aTime = a.callLengthInSeconds
      ? hmsToSeconds(a.callLengthInSeconds)
      : null;
    const bTime = b.callLengthInSeconds
      ? hmsToSeconds(b.callLengthInSeconds)
      : null;
    const cTime = c.callLengthInSeconds
      ? hmsToSeconds(c.callLengthInSeconds)
      : null;

    const allShort =
      aTime != null &&
      bTime != null &&
      cTime != null &&
      aTime <= 20 &&
      bTime <= 20 &&
      cTime <= 20;

    const sameTarget =
      a.targetName &&
      b.targetName &&
      c.targetName &&
      a.targetName === b.targetName &&
      b.targetName === c.targetName;

    const allHaveBidAmount =
      a.bidAmount != null && b.bidAmount != null && c.bidAmount != null;

    const sameBidAmount =
      a.bidAmount === b.bidAmount && b.bidAmount === c.bidAmount;

    if (
      unused &&
      allShort &&
      allHaveTargetEnd &&
      sameTarget &&
      allHaveBidAmount &&
      sameBidAmount
    ) {
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
  if (!acquireLock()) {
    console.log("⏭️ Skipping run - another instance is already processing");
    process.exit(0);
  }

  loadBatchCache();
  loadBidBatchCache();

  const startTime = Date.now();
  console.log(`🚀 Starting report at ${new Date().toISOString()}`);

  // const token = await getAuthToken();
  // if (!token) return console.log("❌ Failed to retrieve token. Exiting.");

  try {
    // GET ALL TARGETS
    const allTargets = await getAllTargets();
    if (!allTargets) {
      console.log("Problem fetching target list");
      saveBatchCache(); // Save cache even if targets fail
      return;
    }

    const totalTargets = allTargets.length;
    console.log(`📊 Processing ${totalTargets} targets...`);

    for (let targetIndex = 0; targetIndex < allTargets.length; targetIndex++) {
      const target = allTargets[targetIndex];
      try {
        console.log(
          `[${targetIndex + 1}/${totalTargets}] Processing target: ${target}`,
        );

        const allCallLogs = await getInbounceCallId(target);
        if (!allCallLogs) {
          console.log(`⚠️ Problem fetching call log list for ${target}`);
          continue;
        }

        console.log(`   Found ${allCallLogs.length} calls for ${target}`);

        const batchedCallLogs = batchCallIds(allCallLogs);
        console.log(
          `   Batching into ${batchedCallLogs.length} groups of 50...`,
        );

        const allLogs = [];
        const totalBatches = batchedCallLogs.length;

        for (
          let batchIndex = 0;
          batchIndex < batchedCallLogs.length;
          batchIndex++
        ) {
          const callLogs = batchedCallLogs[batchIndex];

          if (batchIndex % 10 === 0 || batchIndex === totalBatches - 1) {
            console.log(
              `   Fetching batch ${batchIndex + 1}/${totalBatches} (${
                callLogs.length
              } calls)...`,
            );
          }

          const dataCallLogs = await getDetailsPeroCallLog(callLogs);
          if (!dataCallLogs || dataCallLogs.length === 0) {
            console.log(
              `⚠️ Problem fetching call log details for batch ${
                batchIndex + 1
              } (${callLogs.length} IDs), skipping`,
            );
            continue; // Continue processing other batches instead of stopping
          }
          allLogs.push(...dataCallLogs);
        }

        console.log(
          `   Processed ${allLogs.length} call details for ${target}`,
        );

        const processAllCallLogs = groupDropBatchByTargetStrict(allLogs);
        console.log(
          `   Found ${processAllCallLogs.length} potential drop batches for ${target}`,
        );

        for (const group of processAllCallLogs) {
          const batchId = hashBatch(group);

          // Skip if hashBatch returned null (invalid group)
          if (!batchId) {
            console.warn("⚠️ Skipping invalid batch group (missing call IDs)");
            continue;
          }

          // Use Set for O(1) duplicate checking instead of O(n) Array.includes()
          if (processedBatchesSet.has(batchId)) {
            console.log("🛑 Duplicate batch skipped");
            continue;
          }

          processedBatchesSet.add(batchId);
          saveBatchCache(); // Save immediately after adding each batch

          // Check if any phone number contains "Restricted"
          const hasRestrictedNumber = group.some(
            (call) =>
              call.inboundPhoneNumber &&
              call.inboundPhoneNumber.includes("Restricted"),
          );

          // Skip Slack notification if batch contains Restricted numbers
          if (hasRestrictedNumber) {
            console.log(
              "🚫 Skipping Slack notification - batch contains Restricted numbers",
            );
            continue;
          }

          const targetName = group[0].targetName;
          const messageLines = [
            `\n${targetName} has dropped three consecutive calls on the same bid $${group[0].bidAmount}`,
          ];
          group.forEach((call) => {
            messageLines.push(
              `${call.inboundPhoneNumber} / ${call.inboundCallId}`,
            );
          });

          console.log(messageLines.join("\n"));
          sendSlackMessage(messageLines.join("\n"));
        }

        // Save cache after processing each target
        saveBatchCache();
        console.log(`✅ Completed processing ${target}\n`);
      } catch (targetError) {
        console.error(
          `❌ Error processing target ${target}:`,
          targetError.message || targetError,
        );
        saveBatchCache(); // Save cache even if target processing fails
        continue; // Continue with next target
      }
    }

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    console.log(`\n✅ Finished processing all ${totalTargets} targets`);
    console.log(
      `💾 Cache contains ${processedBatchesSet.size} unique processed batches`,
    );
    console.log(
      `⏱️ Total execution time: ${duration} seconds (${Math.round(
        duration / 60,
      )} minutes)`,
    );
  } catch (error) {
    console.error("❌ Fatal error in runReport:", error.message || error);
  } finally {
    // Always save cache at the end, even if errors occurred
    saveBatchCache();
    console.log("💾 Cache saved");

    // Always release lock
    releaseLock();
    console.log(`🏁 Report completed at ${new Date().toISOString()}\n`);
  }
}

// Handle process termination to ensure lock is released
process.on("SIGINT", () => {
  console.log("\n⚠️ Received SIGINT, cleaning up...");
  releaseLock();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n⚠️ Received SIGTERM, cleaning up...");
  releaseLock();
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught exception:", error);
  releaseLock();
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled rejection at:", promise, "reason:", reason);
  releaseLock();
  process.exit(1);
});

runReport();
