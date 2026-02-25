# Ringba API Scripts

Node.js scripts that pull data from Ringba APIs and send alerts to Slack.

## Setup

1. **Node.js** 18+
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Environment:** Copy `.env.example` to `.env` and set:
   - `RINGBA_ACCOUNT_ID`, `RINGBA_API_TOKEN`
   - `SLACK_WEBHOOK_URL`
   - (optional) `RINGBA_USERNAME`, `RINGBA_PASSWORD` for token auth

## Centralized Scheduler

One process runs all scripts on their own schedules. No more manually starting each script.

**Start the scheduler:**
```bash
npm start
# or
node scheduler.js
```

Schedules are defined in `schedules.config.js`. Each script has its own cron expression and optional timezone.

**On a server (PM2):**
```bash
pm2 start scheduler.js --name ringba-scheduler
pm2 save
pm2 startup   # optional: start on reboot
```

## Scripts

| Script | Purpose |
|--------|---------|
| `targetNoAnswer.js` | Alerts when targets have ≥20% no-answer (min 30 dialed). 9am–5pm EST, every 10 min. |
| `multiTags.js` | Multi-tags report |
| `pgnmNumberpool.js` | Number pool report |

**Run a single script manually:**
```bash
node targetNoAnswer.js pull
node multiTags.js
node pgnmNumberpool.js
```

## Adding New Scripts

1. Add your script file (e.g. `myNewScript.js`).
2. Edit `schedules.config.js`:

```js
{
  script: "myNewScript.js",
  schedule: "0 */2 * * *",        // every 2 hours
  timezone: "America/New_York",   // optional
  description: "My new report",
}
```

3. Restart the scheduler. No other changes needed.

## Docs

See **RINGBA-API-RESEARCH.md** for Ringba API notes.
