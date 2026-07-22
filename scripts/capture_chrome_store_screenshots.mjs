import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const extensionDir = path.join(rootDir, "extension");
const outputDir = path.resolve(process.argv[2] || path.join(rootDir, "assets", "generated"));
const storageKey = "headerOverrideRules";
const popupStateKey = "headerOverridePopupState";

const profiles = [
  {
    id: "dev",
    name: "Development",
    rules: [
      {
        id: "request-auth",
        kind: "requestHeader",
        enabled: true,
        header: "X-Debug-User",
        value: "qa-admin",
        urlFilter: "|https*api.local.test/",
        comment: "Local API identity"
      },
      {
        id: "request-trace",
        kind: "requestHeader",
        enabled: true,
        header: "X-Trace-Mode",
        value: "verbose",
        urlFilter: "|https*staging.example.com/",
        comment: "Trace staging calls"
      },
      {
        id: "response-cors",
        kind: "responseHeader",
        enabled: true,
        header: "X-Preview-CORS",
        value: "https://app.local.test",
        urlFilter: "|https*api.local.test/",
        comment: "CORS debug"
      },
      {
        id: "request-session-cookie",
        kind: "requestCookie",
        enabled: true,
        name: "preview_session",
        value: "enabled",
        urlFilter: "|https*preview.example.com/",
        comment: "Preview gate"
      },
      {
        id: "response-flags-cookie",
        kind: "responseCookie",
        enabled: true,
        name: "feature_flags",
        value: "new-checkout",
        domain: ".example.com",
        path: "/",
        secure: true,
        sameSite: "lax",
        session: false,
        maxAge: "2592000",
        urlFilter: "|https*app.example.com/",
        comment: "Checkout beta"
      }
    ]
  },
  {
    id: "qa",
    name: "QA Staging",
    rules: [
      {
        id: "qa-header",
        kind: "requestHeader",
        enabled: true,
        header: "X-QA-Run",
        value: "store-screenshots",
        urlFilter: "*://staging.example.com/*",
        comment: "Screenshot profile"
      }
    ]
  },
  {
    id: "readonly",
    name: "Read-only demos",
    rules: []
  }
];

const storageData = {
  schemaVersion: 2,
  activeProfileId: "dev",
  profiles
};

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "header-override-store-"));
  const captureDir = await fs.mkdtemp(path.join(os.tmpdir(), "header-override-captures-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    acceptDownloads: false,
    headless: false,
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
      "--window-size=1280,800"
    ]
  });

  try {
    const extensionId = await getExtensionId(context);
    const popupPage = await context.newPage();
    await popupPage.setViewportSize({ width: 760, height: 520 });
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup.html`);
    await seedPopup(popupPage, "headers");

    await popupPage.screenshot({
      path: path.join(captureDir, "popup-headers.png"),
      animations: "disabled"
    });

    await popupPage.getByRole("button", { name: /Cookies/ }).click();
    await popupPage.getByRole("button", { name: "Edit" }).last().click();
    await popupPage.screenshot({
      path: path.join(captureDir, "popup-cookies.png"),
      animations: "disabled"
    });

    await popupPage.getByRole("button", { name: /Headers/ }).click();
    await popupPage.getByRole("button", { name: "URL filter syntax examples" }).first().click();
    await popupPage.screenshot({
      path: path.join(captureDir, "popup-url-filter-help.png"),
      animations: "disabled"
    });

    await popupPage.keyboard.press("Escape");
    await popupPage.getByRole("button", { name: "Profiles" }).click();
    await popupPage.screenshot({
      path: path.join(captureDir, "popup-profiles.png"),
      animations: "disabled"
    });

    await renderProfileDropdownZoom(context, captureDir);
    await renderFeatureScreenshots(context, captureDir);
    await renderMarqueePromoTile(context, captureDir);
  } finally {
    await context.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
    await fs.rm(captureDir, { recursive: true, force: true });
  }
}

async function getExtensionId(context) {
  const serviceWorker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  return new URL(serviceWorker.url()).host;
}

async function seedPopup(page, activeTab) {
  await page.evaluate(
    async ({ storageKeyValue, popupStateKeyValue, data, tab }) => {
      await chrome.storage.local.set({
        [storageKeyValue]: data,
        [popupStateKeyValue]: { activeTab: tab }
      });
    },
    {
      storageKeyValue: storageKey,
      popupStateKeyValue: popupStateKey,
      data: storageData,
      tab: activeTab
    }
  );
  await page.reload({ waitUntil: "load" });
}

async function renderFeatureScreenshots(context, captureDir) {
  const features = [
    {
      slug: "headers",
      capture: "popup-headers.png",
      title: "Headers for every local workflow",
      body: "Add request and response headers with URL-scoped rules, comments, and quick enable toggles.",
      accent: "Request + response"
    },
    {
      slug: "cookies",
      capture: "popup-cookies.png",
      title: "Cookie overrides without server changes",
      body: "Append request cookies or inject Set-Cookie responses with Domain, Path, SameSite, lifetime, and Secure controls.",
      accent: "Cookie controls"
    },
    {
      slug: "url-filters",
      capture: "popup-url-filter-help.png",
      title: "Precise URL matching",
      body: "Use simple wildcard and anchored filters to keep every override limited to the pages and APIs you intend.",
      accent: "URL filters"
    },
    {
      slug: "profiles",
      capture: "popup-profiles.png",
      title: "Profiles for development, QA, and demos",
      body: "Group rule sets, switch the active profile, and import or export configurations for repeatable testing.",
      accent: "Profiles"
    }
  ];

  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  for (const feature of features) {
    const imageData = await fs.readFile(path.join(captureDir, feature.capture), "base64");
    const iconData = await fs.readFile(path.join(extensionDir, "icons", "icon-32.png"), "base64");
    await page.setContent(featureScreenshotHtml({ ...feature, imageData, iconData }), { waitUntil: "load" });
    await page.screenshot({
      path: path.join(outputDir, `feature-${feature.slug}-1280x800.png`),
      animations: "disabled"
    });
  }

  await page.close();
}

async function renderProfileDropdownZoom(context, captureDir) {
  const page = await context.newPage();
  const imageData = await fs.readFile(path.join(captureDir, "popup-profiles.png"), "base64");

  await page.setViewportSize({ width: 960, height: 540 });
  await page.setContent(profileDropdownZoomHtml({ imageData }), { waitUntil: "load" });
  await page.screenshot({
    path: path.join(outputDir, "profile-dropdown-zoom.png"),
    animations: "disabled"
  });
  await page.close();
}

async function renderMarqueePromoTile(context, captureDir) {
  const page = await context.newPage();
  const imageData = await fs.readFile(path.join(captureDir, "popup-headers.png"), "base64");
  const iconData = await fs.readFile(path.join(extensionDir, "icons", "icon-128.png"), "base64");

  await page.setViewportSize({ width: 1400, height: 560 });
  await page.setContent(marqueePromoTileHtml({ imageData, iconData }), { waitUntil: "load" });
  await page.screenshot({
    path: path.join(outputDir, "marquee-1400x560.png"),
    animations: "disabled",
    omitBackground: false
  });
  await page.close();
}

function marqueePromoTileHtml({ imageData, iconData }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      :root {
        color-scheme: light;
        --ink: #172033;
        --muted: #647187;
        --line: #d6deea;
        --accent: #0b7a75;
      }

      * { box-sizing: border-box; }

      html,
      body {
        margin: 0;
        width: 1400px;
        height: 560px;
        overflow: hidden;
        color: var(--ink);
        background: #f6f9fc;
        font: 16px/1.42 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      main {
        position: relative;
        width: 100%;
        height: 100%;
        background:
          radial-gradient(circle at 86% 16%, rgba(11, 122, 117, 0.13), transparent 27%),
          linear-gradient(180deg, #ffffff 0%, #f4f7fb 100%);
      }

      .copy {
        position: absolute;
        left: 88px;
        top: 94px;
        width: 465px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 18px;
        margin-bottom: 30px;
      }

      .brand img {
        width: 72px;
        height: 72px;
        border-radius: 16px;
        box-shadow: 0 14px 34px rgba(11, 122, 117, 0.2);
      }

      .brand span {
        font-size: 46px;
        font-weight: 800;
        line-height: 1;
      }

      h1 {
        margin: 0 0 18px;
        font-size: 34px;
        line-height: 1.08;
        letter-spacing: 0;
      }

      p {
        margin: 0 0 24px;
        color: var(--muted);
        font-size: 20px;
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        padding: 6px 11px;
        border-radius: 999px;
        color: #075f5b;
        background: rgba(11, 122, 117, 0.1);
        font-size: 13px;
        font-weight: 800;
      }

      .browser {
        position: absolute;
        right: 76px;
        top: 54px;
        width: 720px;
        height: 452px;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 24px 60px rgba(20, 32, 50, 0.15);
      }

      .chrome {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 44px;
        padding: 8px 12px;
        border-bottom: 1px solid var(--line);
      }

      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }

      .dot.red { background: #ff5f57; }
      .dot.yellow { background: #ffbd2e; }
      .dot.green { background: #28c840; }

      .address {
        display: flex;
        align-items: center;
        min-width: 0;
        height: 28px;
        flex: 1;
        margin-left: 7px;
        padding: 0 10px;
        border: 1px solid var(--line);
        border-radius: 999px;
        color: var(--muted);
        background: #f8fafc;
        font-size: 12px;
      }

      .toolbar-icon {
        position: relative;
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border: 1px solid rgba(11, 122, 117, 0.24);
        border-radius: 999px;
        background: rgba(11, 122, 117, 0.08);
      }

      .toolbar-icon img {
        width: 18px;
        height: 18px;
      }

      .toolbar-badge {
        position: absolute;
        right: -5px;
        bottom: -4px;
        display: grid;
        place-items: center;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        border: 2px solid #ffffff;
        border-radius: 999px;
        color: #ffffff;
        background: var(--accent);
        font-size: 10px;
        font-weight: 800;
        line-height: 1;
      }

      .popup {
        position: absolute;
        right: 14px;
        top: 44px;
        width: 640px;
        height: 438px;
        overflow: hidden;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: #f7f8fb;
        box-shadow: 0 20px 54px rgba(15, 23, 42, 0.2);
      }

      .popup img {
        display: block;
        width: 640px;
        height: auto;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="copy">
        <div class="brand">
          <img src="data:image/png;base64,${iconData}" alt="">
          <span>Header Override</span>
        </div>
        <h1>Modify request headers, response headers, and cookies locally.</h1>
        <p>Create URL-scoped rules, switch custom profiles, and see active overrides at a glance.</p>
        <div class="chips">
          <span class="chip">Request headers</span>
          <span class="chip">Response headers</span>
          <span class="chip">Cookies</span>
          <span class="chip">Profiles</span>
        </div>
      </section>
      <section class="browser" aria-label="Browser with Header Override popup">
        <div class="chrome">
          <span class="dot red"></span>
          <span class="dot yellow"></span>
          <span class="dot green"></span>
          <div class="address">https://app.local.test/debug-session</div>
          <div class="toolbar-icon">
            <img src="data:image/png;base64,${iconData}" alt="">
            <span class="toolbar-badge">5</span>
          </div>
        </div>
        <div class="popup">
          <img src="data:image/png;base64,${imageData}" alt="">
        </div>
      </section>
    </main>
  </body>
</html>`;
}

function profileDropdownZoomHtml({ imageData }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      * { box-sizing: border-box; }

      html,
      body {
        margin: 0;
        width: 960px;
        height: 540px;
        overflow: hidden;
        background: #ffffff;
      }

      main {
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;
        background:
          radial-gradient(circle at 76% 17%, rgba(11, 122, 117, 0.08), transparent 31%),
          #ffffff;
      }

      .zoom-frame {
        width: 800px;
        height: 450px;
        overflow: hidden;
        border: 1px solid #d8e0ea;
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 24px 54px rgba(24, 34, 48, 0.12);
      }

      img {
        display: block;
        width: 760px;
        height: 520px;
        transform: scale(1.78);
        transform-origin: 91% 12%;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="zoom-frame">
        <img src="data:image/png;base64,${imageData}" alt="">
      </div>
    </main>
  </body>
</html>`;
}

function featureScreenshotHtml({ title, body, accent, imageData, iconData }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f8fb;
        --ink: #172033;
        --muted: #627086;
        --line: #d7dee9;
        --accent: #0b7a75;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        width: 1280px;
        height: 800px;
        overflow: hidden;
        color: var(--ink);
        background:
          radial-gradient(circle at 88% 16%, rgba(11, 122, 117, 0.11), transparent 27%),
          linear-gradient(180deg, #ffffff 0%, var(--bg) 100%);
        font: 16px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      main {
        position: relative;
        width: 100%;
        height: 100%;
      }

      .copy {
        position: absolute;
        left: 54px;
        top: 124px;
        width: 190px;
        min-width: 0;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        min-height: 30px;
        margin-bottom: 18px;
        padding: 4px 10px;
        border-radius: 999px;
        color: #075f5b;
        background: rgba(11, 122, 117, 0.1);
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
      }

      h1 {
        margin: 0 0 18px;
        font-size: 27px;
        line-height: 1.05;
        letter-spacing: 0;
      }

      p {
        margin: 0;
        color: var(--muted);
        font-size: 14px;
      }

      .browser {
        position: absolute;
        inset: 44px 42px 42px;
        border: 1px solid var(--line);
        border-radius: 8px;
        overflow: hidden;
        background: #fff;
        box-shadow: 0 22px 60px rgba(20, 32, 50, 0.13);
      }

      .chrome {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 58px;
        padding: 10px 16px;
        border-bottom: 1px solid var(--line);
        background: #fff;
      }

      .dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
      }

      .dot.red { background: #ff5f57; }
      .dot.yellow { background: #ffbd2e; }
      .dot.green { background: #28c840; }

      .address {
        display: flex;
        align-items: center;
        min-width: 0;
        height: 34px;
        flex: 1;
        margin-left: 8px;
        padding: 0 13px;
        border: 1px solid var(--line);
        border-radius: 999px;
        color: var(--muted);
        background: #f8fafc;
        font-size: 13px;
      }

      .toolbar-icon {
        position: relative;
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border: 1px solid rgba(11, 122, 117, 0.24);
        border-radius: 999px;
        background: rgba(11, 122, 117, 0.08);
      }

      .toolbar-icon img {
        width: 20px;
        height: 20px;
      }

      .toolbar-badge {
        position: absolute;
        right: -3px;
        bottom: -2px;
        display: grid;
        place-items: center;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        border: 2px solid #ffffff;
        border-radius: 999px;
        color: #ffffff;
        background: #0b7a75;
        font-size: 10px;
        font-weight: 800;
        line-height: 1;
      }

      .page {
        height: calc(100% - 58px);
        padding: 90px 48px;
        background:
          linear-gradient(90deg, rgba(255, 255, 255, 0.94) 0 34%, rgba(255, 255, 255, 0.5) 50%, rgba(255, 255, 255, 0) 100%),
          linear-gradient(180deg, #ffffff 0%, #f3f6fa 100%);
      }

      .popup-anchor {
        position: absolute;
        top: 74px;
        right: 24px;
        width: 900px;
        height: 636px;
        overflow: hidden;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: #f7f8fb;
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.24);
      }

      .popup-anchor::before {
        position: absolute;
        z-index: 2;
        top: -8px;
        right: 17px;
        width: 16px;
        height: 16px;
        border-top: 1px solid #cbd5e1;
        border-left: 1px solid #cbd5e1;
        background: #f7f8fb;
        transform: rotate(45deg);
        content: "";
      }

      .popup-anchor img {
        display: block;
        width: 900px;
        height: 636px;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="browser" aria-label="Browser with Header Override popup">
        <div class="chrome">
          <span class="dot red"></span>
          <span class="dot yellow"></span>
          <span class="dot green"></span>
          <div class="address">https://app.local.test/debug-session</div>
          <div class="toolbar-icon">
            <img src="data:image/png;base64,${iconData}" alt="">
            <span class="toolbar-badge">5</span>
          </div>
        </div>
        <div class="page"></div>
        <div class="popup-anchor">
          <img src="data:image/png;base64,${imageData}" alt="">
        </div>
      </section>
      <div class="copy">
        <div class="eyebrow">${escapeHtml(accent)}</div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(body)}</p>
      </div>
    </main>
  </body>
</html>`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
