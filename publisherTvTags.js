import "dotenv/config";
import axios from "axios";

const BASE_URL = "https://api.ringba.com/v2";
const RINGBA_ACCOUNT_ID = process.env.RINGBA_ACCOUNT_ID;
const RINGBA_USERNAME = process.env.RINGBA_USERNAME;
const RINGBA_PASSWORD = process.env.RINGBA_PASSWORD;
const RINGBA_API_TOKEN = process.env.RINGBA_API_TOKEN;

/** Shared filters: Paragon - Medicare, TV channel tag, exclude Elite publishers, non-duplicates. */
const PARAGON_TV_FILTERS = [
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
        column: "tag:User:channel",
        value: "TV",
        isNegativeMatch: false,
        comparisonType: "CONTAINS",
      },
    ],
  },
  {
    anyConditionToMatch: [
      {
        column: "publisherName",
        value: "Elite",
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
];

/** Call logs list columns (Ringba calllogs POST). */
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

/** Same `reportEnd` as {@link getReportWindowUTC}; `reportStart` moved back `(days - 1)` UTC-day steps (Ringba 04:00Z boundaries). */
function getMultiDayReportWindowUTC(days = 7) {
  const { reportStart, reportEnd } = getReportWindowUTC();
  const start = new Date(reportStart);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { reportStart: start.toISOString(), reportEnd };
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

/** POST body: Paragon - Medicare + TV channel, exclude publisher names containing Elite, group by dialed number (matches Ringba insights UI). */
function buildParagonTvDialedNumbersBody(days = 7) {
  const { reportStart, reportEnd } = getMultiDayReportWindowUTC(days);
  return {
    reportStart,
    reportEnd,
    groupByColumns: [{ column: "number", displayName: "Dialed #" }],
    valueColumns: VALUE_COLUMNS,
    orderByColumns: [{ column: "callCount", direction: "desc" }],
    formatTimespans: true,
    formatPercentages: true,
    generateRollups: true,
    maxResultsPerGroup: 1000,
    filters: [...PARAGON_TV_FILTERS],
    formatTimeZone: "America/New_York",
  };
}

/** Ringba often returns `{ report }` or `[{ report }]`. */
function extractReportRecords(responseData) {
  if (Array.isArray(responseData) && responseData.length > 0) {
    const first = responseData[0];
    return first?.report?.records ?? [];
  }
  return responseData?.report?.records ?? [];
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
  return extractReportRecords(response.data);
}

/** Latest call only (`size: 1`) — same filters as insights + dialed `number`. */
function buildParagonTvCalllogsBody(phoneNumber, reportStart, reportEnd) {
  return {
    reportStart,
    reportEnd,
    orderByColumns: [{ column: "callDt", direction: "desc" }],
    filters: [
      {
        anyConditionToMatch: [
          {
            column: "number",
            value: phoneNumber,
            isNegativeMatch: false,
            comparisonType: "EQUALS",
          },
        ],
      },
      ...PARAGON_TV_FILTERS,
    ],
    valueColumns: CALLLOGS_VALUE_COLUMNS,
    formatTimespans: true,
    formatPercentages: true,
    formatDateTime: true,
    formatTimeZone: "America/New_York",
    size: 1,
    offset: 0,
  };
}

async function postCalllogs(token, body) {
  const response = await axios.post(
    `${BASE_URL}/${RINGBA_ACCOUNT_ID}/calllogs`,
    body,
    {
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
    },
  );
  return extractReportRecords(response.data);
}

async function postCalllogsDetail(token, inboundCallIds) {
  const ids = (Array.isArray(inboundCallIds) ? inboundCallIds : [inboundCallIds]).filter(
    (id) => typeof id === "string" && id.length > 0,
  );
  if (ids.length === 0) return [];

  const response = await axios.post(
    `${BASE_URL}/${RINGBA_ACCOUNT_ID}/calllogs/detail`,
    {
      inboundCallIds: ids,
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
    },
  );
  return extractReportRecords(response.data);
}

function extractMessageTags(detailRecord) {
  if (!detailRecord || typeof detailRecord !== "object") return [];
  const direct =
    detailRecord["message-tags"] ??
    detailRecord.messageTags ??
    detailRecord.message_tags;
  if (Array.isArray(direct)) return direct;
  const events = detailRecord.events;
  if (Array.isArray(events)) {
    for (const ev of events) {
      if (!ev || typeof ev !== "object") continue;
      const nested =
        ev["message-tags"] ?? ev.messageTags ?? ev.message_tags;
      if (Array.isArray(nested)) return nested;
    }
  }
  return [];
}

/** Dialed-number tag names we require under `message-tags` (value ignored). */
function getMissingAngleOrChannelTagNames(messageTags) {
  const names = new Set(
    (messageTags || [])
      .map((t) => (t && typeof t.name === "string" ? t.name.toLowerCase() : null))
      .filter(Boolean),
  );
  const missing = [];
  if (!names.has("channel")) missing.push("CHANNEL");
  if (!names.has("angle")) missing.push("ANGLE");
  return missing;
}

function formatMissingTagsNotificationLine({
  campaignName,
  publisherName,
  phoneNumber,
  missingTagLabels,
}) {
  const missingText =
    missingTagLabels.length === 2
      ? "ANGLE and CHANNEL tags missing"
      : `${missingTagLabels[0]} tag missing`;
  return `${campaignName} | ${publisherName} | ${phoneNumber} - ${missingText}`;
}

function recordsToDialedNumbers(records) {
  if (!Array.isArray(records)) return [];
  const numbers = records
    .map((r) => r.number)
    .filter((n) => typeof n === "string" && n.length > 0);
  return [...new Set(numbers)];
}

/** Dialed numbers for Paragon - Medicare + TV (non-Elite publishers), for follow-up insights calls. */
export async function fetchParagonTvDialedNumbers(token, { days = 7 } = {}) {
  const records = await postInsights(token, buildParagonTvDialedNumbersBody(days));
  return recordsToDialedNumbers(records);
}

async function runReport() {
  const token = await getAuthToken();
  if (!token) {
    console.error("❌ Missing valid auth token. Exiting.");
    return;
  }

  const days = 7;
  const window = getMultiDayReportWindowUTC(days);
  const dialedNumbers = await fetchParagonTvDialedNumbers(token, { days });
  console.log("Paragon - Medicare / TV / non-Elite — dialed numbers:", dialedNumbers);
  console.log("Count:", dialedNumbers.length);
  console.log("Report window (calllogs + insights):", window.reportStart, "→", window.reportEnd);

  for (const phoneNumber of dialedNumbers) {
    try {
      const callRows = await postCalllogs(
        token,
        buildParagonTvCalllogsBody(phoneNumber, window.reportStart, window.reportEnd),
      );
      const first = callRows[0];
      if (!first?.inboundCallId) {
        console.log(`[${phoneNumber}] No call log row in window.`);
        continue;
      }

      const campaignName = first.campaignName ?? "";
      const publisherName = first.publisherName ?? "";
      const inboundCallId = first.inboundCallId;

      const detailRows = await postCalllogsDetail(token, [inboundCallId]);
      const detail = detailRows[0];
      const messageTags = extractMessageTags(detail);
      const missing = getMissingAngleOrChannelTagNames(messageTags);

      if (missing.length > 0) {
        const line = formatMissingTagsNotificationLine({
          campaignName,
          publisherName,
          phoneNumber,
          missingTagLabels: missing,
        });
        console.log("Would Slack:", line);
        console.log({
          phoneNumber,
          inboundCallId,
          campaignName,
          publisherName,
          missing,
          messageTags,
        });
      } else {
        console.log(
          `OK — ${campaignName} | ${publisherName} | ${phoneNumber} — channel + angle present (inboundCallId ${inboundCallId})`,
        );
      }
    } catch (err) {
      console.error(
        `[${phoneNumber}] calllogs/detail error:`,
        err.response?.data ?? err.message ?? err,
      );
    }
  }
}

runReport().catch((error) => {
  console.error("❌ publisherTvTags failed:", error.response?.data || error);
});
