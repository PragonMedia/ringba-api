import "dotenv/config";
import axios from "axios";

const BASE_URL = "https://api.ringba.com/v2";
const RINGBA_ACCOUNT_ID =
  process.env.ELITE_RINGBA_ACCOUNT_ID || process.env.RINGBA_ACCOUNT_ID;
const USERNAME = process.env.ELITE_RINGBA_USERNAME || process.env.RINGBA_USERNAME;
const PASSWORD = process.env.ELITE_RINGBA_PASSWORD || process.env.RINGBA_PASSWORD;
const SLACK_WEBHOOK_URL =
  process.env.ELITE_SLACK_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
const API_TOKEN =
  process.env.ELITE_RINGBA_API_TOKEN || process.env.RINGBA_API_TOKEN;

const CALLLOGS_PAGE_SIZE = 150;
/** Upper bound on rows pulled per run (paginated). Raise if a single Ringba day can exceed this. */
const CALLLOGS_MAX_ROWS = 20_000;

/** Call logs list columns — same set as `publisherTvTags.js` / Ringba UI. */
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

if (!RINGBA_ACCOUNT_ID) {
  console.warn("⚠️ ELITE_RINGBA_ACCOUNT_ID or RINGBA_ACCOUNT_ID not set in .env");
}
if (!API_TOKEN && (!USERNAME || !PASSWORD)) {
  console.warn(
    "⚠️ Set ELITE_RINGBA_API_TOKEN (or RINGBA_API_TOKEN) or ELITE_RINGBA_USERNAME/PASSWORD",
  );
}

/**
 * Ringba reporting window: UTC 04:00 today → 03:59:59.999Z “tomorrow” (same as `pgnmNumberpool.js`).
 */
function getFormattedUTCDate() {
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

/** Ringba often returns `{ report }` or `[{ report }]`. */
function extractReportRecords(responseData) {
  if (Array.isArray(responseData) && responseData.length > 0) {
    return responseData[0]?.report?.records ?? [];
  }
  return responseData?.report?.records ?? [];
}

function buildEliteCalllogsBody(reportStart, reportEnd, offset, size) {
  return {
    reportStart,
    reportEnd,
    orderByColumns: [{ column: "callDt", direction: "desc" }],
    filters: [],
    valueColumns: CALLLOGS_VALUE_COLUMNS,
    formatTimespans: true,
    formatPercentages: true,
    formatDateTime: true,
    formatTimeZone: "America/New_York",
    size,
    offset,
  };
}

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

    return response.data?.access_token ?? null;
  } catch (error) {
    console.error("Error getting token:", error.response?.data || error);
    return null;
  }
}

async function getAuthorizationToken() {
  if (API_TOKEN) return API_TOKEN;
  return getAuthToken();
}

function ringbaAuthHeaders(token) {
  return {
    Authorization: `Token ${token}`,
    "Content-Type": "application/json",
  };
}

async function postCalllogsPage(token, reportStart, reportEnd, offset, size) {
  const response = await axios.post(
    `${BASE_URL}/${RINGBA_ACCOUNT_ID}/calllogs`,
    buildEliteCalllogsBody(reportStart, reportEnd, offset, size),
    {
      headers: ringbaAuthHeaders(token),
      timeout: 60_000,
    },
  );
  return extractReportRecords(response.data);
}

/**
 * All call log rows for the current Ringba UTC day window, paginated (max `CALLLOGS_MAX_ROWS`).
 */
export async function fetchEliteCalllogsForCurrentWindow(token, options = {}) {
  const pageSize = options.pageSize ?? CALLLOGS_PAGE_SIZE;
  const maxRows = options.maxRows ?? CALLLOGS_MAX_ROWS;
  const { reportStart, reportEnd } = getFormattedUTCDate();

  const records = [];
  let offset = 0;

  while (records.length < maxRows) {
    const page = await postCalllogsPage(
      token,
      reportStart,
      reportEnd,
      offset,
      pageSize,
    );
    if (!Array.isArray(page) || page.length === 0) break;

    for (const row of page) {
      records.push(row);
      if (records.length >= maxRows) break;
    }

    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return { reportStart, reportEnd, records };
}

/** One entry per call log row (duplicates allowed). Skips missing / non-string. */
function extractInboundPhoneNumbers(records) {
  if (!Array.isArray(records)) return [];
  const out = [];
  for (const row of records) {
    const v = row?.inboundPhoneNumber;
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t.length > 0) out.push(t);
  }
  return out;
}

/** Map phone → occurrence count. */
function countInboundPhoneNumbers(phones) {
  const counts = new Map();
  for (const p of phones) {
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return counts;
}

/** Entries with count ≥ `minCount`, sorted by count desc then number. */
function getInboundNumbersAtLeast(counts, minCount = 5) {
  return [...counts.entries()]
    .filter(([, n]) => n >= minCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

async function run() {
  const token = await getAuthorizationToken();
  if (!token) {
    console.error("❌ eliteNumberBlocker: missing Ringba token. Exiting.");
    return;
  }

  const { reportStart, reportEnd, records } =
    await fetchEliteCalllogsForCurrentWindow(token);

  const inboundPhones = extractInboundPhoneNumbers(records);
  const counts = countInboundPhoneNumbers(inboundPhones);
  const atLeast5 = getInboundNumbersAtLeast(counts, 5);

  console.log("eliteNumberBlocker — report window (dynamic UTC):");
  console.log(" ", reportStart, "→", reportEnd);
  console.log("calllogs rows fetched:", records.length);
  console.log(
    "inboundPhoneNumber: unique callers =",
    counts.size,
    "| rows with a number =",
    inboundPhones.length,
  );
  console.log(
    `inboundPhoneNumber with ≥5 calls in window (${atLeast5.length}):`,
  );
  for (const [phone, n] of atLeast5) {
    console.log(`${phone}  (${n} calls)`);
  }

  if (records.length >= CALLLOGS_MAX_ROWS) {
    console.warn(
      `⚠️ Hit CALLLOGS_MAX_ROWS (${CALLLOGS_MAX_ROWS}); some rows may be missing. Increase cap if needed.`,
    );
  }

  // TODO: POST …/blockedNumbers for each number in atLeast5
}

run().catch((err) => {
  console.error("❌ eliteNumberBlocker failed:", err.response?.data || err);
});

export {
  BASE_URL,
  RINGBA_ACCOUNT_ID,
  SLACK_WEBHOOK_URL,
  countInboundPhoneNumbers,
  extractInboundPhoneNumbers,
  getInboundNumbersAtLeast,
  getAuthToken,
  getAuthorizationToken,
  getFormattedUTCDate,
  ringbaAuthHeaders,
};
