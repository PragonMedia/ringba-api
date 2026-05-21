import "dotenv/config";
import axios from "axios";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALERT_CACHE_PATH = join(__dirname, "webHookAlertCache.json");

const BASE_URL = "https://api.ringba.com/v2";
const RINGBA_ACCOUNT_ID = process.env.RINGBA_ACCOUNT_ID;
const API_TOKEN = process.env.RINGBA_API_TOKEN;
const USERNAME = process.env.RINGBA_USERNAME;
const PASSWORD = process.env.RINGBA_PASSWORD;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

if (!SLACK_WEBHOOK_URL) {
  console.warn("⚠️ SLACK_WEBHOOK_URL not set in .env — Slack alerts disabled.");
}
if (!RINGBA_ACCOUNT_ID || !API_TOKEN) {
  console.warn(
    "⚠️ RINGBA_ACCOUNT_ID or RINGBA_API_TOKEN not set — API calls may fail.",
  );
}

const CALLLOGS_PAGE_SIZE = 150;

async function sendSlackMessage(message) {
  if (!SLACK_WEBHOOK_URL) {
    console.warn("Slack skipped (no webhook):", message);
    return false;
  }
  try {
    await axios.post(SLACK_WEBHOOK_URL, { text: message });
    console.log("✅ Message sent to Slack:", message);
    return true;
  } catch (error) {
    console.error(
      "❌ Error sending message to Slack:",
      error.response?.data || error,
    );
    return false;
  }
}

const VALUE_COLUMNS = [
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
  { column: "pingTotalBidAmount" },
  { column: "pingSuccessCount" },
  { column: "pingFailCount" },
  { column: "avgPingTreeBidAmount" },
];

/** UTC 04:00 today → 03:59:59.999Z tomorrow (Ringba reporting day). */
function getReportWindow() {
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

function buildCalllogsBody(reportStart, reportEnd, offset, size) {
  return {
    reportStart,
    reportEnd,
    orderByColumns: [{ column: "callDt", direction: "desc" }],
    filters: [
      {
        anyConditionToMatch: [
          {
            column: "isIncomplete",
            value: "no",
            isNegativeMatch: false,
            comparisonType: "EQUALS",
          },
        ],
      },
      {
        anyConditionToMatch: [
          {
            column: "connectedCallLengthInSeconds",
            value: "299",
            isNegativeMatch: false,
            comparisonType: "GREATER_THAN",
          },
        ],
      },
      {
        anyConditionToMatch: [
          {
            column: "conversionAmount",
            value: "1",
            isNegativeMatch: false,
            comparisonType: "LESS_THAN",
          },
        ],
      },
    ],
    valueColumns: VALUE_COLUMNS,
    formatTimespans: true,
    formatPercentages: true,
    formatDateTime: true,
    formatTimeZone: "America/New_York",
    size,
    offset,
  };
}

function extractReportRecords(responseData) {
  if (Array.isArray(responseData) && responseData.length > 0) {
    return responseData[0]?.report?.records ?? [];
  }
  return responseData?.report?.records ?? [];
}

function extractTargetAndCallId(records) {
  if (!Array.isArray(records)) return [];
  const out = [];
  for (const row of records) {
    const targetName = row?.targetName;
    const inboundCallId = row?.inboundCallId;
    if (typeof targetName !== "string" || typeof inboundCallId !== "string") {
      continue;
    }
    out.push({
      targetName: targetName.trim(),
      inboundCallId: inboundCallId.trim(),
    });
  }
  return out;
}

async function getAuthToken() {
  const params = new URLSearchParams();
  params.append("grant_type", "password");
  params.append("username", USERNAME);
  params.append("password", PASSWORD);

  const response = await axios.post(`${BASE_URL}/token`, params, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
  });
  return response.data?.access_token ?? null;
}

async function getAuthorizationToken() {
  if (API_TOKEN) return API_TOKEN;
  return getAuthToken();
}

const CALL_WEBHOOK_URL_PREFIX = "/hook/";

/** Hour (0–23) and calendar parts in America/New_York. */
function getNowEST() {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: Number(get("hour")),
  };
}

/**
 * Alert cycle resets at 11pm EST. Before 11pm → today's date; from 11pm onward → tomorrow's date key.
 */
function getAlertCycleKey() {
  const { year, month, day, hour } = getNowEST();
  let y = Number(year);
  let m = Number(month);
  let d = Number(day);

  if (hour >= 23) {
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    y = next.getUTCFullYear();
    m = next.getUTCMonth() + 1;
    d = next.getUTCDate();
  }

  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function loadAlertCache() {
  const cycleKey = getAlertCycleKey();
  const empty = { cycleKey, inboundCallIds: [] };

  if (!existsSync(ALERT_CACHE_PATH)) return empty;

  try {
    const data = JSON.parse(readFileSync(ALERT_CACHE_PATH, "utf-8"));
    if (data?.cycleKey === cycleKey && Array.isArray(data.inboundCallIds)) {
      return {
        cycleKey,
        inboundCallIds: data.inboundCallIds.filter(
          (id) => typeof id === "string" && id.length > 0,
        ),
      };
    }
  } catch {
    console.warn("⚠️ webHook alert cache unreadable; starting fresh.");
  }

  return empty;
}

function saveAlertCache(cache) {
  writeFileSync(
    ALERT_CACHE_PATH,
    JSON.stringify(
      {
        cycleKey: cache.cycleKey,
        inboundCallIds: cache.inboundCallIds,
      },
      null,
      2,
    ),
    "utf-8",
  );
}

function hasAlertedInboundCallId(cache, inboundCallId) {
  return cache.inboundCallIds.includes(inboundCallId);
}

function markInboundCallIdAlerted(cache, inboundCallId) {
  if (!hasAlertedInboundCallId(cache, inboundCallId)) {
    cache.inboundCallIds.push(inboundCallId);
  }
}

function hasCallWebHookEvent(events) {
  if (!Array.isArray(events)) return false;
  return events.some(
    (ev) =>
      ev?.name === "CallWebHook" &&
      typeof ev?.url === "string" &&
      ev.url.startsWith(CALL_WEBHOOK_URL_PREFIX),
  );
}

async function postCalllogsDetail(token, inboundCallId) {
  const response = await axios.post(
    `${BASE_URL}/${RINGBA_ACCOUNT_ID}/calllogs/detail`,
    {
      inboundCallIds: [inboundCallId],
      formatTimespans: true,
      formatPercentages: true,
      formatDateTime: true,
      formatTimeZone: "America/New_York",
    },
    {
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 60_000,
    },
  );

  if (response.data?.isSuccessful === false) {
    throw new Error(
      `Ringba calllogs/detail failed for ${inboundCallId}: ${JSON.stringify(response.data)}`,
    );
  }

  const records = extractReportRecords(response.data);
  return records[0] ?? null;
}

async function findWebhookConversionIssues(token, targets) {
  const cache = loadAlertCache();
  const alerts = [];
  let skipped = 0;

  for (const { targetName, inboundCallId } of targets) {
    if (hasAlertedInboundCallId(cache, inboundCallId)) {
      skipped++;
      console.log("🛑 Duplicate alert skipped:", inboundCallId);
      continue;
    }

    try {
      const detail = await postCalllogsDetail(token, inboundCallId);
      if (hasCallWebHookEvent(detail?.events)) {
        const message = `${targetName} webhook conversion not working`;
        const sent = await sendSlackMessage(message);
        if (sent) {
          alerts.push({ targetName, inboundCallId, message });
          markInboundCallIdAlerted(cache, inboundCallId);
          saveAlertCache(cache);
        }
      }
    } catch (err) {
      console.error(
        `[${inboundCallId}] calllogs/detail error:`,
        err.response?.data || err.message || err,
      );
    }
  }

  return { alerts, skipped, cache };
}

async function fetchCalllogTargets(token) {
  const { reportStart, reportEnd } = getReportWindow();
  const allRecords = [];
  let offset = 0;

  while (true) {
    const response = await axios.post(
      `${BASE_URL}/${RINGBA_ACCOUNT_ID}/calllogs`,
      buildCalllogsBody(reportStart, reportEnd, offset, CALLLOGS_PAGE_SIZE),
      {
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 120_000,
      },
    );

    if (response.data?.isSuccessful === false) {
      throw new Error(
        `Ringba calllogs failed: ${JSON.stringify(response.data)}`,
      );
    }

    const page = extractReportRecords(response.data);
    if (!Array.isArray(page) || page.length === 0) break;

    allRecords.push(...page);

    if (page.length < CALLLOGS_PAGE_SIZE) break;
    offset += CALLLOGS_PAGE_SIZE;
  }

  return {
    reportStart,
    reportEnd,
    records: allRecords,
    targets: extractTargetAndCallId(allRecords),
  };
}

async function run() {
  if (!RINGBA_ACCOUNT_ID) {
    throw new Error("RINGBA_ACCOUNT_ID is not set in .env");
  }

  const token = await getAuthorizationToken();
  if (!token) {
    throw new Error(
      "Set RINGBA_API_TOKEN or RINGBA_USERNAME + RINGBA_PASSWORD in .env",
    );
  }

  const { reportStart, reportEnd, records, targets } =
    await fetchCalllogTargets(token);

  console.log("Report window:", reportStart, "→", reportEnd);
  console.log("Raw calllog rows:", records.length);
  console.log("Checking calllogs/detail for", targets.length, "calls…");
  console.log("Alert cache cycle (resets 11pm EST):", getAlertCycleKey());

  const { alerts, skipped } = await findWebhookConversionIssues(token, targets);

  console.log(
    `Done. ${alerts.length} new alert(s), ${skipped} skipped (already alerted this cycle), ${targets.length} checked.`,
  );
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  run().catch((err) => {
    console.error("webHook failed:", err.response?.data || err.message || err);
    process.exit(1);
  });
}

export {
  getReportWindow,
  getAlertCycleKey,
  loadAlertCache,
  saveAlertCache,
  buildCalllogsBody,
  extractTargetAndCallId,
  fetchCalllogTargets,
  hasCallWebHookEvent,
  postCalllogsDetail,
  findWebhookConversionIssues,
};
