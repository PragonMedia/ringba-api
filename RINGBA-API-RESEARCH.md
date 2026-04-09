# Ringba API Research – Pull Data & Slack Alerts

## 1. Ringba API Overview

- **Documentation:** https://developers.ringba.com/
- **Base URL:** `https://api.ringba.com/v2/`
- **Auth:** OAuth2-style token (password grant + refresh token). No API key; use Ringba account email + password.

---

## 2. Authentication

### Token endpoint

- **URL:** `POST https://api.ringba.com/v2/Token`
- **Content-Type:** `application/x-www-form-urlencoded`

**Login (password grant):**

| Field        | Value     |
|-------------|-----------|
| grant_type  | password  |
| username    | (Ringba account email) |
| password    | (Ringba account password) |

**Refresh token (when expired):**

| Field        | Value     |
|-------------|-----------|
| grant_type  | refresh_token |
| refresh_token | (from login response) |
| user_name   | (from login response) |

**Response (JSON):**

- `access_token` – use in `Authorization` header
- `token_type` – e.g. `"Bearer"`
- `refresh_token` – for refresh
- `userName` – needed for refresh
- `.issued` – token issue time
- `.expires` – token expiry time

**Authenticated requests:**  
`Authorization: {token_type} {access_token}`  
Example: `Authorization: Bearer <access_token>`

---

## 3. Insights Events (beta) – primary endpoint for this script

- **URL:** `GET https://api.ringba.com/v2/{accountId}/insights/events/beta`
- **Example:** `https://api.ringba.com/v2/RA417e311c6e8b47538624556e6e84298a/insights/events/beta`
- **Headers:** `Authorization: Bearer <access_token>`
- **Method:** Typically GET (POST with body if the API requires it; add query params as needed for date range, etc.).

Response shape is beta-specific; the script treats the payload as generic JSON and summarizes (e.g. array length or `data`/`events`/`result` arrays) for Slack.

---

## 4. Call Logs API (alternative data source)

- **URL:** `POST https://api.ringba.com/v2/{accountId}/CallLogs/Date`
- **Headers:** `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Body example:**

```json
{
  "dateRange": { "past": 0, "days": 1 },
  "callLog": {
    "page": 0,
    "pageSize": 1000,
    "sort": "dtStamp",
    "sortDirection": "desc"
  }
}
```

- `dateRange.past` – days in the past (0 = today).
- `dateRange.days` – number of days to include.
- `callLog.page` / `pageSize` – pagination (max page size in sample: 10000).

**Response shape:**  
Data is under `result.callLog.data[]`. Each item has:

- **Columns** – e.g. `inboundCallId`, `inboundPhoneNumber`, `number`, `callLengthInSeconds`, `callConnectionLength`, `dtStamp`.
- **Events** – e.g. answered, hangup; used to derive target number and “live” vs “completed”.
- **Tags** – e.g. caller region/state, campaign, publisher.

**Useful fields for alerts (from sample):**

- Caller ID / inbound: `columns.inboundPhoneNumber`
- Dialed number: `columns.number`
- Call length: `columns.callLengthInSeconds`
- Connected length: `columns.callConnectionLength`
- Call time: `columns.dtStamp` (Unix ms)
- State/region: from tags (e.g. `InboundNumber:Region`)
- Live vs completed: from events (e.g. `CompletedCall`, `EndCallSource`)

### Call logs rate limits (per user per account)

- 5 requests/minute  
- 20 requests/hour  
- 200 requests/day  

Respect these when polling; use backoff and caching if you hit limits.

---

## 5. Other endpoints (reference)

- **Get details about specific calls** – [developers.ringba.com](https://developers.ringba.com/) (exact path in docs): 200 requests/minute.
- **Get RTB Bid Log:** `GET /rtb/bid/{bid_id}` – 150 requests/minute.
- **General reporting:** 5 req/s or 80 req/min.

---

## 6. Webhooks (optional future use)

Ringba supports web services (webhooks) so you can get real-time call events (e.g. call completed, recording ready) POSTed to your URL. That could be used to trigger Slack alerts on events instead of (or in addition to) polling. Configuration is done in the Ringba UI / developer docs.

---

## 7. Slack integration (for alerts)

- **Incoming Webhooks:** Create an app at api.slack.com → Incoming Webhooks → “Add New Webhook to Workspace” and copy the webhook URL.
- **Node:** Use `@slack/webhook` and `IncomingWebhook` with that URL; call `webhook.send({ text: '...' })` (and optionally blocks for richer messages).
- **Security:** Keep the webhook URL in env (e.g. `SLACK_WEBHOOK_URL`), never in code or git.

---

## 8. Node.js script direction

1. **Env/config:** `RINGBA_USERNAME`, `RINGBA_PASSWORD`, `RINGBA_ACCOUNT_ID`, `SLACK_WEBHOOK_URL`.
2. **Auth:** POST to `https://api.ringba.com/v2/Token` with username/password; store `access_token` and `expires`; refresh when expired.
3. **Data:** POST to `https://api.ringba.com/v2/{accountId}/CallLogs/Date` with date range and pagination; respect 5/min (and hourly/daily) limits.
4. **Alerts:** Decide what to alert on (e.g. call volume threshold, short calls, errors). Format a message and send via Slack incoming webhook.
5. **Run:** Use a cron/scheduler or a loop with a delay (e.g. every 5–15 minutes) so you stay under rate limits.

Next step: implement the starter Node script (auth + call logs fetch + Slack alert) in this repo.
