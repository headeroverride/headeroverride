import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const headless = args.includes("--headless");
const testArgs = args.filter((arg) => arg !== "--headless");

const result = spawnSync(
  process.execPath,
  [require.resolve("@playwright/test/cli"), "test", ...testArgs],
  {
    cwd: rootDir,
    env: { ...process.env, E2E_HEADLESS: headless ? "1" : "0" },
    stdio: "inherit"
  }
);

if (result.error) throw result.error;
if (result.signal) {
  process.kill(process.pid, result.signal);
  process.exit(1);
}
process.exit(result.status ?? 1);
