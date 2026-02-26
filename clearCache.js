/**
 * Clears all alert/batch cache JSON files at 1am EST (run via scheduler).
 * Resets each file to empty default so scripts start fresh each day.
 */
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const today = getTodayEST();

const cacheFiles = [
  { path: resolve(__dirname, "targetNoAnswerAlertCache.json"), data: { [today]: {} } },
  { path: resolve(__dirname, "processedBatches.json"), data: { date: today, batches: [] } },
  { path: resolve(__dirname, "processedBatchesSameBid.json"), data: { date: today, batches: [] } },
  { path: resolve(__dirname, "processedBidBatches.json"), data: { date: today, batches: [] } },
  { path: resolve(__dirname, "alertCache.json"), data: { [today]: [] } },
  { path: resolve(__dirname, "api10Cache.json"), data: { [today]: [] } },
];

for (const { path: filePath, data } of cacheFiles) {
  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log("Cleared:", filePath);
  } catch (e) {
    console.error("Failed to clear", filePath, e.message);
  }
}

console.log("All caches cleared for", today, "(EST).");
