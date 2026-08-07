import esbuild from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionDir = path.join(rootDir, "extension");
const sourceDir = path.join(extensionDir, "src");
const buildDir = path.join(extensionDir, "build");

await fs.rm(buildDir, { recursive: true, force: true });
await fs.mkdir(buildDir, { recursive: true });

await esbuild.build({
  entryPoints: {
    background: path.join(sourceDir, "background", "index.js"),
    popup: path.join(sourceDir, "popup", "index.js")
  },
  bundle: true,
  entryNames: "[name]",
  format: "iife",
  outdir: buildDir,
  platform: "browser",
  target: ["chrome109", "firefox115"],
  sourcemap: false
});

const popupHtml = await fs.readFile(path.join(sourceDir, "popup.html"), "utf8");
await Promise.all([
  fs.writeFile(path.join(buildDir, "popup.html"), popupHtml),
  fs.copyFile(path.join(sourceDir, "popup.css"), path.join(buildDir, "popup.css"))
]);

console.log("Built extension/build");
