import "dotenv/config";
import axios from "axios";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const BASE_URL = "https://api.ringba.com/v2";
const RINGBA_ACCOUNT_ID = process.env.RINGBA_ACCOUNT_ID;
const API_TOKEN = process.env.RINGBA_API_TOKEN;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const __dirname = dirname(fileURLToPath(import.meta.url));
const ALERT_CACHE_PATH = join(__dirname, "multiTagsAlertCache.json");

function getReportWindow() {
  const now = new Date();
  const startDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 4, 0, 0, 0),
  );
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 1);
  endDate.setUTCHours(3, 59, 59, 999);

  return {
    reportStart: startDate.toISOString(),
    reportEnd: endDate.toISOString(),
  };
}

const CALLLOGS_VALUE_COLUMNS = [
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
];

function buildCalllogsBody(reportStart, reportEnd, offset, size) {
  return {
    reportStart,
    reportEnd,
    orderByColumns: [{ column: "callDt", direction: "desc" }],
    filters: [
      {
        anyConditionToMatch: [
          {
            column: "campaignName",
            value: "Paragon - Medicare",
            isNegativeMatch: false,
            comparisonType: "EQUALS",
          },
        ],
      },
      {
        anyConditionToMatch: [
          {
            column: "numberPoolName",
            value: "Medicare - Number Pool",
            isNegativeMatch: false,
            comparisonType: "EQUALS",
          },
        ],
      },
      {
        anyConditionToMatch: [
          {
            column: "tag:User:channel",
            value: "",
            isNegativeMatch: true,
            comparisonType: "EXISTS",
          },
          {
            column: "tag:User:angle",
            value: "",
            isNegativeMatch: true,
            comparisonType: "EXISTS",
          },
          {
            column: "tag:User:qualified",
            value: "",
            isNegativeMatch: true,
            comparisonType: "EXISTS",
          },
          {
            column: "tag:User:age",
            value: "",
            isNegativeMatch: true,
            comparisonType: "EXISTS",
          },
        ],
      },
    ],
    valueColumns: CALLLOGS_VALUE_COLUMNS,
    formatTimespans: true,
    formatPercentages: true,
    formatDateTime: true,
    formatTimeZone: "America/New_York",
    size,
    offset,
  };
}

const PAGE_SIZE = 150;
const MAX_ROWS = 10_000;
const DETAIL_BATCH_SIZE = 50;

async function fetchCalllogs() {
  const { reportStart, reportEnd } = getReportWindow();
  console.log("Report window:", reportStart, "→", reportEnd);

  const allRecords = [];
  let offset = 0;

  while (allRecords.length < MAX_ROWS) {
    const response = await axios.post(
      `${BASE_URL}/${RINGBA_ACCOUNT_ID}/calllogs`,
      buildCalllogsBody(reportStart, reportEnd, offset, PAGE_SIZE),
      {
        headers: {
          Authorization: `Token ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        timeout: 60_000,
      },
    );

    const records = response.data?.report?.records ?? [];
    if (!records.length) break;

    allRecords.push(...records);
    console.log(`  Fetched page at offset ${offset}: ${records.length} rows (total: ${allRecords.length})`);

    if (records.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (allRecords.length >= MAX_ROWS) {
    console.warn(`Hit ${MAX_ROWS} row cap — some records may be missing.`);
  }

  return allRecords;
}

function extractCallIds(records) {
  return records
    .filter((r) => r.inboundCallId && r.inboundPhoneNumber)
    .map((r) => ({
      inboundCallId: r.inboundCallId,
      inboundPhoneNumber: r.inboundPhoneNumber,
      publisherName: r.publisherName || "",
    }));
}

async function fetchCalllogDetails(inboundCallIds) {
  const response = await axios.post(
    `${BASE_URL}/${RINGBA_ACCOUNT_ID}/calllogs/detail`,
    {
      inboundCallIds,
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
      timeout: 60_000,
    },
  );

  return response.data?.report?.records ?? [];
}

async function fetchAllDetails(calls) {
  const allDetails = [];

  for (let i = 0; i < calls.length; i += DETAIL_BATCH_SIZE) {
    const batch = calls.slice(i, i + DETAIL_BATCH_SIZE);
    const ids = batch.map((c) => c.inboundCallId);

    const details = await fetchCalllogDetails(ids);
    allDetails.push(...details);

    console.log(
      `  Detail batch ${Math.floor(i / DETAIL_BATCH_SIZE) + 1}/${Math.ceil(calls.length / DETAIL_BATCH_SIZE)}: ` +
        `${details.length} records returned`,
    );
  }

  return allDetails;
}

async function sendSlackMessage(message) {
  if (!SLACK_WEBHOOK_URL) {
    console.warn("Slack skipped (no webhook):", message);
    return;
  }
  try {
    await axios.post(SLACK_WEBHOOK_URL, { text: message });
    console.log("Slack sent:", message);
  } catch (error) {
    console.error("Slack error:", error.response?.data || error.message);
  }
}

const REQUIRED_TAGS = ["channel", "angle", "qualified", "age"];

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

function loadAlertCache() {
  const today = getTodayEST();
  const empty = { date: today, alerts: [] };

  if (!existsSync(ALERT_CACHE_PATH)) {
    return empty;
  }

  try {
    const cache = JSON.parse(readFileSync(ALERT_CACHE_PATH, "utf-8"));
    if (cache?.date === today && Array.isArray(cache.alerts)) {
      return { date: today, alerts: [...new Set(cache.alerts)] };
    }
  } catch (error) {
    console.warn("Failed to read multiTags alert cache. Starting fresh.");
  }

  return empty;
}

function saveAlertCache(cache) {
  try {
    writeFileSync(ALERT_CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error("Failed to save multiTags alert cache:", error.message);
  }
}

function findMissingTags(detailRecord) {
  const messageTags = detailRecord?.["message-tags"] ?? [];
  const presentNames = new Set(
    messageTags
      .filter((t) => t && typeof t.name === "string")
      .map((t) => t.name.toLowerCase()),
  );

  return REQUIRED_TAGS.filter((tag) => !presentNames.has(tag));
}

function buildCallLookup(calls) {
  const map = new Map();
  for (const call of calls) {
    map.set(call.inboundCallId, call);
  }
  return map;
}

function formatAlertMessage(inboundPhoneNumber, publisherName, missingTags) {
  const tagList = missingTags.join(" & ");
  const suffix = missingTags.length > 1 ? "tags" : "tag";
  return `Call ${inboundPhoneNumber} from ${publisherName} does not contain ${tagList} ${suffix}`;
}

async function run() {
  if (!RINGBA_ACCOUNT_ID || !API_TOKEN) {
    console.error("RINGBA_ACCOUNT_ID and RINGBA_API_TOKEN must be set in .env");
    process.exit(1);
  }

  const records = await fetchCalllogs();
  console.log(`Total call log records: ${records.length}`);

  const calls = extractCallIds(records);
  console.log(`Calls to check detail for: ${calls.length}`);

  if (!calls.length) {
    console.log("No calls missing tags today.");
    return;
  }

  const details = await fetchAllDetails(calls);
  console.log(`Total detail records: ${details.length}`);

  const callLookup = buildCallLookup(calls);
  const alerts = [];
  const alertCache = loadAlertCache();
  const sentToday = new Set(alertCache.alerts);

  for (const detail of details) {
    const callId = detail.inboundCallId;
    if (!callId) continue;

    const original = callLookup.get(callId);
    if (!original) continue;

    const missingTags = findMissingTags(detail);
    if (!missingTags.length) continue;

    const message = formatAlertMessage(
      original.inboundPhoneNumber,
      original.publisherName,
      missingTags,
    );
    if (!sentToday.has(message)) {
      alerts.push(message);
    }
  }

  console.log(`Alerts to send (new only): ${alerts.length}`);

  if (alerts.length > 0) {
    const bullets = alerts.map((line) => `• ${line}`).join("\n");
    await sendSlackMessage(`*Multi Tags*\n${bullets}`);

    for (const alert of alerts) {
      sentToday.add(alert);
    }
    alertCache.alerts = Array.from(sentToday);
    saveAlertCache(alertCache);
  }
}

run().catch((err) => {
  console.error("multiTags failed:", err.response?.data || err.message || err);
  process.exit(1);
});
