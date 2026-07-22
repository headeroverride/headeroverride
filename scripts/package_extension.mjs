import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VALID_TARGETS = new Set(["chrome", "edge", "firefox"]);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionDir = path.join(rootDir, "extension");
const distDir = path.join(rootDir, "dist");
const packageJson = JSON.parse(await fs.readFile(path.join(rootDir, "package.json"), "utf8"));

const requestedTarget = process.argv[2] || "chrome";
const targets = requestedTarget === "all" ? [...VALID_TARGETS] : [requestedTarget];

for (const target of targets) {
  if (!VALID_TARGETS.has(target)) {
    throw new Error(`Unknown target "${target}". Use chrome, edge, firefox, or all.`);
  }
}

await fs.mkdir(distDir, { recursive: true });

for (const target of targets) {
  const stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), `header-override-${target}-`));
  const outputPath = path.join(distDir, `header-override-${packageJson.version}-${target}.zip`);

  try {
    await fs.cp(path.join(extensionDir, "icons"), path.join(stagingDir, "icons"), { recursive: true });
    await fs.cp(path.join(extensionDir, "src"), path.join(stagingDir, "src"), { recursive: true });
    await fs.copyFile(path.join(extensionDir, `manifest.${target}.json`), path.join(stagingDir, "manifest.json"));

    const result = spawnSync(
      "zip",
      ["-qr", outputPath, "manifest.json", "icons", "src", "-x", "*.DS_Store", "-x", "__MACOSX/*"],
      { cwd: stagingDir, stdio: "inherit" }
    );

    if (result.status !== 0) {
      throw new Error(`zip failed for ${target} with exit code ${result.status}`);
    }

    console.log(`Created ${path.relative(rootDir, outputPath)}`);
  } finally {
    await fs.rm(stagingDir, { recursive: true, force: true });
  }
}
