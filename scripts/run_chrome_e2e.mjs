import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Browser, detectBrowserPlatform, install, resolveBuildId } from "@puppeteer/browsers";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const [channel, ...testArgs] = process.argv.slice(2);

function runNode(args, env = process.env) {
  const result = spawnSync(process.execPath, args, { cwd: rootDir, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.signal) {
    process.kill(process.pid, result.signal);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

try {
  if (!["stable", "beta", "dev"].includes(channel)) {
    throw new Error("Usage: node scripts/run_chrome_e2e.mjs <stable|beta|dev> [Playwright test arguments]");
  }
  const platform = detectBrowserPlatform();
  if (!platform) throw new Error(`Unsupported browser platform: ${process.platform}/${process.arch}`);

  runNode([path.join(rootDir, "scripts/build_extension.mjs")]);

  console.log(`Resolving Chrome for Testing ${channel} (${platform})...`);
  const buildId = await resolveBuildId(Browser.CHROME, platform, channel);
  console.log(`Preparing Chrome for Testing ${channel} ${buildId} (cached downloads are reused)...`);
  const browser = await install({
    browser: Browser.CHROME,
    buildId,
    platform,
    cacheDir: path.join(rootDir, ".cache/browsers")
  });
  console.log(`Running E2E tests with Chrome for Testing ${channel} ${buildId}\n${browser.executablePath}`);
  runNode([require.resolve("@playwright/test/cli"), "test", ...testArgs], {
    ...process.env,
    E2E_BROWSER: "chromium",
    E2E_BROWSER_CHANNEL: "",
    E2E_BROWSER_EXECUTABLE: browser.executablePath
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
