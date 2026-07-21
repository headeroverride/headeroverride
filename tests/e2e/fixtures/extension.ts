import { expect, type BrowserContext, type Page, chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const STORAGE_KEY = "headerOverrideRules";
const SYNC_STATUS_KEY = "headerOverrideSyncStatus";
const DEFAULT_PROFILE_ID = "default";

export type RuleKind = "requestHeader" | "responseHeader" | "requestCookie" | "responseCookie";

export type OverrideRule = {
  id: string;
  kind: RuleKind;
  enabled: boolean;
  value: string;
  comment: string;
  urlFilter: string;
  header?: string;
  name?: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  sameSite?: string;
  session?: boolean;
  maxAge?: string;
};

export type OverrideProfile = {
  id: string;
  name: string;
  rules: OverrideRule[];
};

export type ExtensionHarness = {
  context: BrowserContext;
  extensionId: string;
  extensionPage: Page;
  close: () => Promise<void>;
};

export async function launchExtension(): Promise<ExtensionHarness> {
  if (process.env.E2E_BROWSER === "firefox") {
    throw new Error(
      "Firefox is installed, but this E2E harness loads the MV3 extension through Chromium's unpacked-extension flow. Use Chromium or msedge, or add a Firefox-specific WebExtension harness."
    );
  }

  const extensionPath = path.resolve(process.cwd(), "extension");
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "header-override-e2e-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    acceptDownloads: true,
    channel: process.env.E2E_BROWSER_CHANNEL || undefined,
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });
  const serviceWorker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  const extensionId = new URL(serviceWorker.url()).host;
  const extensionPage = await context.newPage();

  await extensionPage.goto(`chrome-extension://${extensionId}/src/popup.html`);

  return {
    context,
    extensionId,
    extensionPage,
    close: () => context.close()
  };
}

export async function seedRules(extensionPage: Page, rules: OverrideRule[]) {
  await extensionPage.evaluate(
    async ({ storageKey, syncStatusKey, data }) => {
      await chrome.storage.local.remove(syncStatusKey);
      await chrome.storage.local.set({ [storageKey]: data });
    },
    {
      storageKey: STORAGE_KEY,
      syncStatusKey: SYNC_STATUS_KEY,
      data: createStorageData(rules)
    }
  );
}

export async function seedProfiles(extensionPage: Page, profiles: OverrideProfile[], activeProfileId: string) {
  await extensionPage.evaluate(
    async ({ storageKey, syncStatusKey, data }) => {
      await chrome.storage.local.remove(syncStatusKey);
      await chrome.storage.local.set({ [storageKey]: data });
    },
    {
      storageKey: STORAGE_KEY,
      syncStatusKey: SYNC_STATUS_KEY,
      data: {
        schemaVersion: 2,
        activeProfileId,
        profiles
      }
    }
  );
}

export async function seedLegacyRules(extensionPage: Page, rules: OverrideRule[]) {
  await extensionPage.evaluate(
    async ({ storageKey, syncStatusKey, data }) => {
      await chrome.storage.local.remove(syncStatusKey);
      await chrome.storage.local.set({ [storageKey]: data });
    },
    {
      storageKey: STORAGE_KEY,
      syncStatusKey: SYNC_STATUS_KEY,
      data: rules
    }
  );
}

export async function readStoredRules(extensionPage: Page) {
  return extensionPage.evaluate(
    async (storageKey) => {
      const stored = await chrome.storage.local.get(storageKey);
      return stored[storageKey];
    },
    STORAGE_KEY
  );
}

export async function waitForAppliedRuleCount(extensionPage: Page, appliedCount: number) {
  await expect.poll(
    async () => extensionPage.evaluate(
      async (syncStatusKey) => {
        const stored = await chrome.storage.local.get(syncStatusKey);
        return stored[syncStatusKey]?.appliedCount;
      },
      SYNC_STATUS_KEY
    ),
    { timeout: 5000 }
  ).toBe(appliedCount);
}

export async function readSyncStatus(extensionPage: Page) {
  return extensionPage.evaluate(
    async (syncStatusKey) => {
      const stored = await chrome.storage.local.get(syncStatusKey);
      return stored[syncStatusKey];
    },
    SYNC_STATUS_KEY
  );
}

export function requestHeaderRule(overrides: Partial<OverrideRule> = {}): OverrideRule {
  return {
    id: "request-header-rule",
    kind: "requestHeader",
    enabled: true,
    header: "X-E2E-Request",
    value: "request-value",
    urlFilter: "|http*",
    comment: "",
    ...overrides
  };
}

export function responseHeaderRule(overrides: Partial<OverrideRule> = {}): OverrideRule {
  return {
    id: "response-header-rule",
    kind: "responseHeader",
    enabled: true,
    header: "X-E2E-Response",
    value: "response-value",
    urlFilter: "|http*",
    comment: "",
    ...overrides
  };
}

export function requestCookieRule(overrides: Partial<OverrideRule> = {}): OverrideRule {
  return {
    id: "request-cookie-rule",
    kind: "requestCookie",
    enabled: true,
    name: "e2e_request_cookie",
    value: "cookie-value",
    domain: "",
    path: "",
    secure: false,
    sameSite: "",
    session: true,
    maxAge: "",
    urlFilter: "|http*",
    comment: "",
    ...overrides
  };
}

export function responseCookieRule(overrides: Partial<OverrideRule> = {}): OverrideRule {
  return {
    id: "response-cookie-rule",
    kind: "responseCookie",
    enabled: true,
    name: "e2e_response_cookie",
    value: "response-cookie-value",
    domain: "",
    path: "/",
    secure: false,
    sameSite: "lax",
    session: true,
    maxAge: "2592000",
    urlFilter: "|http*",
    comment: "",
    ...overrides
  };
}

function createStorageData(rules: OverrideRule[]) {
  return {
    schemaVersion: 2,
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [
      {
        id: DEFAULT_PROFILE_ID,
        name: "Default",
        rules
      }
    ]
  };
}
