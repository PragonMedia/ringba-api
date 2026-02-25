/**
 * Centralized scheduler — runs all API scripts on their configured cron schedules.
 * Start once: node scheduler.js (or pm2 start scheduler.js)
 */
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const cron = require("node-cron");

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = __dirname;

const schedules = (await import("./schedules.config.js")).default;

function runScript(entry) {
  const { script, args = [], description } = entry;
  const cmd = "node";
  const cmdArgs = [join(projectRoot, script), ...args];
  const label = description || script;

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (d) => {
      stdout += d;
      process.stdout.write(`[${label}] ${d}`);
    });
    child.stderr?.on("data", (d) => {
      stderr += d;
      process.stderr.write(`[${label}] ${d}`);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.error(`[${label}] exited with code ${code}`);
        reject(new Error(`${script} exited ${code}`));
      } else {
        resolve();
      }
    });

    child.on("error", (err) => {
      console.error(`[${label}] spawn error:`, err);
      reject(err);
    });
  });
}

function setupCron(entry) {
  const { script, schedule, description, timezone } = entry;
  const valid = cron.validate(schedule);
  if (!valid) {
    console.error(`Invalid cron for ${script}: ${schedule}`);
    return;
  }
  const opts = timezone ? { timezone } : {};
  cron.schedule(schedule, async () => {
    const label = description || script;
    console.log(`\n[${new Date().toISOString()}] Running: ${label}`);
    try {
      await runScript(entry);
      console.log(`[${label}] ✅ done`);
    } catch (err) {
      console.error(`[${label}] ❌ failed:`, err.message);
    }
  }, opts);
  console.log(`  ✓ ${script} — ${schedule} — ${description || "(no description)"}`);
}

console.log("Scheduler starting — schedules (server timezone):\n");
schedules.forEach(setupCron);
console.log("\nScheduler running. Press Ctrl+C to stop.\n");
