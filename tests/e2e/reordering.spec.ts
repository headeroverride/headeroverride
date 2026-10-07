import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  launchExtension,
  readStoredRules,
  readSyncStatus,
  reloadExtensionPage,
  requestCookieRule,
  requestHeaderRule,
  responseCookieRule,
  responseHeaderRule,
  seedProfiles,
  seedRules,
  waitForAppliedRuleCount
} from "./fixtures/extension";

function section(page: Page, name: "Request" | "Response") {
  return page.locator(".rule-section").filter({
    has: page.getByRole("heading", { name, exact: true })
  });
}

async function ruleIds(target: Locator) {
  return target.locator(".rule").evaluateAll((rules) =>
    rules.map((rule) => rule.getAttribute("data-rule-id"))
  );
}

async function dragRule(source: Locator, target: Locator, targetY: "top" | "bottom") {
  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  await source.locator(".drag-handle").dragTo(target, {
    targetPosition: {
      x: Math.max(2, (targetBox?.width || 4) / 2),
      y: targetY === "top" ? 2 : Math.max(2, (targetBox?.height || 4) - 2)
    }
  });
}

test("reorders one section, persists it, and leaves other kinds and profiles in place", async () => {
  const extension = await launchExtension();

  try {
    await seedProfiles(extension.extensionPage, [
      {
        id: "profile-one",
        name: "Profile One",
        rules: [
          requestHeaderRule({ id: "request-one", header: "X-One" }),
          responseHeaderRule({ id: "response-one", header: "X-Response" }),
          requestHeaderRule({ id: "request-two", header: "X-Two" }),
          requestHeaderRule({ id: "request-three", header: "X-Three" })
        ]
      },
      {
        id: "profile-two",
        name: "Profile Two",
        rules: [requestHeaderRule({ id: "other-profile-rule", header: "X-Other" })]
      }
    ], "profile-one");
    await reloadExtensionPage(extension.extensionPage);

    const request = section(extension.extensionPage, "Request");
    const requestRules = request.locator(".rule");
    await dragRule(requestRules.nth(0), requestRules.nth(2), "bottom");

    await expect.poll(() => ruleIds(request)).toEqual([
      "request-two",
      "request-three",
      "request-one"
    ]);
    await expect.poll(async () => {
      const stored = await readStoredRules(extension.extensionPage);
      return stored.profiles.map((profile) => profile.rules.map((rule) => rule.id));
    }).toEqual([
      ["request-two", "response-one", "request-three", "request-one"],
      ["other-profile-rule"]
    ]);

    await reloadExtensionPage(extension.extensionPage);
    await expect.poll(() => ruleIds(section(extension.extensionPage, "Request"))).toEqual([
      "request-two",
      "request-three",
      "request-one"
    ]);
  } finally {
    await extension.close();
  }
});

test("locks only the sorted section and reorders cookie rules after sorting is cleared", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [
      requestCookieRule({ id: "request-cookie-a", name: "a_cookie" }),
      responseCookieRule({ id: "response-cookie", name: "response_cookie" }),
      requestCookieRule({ id: "request-cookie-b", name: "b_cookie" })
    ]);
    await reloadExtensionPage(extension.extensionPage);
    await extension.extensionPage.getByRole("button", { name: /Cookies/ }).click();

    const request = section(extension.extensionPage, "Request");
    const response = section(extension.extensionPage, "Response");
    const nameSort = request.getByRole("button", { name: /^Sort by Name;/ });
    await nameSort.click();

    await expect(request.locator(".drag-handle")).toHaveCount(2);
    await expect(request.locator(".drag-handle").first()).toBeHidden();
    await expect(request.locator(".drag-handle").first()).not.toHaveAttribute("title", /.+/);
    await expect(response.locator(".drag-handle")).toBeVisible();

    await nameSort.click();
    await nameSort.click();
    await expect(request.locator(".drag-handle").first()).toBeEnabled();

    const requestRules = request.locator(".rule");
    await dragRule(requestRules.nth(1), requestRules.nth(0), "top");
    await expect.poll(() => ruleIds(request)).toEqual([
      "request-cookie-b",
      "request-cookie-a"
    ]);
    await expect.poll(async () => {
      const stored = await readStoredRules(extension.extensionPage);
      return stored.profiles[0].rules.map((rule) => rule.id);
    }).toEqual(["request-cookie-b", "response-cookie", "request-cookie-a"]);
  } finally {
    await extension.close();
  }
});

test("same-position and cross-section drops do not write storage or resync rules", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [
      requestHeaderRule({ id: "request-one", header: "X-One" }),
      responseHeaderRule({ id: "response-one", header: "X-Response" }),
      requestHeaderRule({ id: "request-two", header: "X-Two" })
    ]);
    await reloadExtensionPage(extension.extensionPage);
    await waitForAppliedRuleCount(extension.extensionPage, 3);
    await extension.extensionPage.waitForTimeout(100);
    await extension.extensionPage.evaluate(() => {
      Reflect.set(globalThis, "__ruleStorageChangeCount", 0);
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes.headerOverrideRules) {
          const count = Number(Reflect.get(globalThis, "__ruleStorageChangeCount")) || 0;
          Reflect.set(globalThis, "__ruleStorageChangeCount", count + 1);
        }
      });
    });

    const initialRules = await readStoredRules(extension.extensionPage);
    const initialSync = await readSyncStatus(extension.extensionPage);
    const request = section(extension.extensionPage, "Request");
    const response = section(extension.extensionPage, "Response");
    const firstRequest = request.locator(".rule").first();

    await firstRequest.locator(".drag-handle").click();
    await dragRule(firstRequest, firstRequest, "bottom");
    await dragRule(firstRequest, response.locator(".rule").first(), "bottom");
    await extension.extensionPage.waitForTimeout(250);

    expect(await readStoredRules(extension.extensionPage)).toEqual(initialRules);
    expect(await readSyncStatus(extension.extensionPage)).toEqual(initialSync);
    expect(await extension.extensionPage.evaluate(() =>
      Reflect.get(globalThis, "__ruleStorageChangeCount")
    )).toBe(0);
  } finally {
    await extension.close();
  }
});
