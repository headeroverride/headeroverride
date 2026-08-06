import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  launchExtension,
  readStoredRules,
  readSyncStatus,
  requestCookieRule,
  requestHeaderRule,
  responseCookieRule,
  responseHeaderRule,
  seedLegacyRules,
  seedProfiles,
  seedRules,
  seedStorageData,
  waitForAppliedRuleCount
} from "./fixtures/extension";
import { startTestServer, type TestServer } from "./fixtures/test-server";

let server: TestServer;

test.beforeAll(async () => {
  server = await startTestServer();
});

test.afterAll(async () => {
  await server?.close();
});

test("applies configured request header overrides to matching requests", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [requestHeaderRule()]);
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    const page = await extension.context.newPage();
    await page.goto(server.origin);

    const echo = await page.evaluate(async () => {
      const response = await fetch("/echo");
      return response.json();
    });

    expect(echo.headers["x-e2e-request"]).toBe("request-value");
  } finally {
    await extension.close();
  }
});

test("applies configured response header overrides to browser-visible responses", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [responseHeaderRule()]);
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    const page = await extension.context.newPage();
    await page.goto(server.origin);

    const headerValue = await page.evaluate(async () => {
      const response = await fetch("/empty");
      return response.headers.get("x-e2e-response");
    });

    expect(headerValue).toBe("response-value");
  } finally {
    await extension.close();
  }
});

test("overrides an existing response header returned by the server", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, []);
    await waitForAppliedRuleCount(extension.extensionPage, 0);

    const page = await extension.context.newPage();
    await page.goto(server.origin);

    const serverHeaderValue = await page.evaluate(async () => {
      const response = await fetch("/delete-target");
      return response.headers.get("x-e2e-delete-target");
    });
    expect(serverHeaderValue).toBe("server-value");

    await seedRules(extension.extensionPage, [responseHeaderRule({
      header: "X-E2E-Delete-Target",
      value: "overridden-value"
    })]);
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    const overriddenHeaderValue = await page.evaluate(async () => {
      const response = await fetch("/delete-target");
      return response.headers.get("x-e2e-delete-target");
    });
    expect(overriddenHeaderValue).toBe("overridden-value");
  } finally {
    await extension.close();
  }
});

test("appends configured request cookies to outgoing requests", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [requestCookieRule()]);
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    const page = await extension.context.newPage();
    await page.goto(server.origin);

    const echo = await page.evaluate(async () => {
      const response = await fetch("/echo");
      return response.json();
    });

    expect(echo.headers.cookie).toContain("e2e_request_cookie=cookie-value");
  } finally {
    await extension.close();
  }
});

test("appends configured response cookies and stores them in the browser", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [responseCookieRule()]);
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    const page = await extension.context.newPage();
    await page.goto(server.origin);
    await page.evaluate(async () => {
      await fetch("/empty");
    });

    const cookies = await extension.context.cookies(server.origin);
    const cookie = cookies.find((item) => item.name === "e2e_response_cookie");

    expect(cookie?.value).toBe("response-cookie-value");
    expect(cookie?.sameSite).toBe("Lax");
  } finally {
    await extension.close();
  }
});

test("cycles compact response operations without adding a rule-list column", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [responseHeaderRule()]);
    await extension.extensionPage.reload();

    const headerOperation = extension.extensionPage.locator(".response-header-rule .operation-toggle");
    await expect(headerOperation).toHaveAttribute("aria-label", "Response header operation: Set");
    await headerOperation.click();
    await expect(headerOperation).toHaveAttribute("aria-label", "Response header operation: Remove");
    await expect(extension.extensionPage.locator(".response-header-rule .value")).toBeHidden();

    const storedHeaderRules = await readStoredRules(extension.extensionPage);
    expect(storedHeaderRules.profiles[0].rules[0].operation).toBe("remove");

    await extension.extensionPage.getByRole("button", { name: /Cookies/ }).click();
    await extension.extensionPage.getByRole("button", { name: "Add response cookie rule", exact: true }).click();
    const cookieOperation = extension.extensionPage.locator(".response-cookie-rule .operation-toggle");
    await expect(cookieOperation).toHaveAttribute("aria-label", "Response cookie operation: Add");
    await cookieOperation.click();
    await expect(cookieOperation).toHaveAttribute("aria-label", "Response cookie operation: Delete");
    await expect(extension.extensionPage.locator(".response-cookie-rule .value")).toBeHidden();
    await expect(extension.extensionPage.locator(".response-cookie-rule .path")).toBeVisible();
    await expect(extension.extensionPage.locator(".response-cookie-rule .domain")).toBeVisible();
    await expect(extension.extensionPage.locator(".response-cookie-rule .same-site")).toBeHidden();
    await expect(extension.extensionPage.locator(".response-cookie-rule .session")).toBeHidden();
    await expect(extension.extensionPage.locator(".response-cookie-rule .max-age")).toBeHidden();
    await expect(extension.extensionPage.locator(".response-cookie-rule .secure")).toBeHidden();
  } finally {
    await extension.close();
  }
});

test("supports operations on request header rules", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [requestHeaderRule()]);
    await extension.extensionPage.reload();

    const operation = extension.extensionPage.locator(".request-header-rule .operation-toggle");
    await expect(operation).toHaveAttribute("aria-label", "Request header operation: Set");
    await operation.click();
    await expect(operation).toHaveAttribute("aria-label", "Request header operation: Remove");
    await expect(extension.extensionPage.locator(".request-header-rule .value")).toBeHidden();
    await expect(extension.extensionPage.locator(".request-header-rule .header")).toHaveValue("X-E2E-Request");

    const stored = await readStoredRules(extension.extensionPage);
    expect(stored.profiles[0].rules[0].operation).toBe("remove");
  } finally {
    await extension.close();
  }
});

test("toggles rules when clicking empty space in the On column", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [
      requestHeaderRule({ id: "column-toggle-header" }),
      requestCookieRule({ id: "column-toggle-cookie" })
    ]);
    await extension.extensionPage.reload();

    const headerRow = extension.extensionPage.locator(".request-header-rule .header-rule-main");
    await headerRow.click({ position: { x: 25, y: 15 } });
    await expect(headerRow.locator(".enabled")).not.toBeChecked();

    let stored = await readStoredRules(extension.extensionPage);
    expect(stored.profiles[0].rules.find((rule) => rule.id === "column-toggle-header").enabled)
      .toBe(false);

    await extension.extensionPage.getByRole("button", { name: /Cookies/ }).click();
    const cookieRow = extension.extensionPage.locator(".request-cookie-rule .cookie-primary");
    await cookieRow.click({ position: { x: 25, y: 15 } });
    await expect(cookieRow.locator(".enabled")).not.toBeChecked();

    stored = await readStoredRules(extension.extensionPage);
    expect(stored.profiles[0].rules.find((rule) => rule.id === "column-toggle-cookie").enabled)
      .toBe(false);
  } finally {
    await extension.close();
  }
});

test("keeps tab counters and applied badge counts in sync with enabled rules", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [
      requestHeaderRule({ id: "counter-request-header-set", operation: "set" }),
      requestHeaderRule({ id: "counter-request-header-remove", operation: "remove", header: "X-E2E-Request-Remove" }),
      responseHeaderRule({ id: "counter-response-header-set", operation: "set" }),
      responseHeaderRule({ id: "counter-response-header-remove", operation: "remove", header: "X-E2E-Response-Remove" }),
      requestCookieRule({ id: "counter-request-cookie-add", operation: "add" }),
      responseCookieRule({ id: "counter-response-cookie-add", operation: "add" }),
      responseCookieRule({ id: "counter-response-cookie-delete", operation: "delete", name: "e2e_response_cookie_delete" }),
      requestHeaderRule({ id: "counter-disabled-header", enabled: false }),
      requestHeaderRule({ id: "counter-invalid-header", header: "Invalid Header Name" }),
      requestHeaderRule({ id: "counter-incomplete-request-header", header: "" }),
      responseHeaderRule({ id: "counter-incomplete-response-header", header: "" }),
      requestCookieRule({ id: "counter-incomplete-request-cookie", name: "" }),
      responseCookieRule({ id: "counter-incomplete-response-cookie", name: "" })
    ]);
    await extension.extensionPage.reload();
    await waitForAppliedRuleCount(extension.extensionPage, 7);

    await expect(extension.extensionPage.getByRole("button", { name: /Headers\s+4/ })).toBeVisible();
    await expect(extension.extensionPage.getByRole("button", { name: /Cookies\s+3/ })).toBeVisible();
    await expect.poll(async () => extension.extensionPage.evaluate(() => chrome.action.getBadgeText({}))).toBe("7");

    await extension.extensionPage.locator(".request-header-rule .enabled").first().uncheck();

    await expect(extension.extensionPage.getByRole("button", { name: /Headers\s+3/ })).toBeVisible();
    await expect.poll(async () => extension.extensionPage.evaluate(() => chrome.action.getBadgeText({}))).toBe("6");
  } finally {
    await extension.close();
  }
});

test("pauses and resumes all rules with the master toggle", async () => {
  const extension = await launchExtension();

  try {
    await seedProfiles(
      extension.extensionPage,
      [
        {
          id: "master-toggle-profile-one",
          name: "Profile One",
          rules: [
            requestHeaderRule({ id: "master-toggle-request-rule" }),
            responseHeaderRule({ id: "master-toggle-response-rule" })
          ]
        },
        {
          id: "master-toggle-profile-two",
          name: "Profile Two",
          rules: [requestHeaderRule({ id: "master-toggle-other-profile-rule" })]
        }
      ],
      "master-toggle-profile-one"
    );
    await extension.extensionPage.reload();
    await waitForAppliedRuleCount(extension.extensionPage, 2);

    const page = await extension.context.newPage();
    await page.goto(server.origin);
    const initiallyEnabledEcho = await page.evaluate(async () => (await fetch("/echo")).json());
    const initiallyEnabledResponseHeader = await page.evaluate(async () =>
      (await fetch("/empty")).headers.get("x-e2e-response")
    );
    expect(initiallyEnabledEcho.headers["x-e2e-request"]).toBe("request-value");
    expect(initiallyEnabledResponseHeader).toBe("response-value");

    const toggle = extension.extensionPage.locator("#global-rules-toggle");
    await expect(toggle).toBeChecked();
    await toggle.uncheck();

    await expect(toggle).not.toBeChecked();
    await expect(toggle).toHaveAttribute("aria-label", "All rules paused");
    await expect(extension.extensionPage.locator(".header-rule .enabled")).toHaveCount(2);
    await expect(extension.extensionPage.locator(".header-rule .enabled").nth(0)).not.toBeChecked();
    await expect(extension.extensionPage.locator(".header-rule .enabled").nth(1)).not.toBeChecked();
    await expect(extension.extensionPage.locator(".profile-current-badge"))
      .toHaveClass(/is-paused/);
    await expect(extension.extensionPage.locator(".profile-current-badge")).toHaveText("Inactive");
    await expect.poll(async () => {
      const stored = await readStoredRules(extension.extensionPage);
      return {
        rulesEnabled: stored.rulesEnabled,
        enabledStates: stored.profiles.flatMap((profile) => profile.rules.map((rule) => rule.enabled))
      };
    }).toEqual({ rulesEnabled: false, enabledStates: [false, false, false] });
    await waitForAppliedRuleCount(extension.extensionPage, 0);
    await expect.poll(async () => extension.extensionPage.evaluate(() => chrome.action.getBadgeText({}))).toBe("");

    const pausedEcho = await page.evaluate(async () => (await fetch("/echo")).json());
    const pausedResponseHeader = await page.evaluate(async () =>
      (await fetch("/empty")).headers.get("x-e2e-response")
    );
    expect(pausedEcho.headers["x-e2e-request"]).toBeUndefined();
    expect(pausedResponseHeader).toBeNull();

    await toggle.check();

    await expect(toggle).toBeChecked();
    await expect(toggle).toHaveAttribute("aria-label", "All rules enabled");
    await expect(extension.extensionPage.locator(".profile-current-badge"))
      .not.toHaveClass(/is-paused/);
    await expect.poll(async () => {
      const stored = await readStoredRules(extension.extensionPage);
      return {
        rulesEnabled: stored.rulesEnabled,
        enabledStates: stored.profiles.flatMap((profile) => profile.rules.map((rule) => rule.enabled))
      };
    }).toEqual({ rulesEnabled: true, enabledStates: [true, true, true] });
    await waitForAppliedRuleCount(extension.extensionPage, 2);
    await expect.poll(async () => extension.extensionPage.evaluate(() => chrome.action.getBadgeText({}))).toBe("2");

    const resumedEcho = await page.evaluate(async () => (await fetch("/echo")).json());
    const resumedResponseHeader = await page.evaluate(async () =>
      (await fetch("/empty")).headers.get("x-e2e-response")
    );
    expect(resumedEcho.headers["x-e2e-request"]).toBe("request-value");
    expect(resumedResponseHeader).toBe("response-value");
  } finally {
    await extension.close();
  }
});

test("stops and restores request and response header/cookie rules with the master toggle", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [
      requestHeaderRule({
        id: "master-network-request-header",
        header: "X-E2E-Master-Request",
        value: "request-enabled"
      }),
      responseHeaderRule({
        id: "master-network-response-header",
        header: "X-E2E-Master-Response",
        value: "response-enabled"
      }),
      requestCookieRule({
        id: "master-network-request-cookie",
        name: "e2e_master_request_cookie",
        value: "request-cookie-enabled"
      }),
      responseCookieRule({
        id: "master-network-response-cookie",
        name: "e2e_master_response_cookie",
        value: "response-cookie-enabled"
      })
    ]);
    await extension.extensionPage.reload();
    await waitForAppliedRuleCount(extension.extensionPage, 4);

    const page = await extension.context.newPage();
    await page.goto(server.origin);

    const enabledEcho = await page.evaluate(async () => {
      const response = await fetch("/echo");
      return response.json();
    });
    const enabledResponseHeader = await page.evaluate(async () => {
      const response = await fetch("/empty");
      return response.headers.get("x-e2e-master-response");
    });
    const enabledCookies = await extension.context.cookies(server.origin);

    expect(enabledEcho.headers["x-e2e-master-request"]).toBe("request-enabled");
    expect(enabledEcho.headers.cookie).toContain("e2e_master_request_cookie=request-cookie-enabled");
    expect(enabledResponseHeader).toBe("response-enabled");
    expect(enabledCookies.find((cookie) => cookie.name === "e2e_master_response_cookie")?.value)
      .toBe("response-cookie-enabled");

    await extension.context.clearCookies();
    await extension.extensionPage.locator("#global-rules-toggle").uncheck();
    await waitForAppliedRuleCount(extension.extensionPage, 0);

    const disabledEcho = await page.evaluate(async () => {
      const response = await fetch("/echo");
      return response.json();
    });
    const disabledResponseHeader = await page.evaluate(async () => {
      const response = await fetch("/empty");
      return response.headers.get("x-e2e-master-response");
    });
    const disabledCookies = await extension.context.cookies(server.origin);

    expect(disabledEcho.headers["x-e2e-master-request"]).toBeUndefined();
    expect(disabledEcho.headers.cookie || "").not.toContain("e2e_master_request_cookie=request-cookie-enabled");
    expect(disabledResponseHeader).toBeNull();
    expect(disabledCookies.some((cookie) => cookie.name === "e2e_master_response_cookie")).toBe(false);

    await extension.extensionPage.locator("#global-rules-toggle").check();
    await waitForAppliedRuleCount(extension.extensionPage, 4);

    const restoredEcho = await page.evaluate(async () => {
      const response = await fetch("/echo");
      return response.json();
    });
    const restoredResponseHeader = await page.evaluate(async () => {
      const response = await fetch("/empty");
      return response.headers.get("x-e2e-master-response");
    });
    const restoredCookies = await extension.context.cookies(server.origin);

    expect(restoredEcho.headers["x-e2e-master-request"]).toBe("request-enabled");
    expect(restoredEcho.headers.cookie).toContain("e2e_master_request_cookie=request-cookie-enabled");
    expect(restoredResponseHeader).toBe("response-enabled");
    expect(restoredCookies.find((cookie) => cookie.name === "e2e_master_response_cookie")?.value)
      .toBe("response-cookie-enabled");
  } finally {
    await extension.close();
  }
});

test("restores each rule's previous enabled state after the master toggle cycle", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [
      requestHeaderRule({ id: "snapshot-enabled-rule", enabled: true }),
      responseHeaderRule({ id: "snapshot-disabled-rule", enabled: false })
    ]);
    await extension.extensionPage.reload();
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    const toggle = extension.extensionPage.locator("#global-rules-toggle");
    await toggle.uncheck();
    await waitForAppliedRuleCount(extension.extensionPage, 0);

    await toggle.check();

    await expect(toggle).toBeChecked();
    await expect.poll(async () => {
      const stored = await readStoredRules(extension.extensionPage);
      return stored.profiles[0].rules.map((rule) => rule.enabled);
    }).toEqual([true, false]);
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    const page = await extension.context.newPage();
    await page.goto(server.origin);
    const echo = await page.evaluate(async () => (await fetch("/echo")).json());
    const responseHeader = await page.evaluate(async () =>
      (await fetch("/empty")).headers.get("x-e2e-response")
    );
    expect(echo.headers["x-e2e-request"]).toBe("request-value");
    expect(responseHeader).toBeNull();
  } finally {
    await extension.close();
  }
});

test("turns the master toggle off when all active-profile rules are disabled individually", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [
      requestHeaderRule({ id: "individual-disable-rule-one" }),
      responseHeaderRule({ id: "individual-disable-rule-two" })
    ]);
    await extension.extensionPage.reload();
    await waitForAppliedRuleCount(extension.extensionPage, 2);

    const toggle = extension.extensionPage.locator("#global-rules-toggle");
    await extension.extensionPage.locator(".request-header-rule .enabled").uncheck();
    await expect(toggle).toBeChecked();

    await extension.extensionPage.locator(".response-header-rule .enabled").uncheck();

    await expect(toggle).not.toBeChecked();
    await expect(toggle).toHaveAttribute("aria-label", "All rules paused");
    await expect(extension.extensionPage.locator(".profile-current-badge"))
      .toHaveText("Inactive");
    await expect.poll(async () => {
      const stored = await readStoredRules(extension.extensionPage);
      return stored.rulesEnabled;
    }).toBe(false);
    await waitForAppliedRuleCount(extension.extensionPage, 0);

    const page = await extension.context.newPage();
    await page.goto(server.origin);
    const fullyDisabledEcho = await page.evaluate(async () => (await fetch("/echo")).json());
    const fullyDisabledResponseHeader = await page.evaluate(async () =>
      (await fetch("/empty")).headers.get("x-e2e-response")
    );
    expect(fullyDisabledEcho.headers["x-e2e-request"]).toBeUndefined();
    expect(fullyDisabledResponseHeader).toBeNull();

    await extension.extensionPage.locator(".request-header-rule .enabled").check();
    await expect(toggle).toBeChecked();
    await extension.extensionPage.locator(".response-header-rule .enabled").check();

    await expect(toggle).toBeChecked();
    await expect(toggle).toHaveAttribute("aria-label", "All rules enabled");
    await expect(extension.extensionPage.locator(".profile-current-badge"))
      .toHaveText("Active");
    await expect.poll(async () => {
      const stored = await readStoredRules(extension.extensionPage);
      return stored.rulesEnabled;
    }).toBe(true);
    await waitForAppliedRuleCount(extension.extensionPage, 2);

    const partiallyEnabledEcho = await page.evaluate(async () => (await fetch("/echo")).json());
    const partiallyEnabledResponseHeader = await page.evaluate(async () =>
      (await fetch("/empty")).headers.get("x-e2e-response")
    );
    expect(partiallyEnabledEcho.headers["x-e2e-request"]).toBe("request-value");
    expect(partiallyEnabledResponseHeader).toBe("response-value");
  } finally {
    await extension.close();
  }
});

test("updates the master toggle and counters when one cookie rule is re-enabled", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [
      requestHeaderRule({ id: "toggle-request-header" }),
      responseHeaderRule({ id: "toggle-response-header" }),
      requestCookieRule({ id: "toggle-request-cookie" }),
      responseCookieRule({ id: "toggle-response-cookie" })
    ]);
    await extension.extensionPage.reload();
    await waitForAppliedRuleCount(extension.extensionPage, 4);

    await extension.extensionPage.locator(".header-rule .enabled").nth(0).uncheck();
    await extension.extensionPage.locator(".header-rule .enabled").nth(1).uncheck();
    await extension.extensionPage.getByRole("button", { name: /Cookies\s+2/ }).click();
    await extension.extensionPage.locator(".cookie-rule .enabled").nth(0).uncheck();
    await extension.extensionPage.locator(".cookie-rule .enabled").nth(1).uncheck();

    const toggle = extension.extensionPage.locator("#global-rules-toggle");
    await expect(toggle).not.toBeChecked();
    await expect(extension.extensionPage.getByRole("button", { name: /Headers\s+0/ })).toBeVisible();
    await expect(extension.extensionPage.getByRole("button", { name: /Cookies\s+0/ })).toBeVisible();
    await waitForAppliedRuleCount(extension.extensionPage, 0);

    const page = await extension.context.newPage();
    await page.goto(server.origin);
    const fullyDisabledEcho = await page.evaluate(async () => (await fetch("/echo")).json());
    const fullyDisabledCookies = await extension.context.cookies(server.origin);
    expect(fullyDisabledEcho.headers.cookie || "").not.toContain("e2e_request_cookie=cookie-value");
    expect(fullyDisabledCookies.some((cookie) => cookie.name === "e2e_response_cookie")).toBe(false);

    await extension.extensionPage.locator(".cookie-rule .enabled").first().check();

    await expect(toggle).toBeChecked();
    await expect(toggle).toHaveAttribute("aria-label", "All rules enabled");
    await expect(extension.extensionPage.getByRole("button", { name: /Headers\s+0/ })).toBeVisible();
    await expect(extension.extensionPage.getByRole("button", { name: /Cookies\s+1/ })).toBeVisible();
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    const partiallyEnabledEcho = await page.evaluate(async () => (await fetch("/echo")).json());
    const partiallyEnabledCookies = await extension.context.cookies(server.origin);
    expect(partiallyEnabledEcho.headers.cookie).toContain("e2e_request_cookie=cookie-value");
    expect(partiallyEnabledCookies.some((cookie) => cookie.name === "e2e_response_cookie")).toBe(false);
  } finally {
    await extension.close();
  }
});

test("does not apply a newly added rule while the master toggle is off", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, []);
    await extension.extensionPage.reload();

    const toggle = extension.extensionPage.locator("#global-rules-toggle");
    await toggle.uncheck();
    await expect(toggle).not.toBeChecked();
    await waitForAppliedRuleCount(extension.extensionPage, 0);

    await extension.extensionPage.getByRole("button", { name: "Add request header rule", exact: true }).click();
    const rule = extension.extensionPage.locator(".request-header-rule");
    await rule.locator(".header").fill("X-E2E-Paused-New-Rule");
    await rule.locator(".value").fill("should-not-apply");

    await expect(rule.locator(".enabled")).not.toBeChecked();
    await expect.poll(async () => {
      const stored = await readStoredRules(extension.extensionPage);
      return stored.profiles[0].rules[0];
    }).toMatchObject({
      header: "X-E2E-Paused-New-Rule",
      value: "should-not-apply",
      enabled: false
    });
    await waitForAppliedRuleCount(extension.extensionPage, 0);

    const page = await extension.context.newPage();
    await page.goto(server.origin);
    const echo = await page.evaluate(async () => (await fetch("/echo")).json());

    expect(echo.headers["x-e2e-paused-new-rule"]).toBeUndefined();
  } finally {
    await extension.close();
  }
});

test("turns the master toggle off when the last active rule is deleted", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [requestHeaderRule({ id: "last-active-rule" })]);
    await extension.extensionPage.reload();
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    const page = await extension.context.newPage();
    await page.goto(server.origin);
    const beforeDelete = await page.evaluate(async () => (await fetch("/echo")).json());
    expect(beforeDelete.headers["x-e2e-request"]).toBe("request-value");

    await extension.extensionPage.locator(".request-header-rule .delete").click();

    await expect(extension.extensionPage.locator("#global-rules-toggle")).not.toBeChecked();
    await expect(extension.extensionPage.locator("#global-rules-toggle"))
      .toHaveAttribute("aria-label", "All rules paused");
    await expect(extension.extensionPage.locator(".profile-current-badge"))
      .toHaveText("Inactive");
    await expect(extension.extensionPage.locator(".request-header-rule")).toHaveCount(0);
    await expect.poll(async () => {
      const stored = await readStoredRules(extension.extensionPage);
      return {
        rulesEnabled: stored.rulesEnabled,
        ruleCount: stored.profiles[0].rules.length
      };
    }).toEqual({ rulesEnabled: false, ruleCount: 0 });
    await waitForAppliedRuleCount(extension.extensionPage, 0);

    const afterDelete = await page.evaluate(async () => (await fetch("/echo")).json());
    expect(afterDelete.headers["x-e2e-request"]).toBeUndefined();
  } finally {
    await extension.close();
  }
});

test("turns the master toggle off when the last request or response cookie rule is deleted", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [
      requestCookieRule({ id: "last-request-cookie-rule", name: "last_request_cookie" }),
      responseCookieRule({ id: "last-response-cookie-rule", name: "last_response_cookie" })
    ]);
    await extension.extensionPage.reload();
    await extension.extensionPage.getByRole("button", { name: /Cookies/ }).click();
    await waitForAppliedRuleCount(extension.extensionPage, 2);

    const page = await extension.context.newPage();
    await page.goto(server.origin);
    const beforeDelete = await page.evaluate(async () => (await fetch("/echo")).json());
    await page.evaluate(async () => { await fetch("/empty"); });
    expect(beforeDelete.headers.cookie).toContain("last_request_cookie=cookie-value");

    const cookieRules = extension.extensionPage.locator(".cookie-rule");
    await cookieRules.first().locator(".delete").click();

    await expect(extension.extensionPage.locator("#global-rules-toggle")).toBeChecked();
    await expect(cookieRules).toHaveCount(1);

    await extension.context.clearCookies();
    await waitForAppliedRuleCount(extension.extensionPage, 1);
    const afterRequestCookieDelete = await page.evaluate(async () => (await fetch("/echo")).json());
    await page.evaluate(async () => { await fetch("/empty"); });
    const responseCookieAfterRequestDelete = await extension.context.cookies(server.origin);
    expect(afterRequestCookieDelete.headers.cookie || "").not.toContain("last_request_cookie=cookie-value");
    expect(responseCookieAfterRequestDelete.some((cookie) => cookie.name === "last_response_cookie")).toBe(true);

    await extension.extensionPage.locator(".cookie-rule .delete").click();

    await expect(extension.extensionPage.locator("#global-rules-toggle")).not.toBeChecked();
    await expect(extension.extensionPage.locator(".profile-current-badge"))
      .toHaveText("Inactive");
    await expect(extension.extensionPage.locator(".cookie-rule")).toHaveCount(0);
    await expect.poll(async () => {
      const stored = await readStoredRules(extension.extensionPage);
      return {
        rulesEnabled: stored.rulesEnabled,
        ruleCount: stored.profiles[0].rules.length
      };
    }).toEqual({ rulesEnabled: false, ruleCount: 0 });
    await waitForAppliedRuleCount(extension.extensionPage, 0);

    await extension.context.clearCookies();
    const afterAllCookieDelete = await page.evaluate(async () => (await fetch("/echo")).json());
    await page.evaluate(async () => { await fetch("/empty"); });
    const responseCookiesAfterAllDelete = await extension.context.cookies(server.origin);
    expect(afterAllCookieDelete.headers.cookie || "").not.toContain("last_request_cookie=cookie-value");
    expect(responseCookiesAfterAllDelete.some((cookie) => cookie.name === "last_response_cookie")).toBe(false);
  } finally {
    await extension.close();
  }
});

test("deletes an existing response header when configured with an empty value", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [responseHeaderRule({
      id: "delete-response-header-rule",
      header: "X-E2E-Delete-Target",
      value: "",
      operation: "remove"
    })]);
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    const page = await extension.context.newPage();
    await page.goto(server.origin);

    const headerValue = await page.evaluate(async () => {
      const response = await fetch("/delete-target");
      return response.headers.get("x-e2e-delete-target");
    });

    expect(headerValue).toBeNull();
  } finally {
    await extension.close();
  }
});

test("deletes an existing response cookie with Max-Age zero", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [responseCookieRule({
      id: "delete-response-cookie-rule",
      name: "e2e_delete_cookie",
      value: "",
      operation: "delete",
      path: "/",
      session: false,
      maxAge: "0"
    })]);
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    await extension.context.addCookies([{
      name: "e2e_delete_cookie",
      value: "existing-value",
      domain: "127.0.0.1",
      path: "/"
    }]);

    const page = await extension.context.newPage();
    await page.goto(server.origin);
    await page.evaluate(async () => {
      await fetch("/delete-target");
    });

    const cookies = await extension.context.cookies(server.origin);
    expect(cookies.some((cookie) => cookie.name === "e2e_delete_cookie")).toBe(false);
  } finally {
    await extension.close();
  }
});

test("deletes only the response cookie matching the configured path", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [responseCookieRule({
      id: "delete-scoped-response-cookie-rule",
      name: "e2e_delete_cookie",
      value: "",
      operation: "delete",
      path: "/scoped",
      session: false,
      maxAge: "0",
      urlFilter: "*/delete-target/scoped"
    })]);
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    await extension.context.addCookies([
      {
        name: "e2e_delete_cookie",
        value: "root-value",
        domain: "127.0.0.1",
        path: "/"
      },
      {
        name: "e2e_delete_cookie",
        value: "scoped-value",
        domain: "127.0.0.1",
        path: "/scoped"
      }
    ]);

    const page = await extension.context.newPage();
    await page.goto(server.origin);
    await page.evaluate(async () => {
      await fetch("/delete-target/scoped");
    });

    const cookies = await extension.context.cookies(`${server.origin}/scoped`);
    expect(cookies.find((cookie) => cookie.name === "e2e_delete_cookie" && cookie.path === "/")).toMatchObject({
      value: "root-value"
    });
    expect(cookies.some((cookie) => cookie.name === "e2e_delete_cookie" && cookie.path === "/scoped")).toBe(false);
  } finally {
    await extension.close();
  }
});

test("deletes a response cookie using the configured domain and path", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [responseCookieRule({
      id: "delete-domain-path-response-cookie-rule",
      operation: "delete",
      name: "e2e_domain_path_delete_cookie",
      domain: "127.0.0.1",
      path: "/scoped",
      urlFilter: "*/delete-target/scoped"
    })]);
    await extension.extensionPage.reload();
    await extension.extensionPage.getByRole("button", { name: /Cookies/ }).click();

    await expect(extension.extensionPage.locator(".response-cookie-rule .operation-toggle"))
      .toHaveAttribute("aria-label", "Response cookie operation: Delete");
    await expect(extension.extensionPage.locator(".response-cookie-rule .domain")).toHaveValue("127.0.0.1");
    await expect(extension.extensionPage.locator(".response-cookie-rule .path")).toHaveValue("/scoped");

    const stored = await readStoredRules(extension.extensionPage);
    const storedRule = stored.profiles[0].rules[0];
    expect(storedRule).toMatchObject({
      operation: "delete",
      domain: "127.0.0.1",
      path: "/scoped"
    });

    await extension.context.addCookies([
      {
        name: "e2e_domain_path_delete_cookie",
        value: "root-value",
        domain: "127.0.0.1",
        path: "/"
      },
      {
        name: "e2e_domain_path_delete_cookie",
        value: "scoped-value",
        domain: "127.0.0.1",
        path: "/scoped"
      },
      {
        name: "e2e_domain_path_delete_cookie",
        value: "other-domain-value",
        domain: "other.test",
        path: "/scoped"
      }
    ]);

    const page = await extension.context.newPage();
    await page.goto(server.origin);
    await page.evaluate(async () => {
      await fetch("/delete-target/scoped");
    });

    const cookies = await extension.context.cookies(`${server.origin}/scoped`);
    expect(cookies.find((cookie) => cookie.name === "e2e_domain_path_delete_cookie" && cookie.path === "/"))
      .toMatchObject({ domain: "127.0.0.1", value: "root-value" });
    expect(cookies.some((cookie) => cookie.name === "e2e_domain_path_delete_cookie" && cookie.path === "/scoped")).toBe(false);

    const otherDomainCookies = await extension.context.cookies("http://other.test/scoped");
    expect(otherDomainCookies.find((cookie) => cookie.name === "e2e_domain_path_delete_cookie"))
      .toMatchObject({ domain: "other.test", path: "/scoped", value: "other-domain-value" });
  } finally {
    await extension.close();
  }
});

test("does not apply disabled response deletion rules", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [responseHeaderRule({
      id: "disabled-delete-response-header-rule",
      header: "X-E2E-Delete-Target",
      value: "",
      enabled: false
    })]);
    await waitForAppliedRuleCount(extension.extensionPage, 0);

    const page = await extension.context.newPage();
    await page.goto(server.origin);

    const headerValue = await page.evaluate(async () => {
      const response = await fetch("/delete-target");
      return response.headers.get("x-e2e-delete-target");
    });

    expect(headerValue).toBe("server-value");
  } finally {
    await extension.close();
  }
});

test("applies all configured header and cookie rules together", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [
      requestHeaderRule(),
      responseHeaderRule(),
      requestCookieRule(),
      responseCookieRule()
    ]);
    await extension.extensionPage.reload();
    await waitForAppliedRuleCount(extension.extensionPage, 4);

    await expect(extension.extensionPage.getByRole("button", { name: /Headers\s+2/ })).toHaveAttribute("aria-current", "page");
    await expect(extension.extensionPage.getByRole("heading", { name: "Request" })).toBeVisible();
    await expect(extension.extensionPage.getByRole("heading", { name: "Response" })).toBeVisible();
    await extension.extensionPage.getByRole("button", { name: "Request header behavior" }).click();
    await expect(extension.extensionPage.getByText("Adds headers to matching outgoing requests.")).toBeVisible();
    await extension.extensionPage.getByRole("button", { name: "Response header behavior" }).click();
    await expect(extension.extensionPage.getByText("Adds headers to matching responses. DevTools may not show injected headers in the Network tab.")).toBeVisible();
    await expect.poll(async () => extension.extensionPage.locator(".header").evaluateAll((inputs) =>
      inputs.map((input) => input instanceof HTMLInputElement ? input.value : "")
    )).toEqual(["X-E2E-Request", "X-E2E-Response"]);

    await extension.extensionPage.getByRole("button", { name: /Cookies\s+2/ }).click();
    await extension.extensionPage.getByRole("button", { name: "Request cookie behavior" }).click();
    await expect(extension.extensionPage.getByText("Request cookies are appended to the existing Cookie header on matching outgoing origin requests.")).toBeVisible();
    await extension.extensionPage.getByRole("button", { name: "Response cookie behavior" }).click();
    await expect(extension.extensionPage.getByText("Adds Set-Cookie headers to matching responses. The browser stores the cookie, but DevTools may not show the injected header in the Network tab.")).toBeVisible();
    await expect.poll(async () => extension.extensionPage.locator(".name").evaluateAll((inputs) =>
      inputs.map((input) => input instanceof HTMLInputElement ? input.value : "")
    )).toEqual(["e2e_request_cookie", "e2e_response_cookie"]);

    const page = await extension.context.newPage();
    await page.goto(server.origin);

    const echo = await page.evaluate(async () => {
      const response = await fetch("/echo");
      return response.json();
    });
    const responseHeaderValue = await page.evaluate(async () => {
      const response = await fetch("/empty");
      return response.headers.get("x-e2e-response");
    });

    const cookies = await extension.context.cookies(server.origin);
    const responseCookie = cookies.find((item) => item.name === "e2e_response_cookie");

    expect(echo.headers["x-e2e-request"]).toBe("request-value");
    expect(echo.headers.cookie).toContain("e2e_request_cookie=cookie-value");
    expect(responseHeaderValue).toBe("response-value");
    expect(responseCookie?.value).toBe("response-cookie-value");
  } finally {
    await extension.close();
  }
});

test("applies configured rules only when the URL filter matches", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [
      requestHeaderRule({
        header: "X-E2E-Filtered-Request",
        value: "filtered-request-value",
        urlFilter: "*filtered-match*"
      }),
      responseHeaderRule({
        header: "X-E2E-Filtered-Response",
        value: "filtered-response-value",
        urlFilter: "*filtered-match*"
      }),
      requestCookieRule({
        name: "e2e_filtered_request_cookie",
        value: "filtered-request-cookie-value",
        urlFilter: "*filtered-match*"
      }),
      responseCookieRule({
        name: "e2e_filtered_response_cookie",
        value: "filtered-response-cookie-value",
        urlFilter: "*filtered-match*"
      })
    ]);
    await waitForAppliedRuleCount(extension.extensionPage, 4);

    const page = await extension.context.newPage();
    await page.goto(server.origin);

    const unmatchedEcho = await page.evaluate(async () => {
      const response = await fetch("/filtered-miss/echo");
      return response.json();
    });
    const unmatchedResponseHeaderValue = await page.evaluate(async () => {
      const response = await fetch("/filtered-miss/empty");
      return response.headers.get("x-e2e-filtered-response");
    });
    const unmatchedCookies = await extension.context.cookies(server.origin);

    expect(unmatchedEcho.headers["x-e2e-filtered-request"]).toBeUndefined();
    expect(unmatchedEcho.headers.cookie || "").not.toContain("e2e_filtered_request_cookie=filtered-request-cookie-value");
    expect(unmatchedResponseHeaderValue).toBeNull();
    expect(unmatchedCookies.some((item) => item.name === "e2e_filtered_response_cookie")).toBe(false);

    const matchedEcho = await page.evaluate(async () => {
      const response = await fetch("/filtered-match/echo");
      return response.json();
    });
    const matchedResponseHeaderValue = await page.evaluate(async () => {
      const response = await fetch("/filtered-match/empty");
      return response.headers.get("x-e2e-filtered-response");
    });
    const matchedCookies = await extension.context.cookies(server.origin);
    const matchedResponseCookie = matchedCookies.find((item) => item.name === "e2e_filtered_response_cookie");

    expect(matchedEcho.headers["x-e2e-filtered-request"]).toBe("filtered-request-value");
    expect(matchedEcho.headers.cookie).toContain("e2e_filtered_request_cookie=filtered-request-cookie-value");
    expect(matchedResponseHeaderValue).toBe("filtered-response-value");
    expect(matchedResponseCookie?.value).toBe("filtered-response-cookie-value");
  } finally {
    await extension.close();
  }
});

test("defaults new response cookie SameSite selections to Lax", async () => {
  const extension = await launchExtension();

  try {
    const { sameSite, ...ruleWithoutSameSite } = responseCookieRule();
    await seedRules(extension.extensionPage, [ruleWithoutSameSite]);
    await extension.extensionPage.reload();

    await extension.extensionPage.getByRole("button", { name: /Cookies/ }).click();
    await extension.extensionPage.getByRole("button", { name: "Edit" }).click();

    await expect(extension.extensionPage.getByLabel("SameSite")).toHaveValue("lax");

    const stored = await readStoredRules(extension.extensionPage);
    const rule = stored.profiles[0].rules.find((item) => item.kind === "responseCookie");
    expect(rule?.sameSite).toBe("lax");
  } finally {
    await extension.close();
  }
});

test("aligns new session response cookie fields with existing editors", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [responseCookieRule({ id: "existing-response-cookie" })]);
    await extension.extensionPage.reload();

    await extension.extensionPage.getByRole("button", { name: /Cookies/ }).click();
    await extension.extensionPage.getByRole("button", { name: "Edit" }).click();
    await extension.extensionPage.getByRole("button", { name: "Add response cookie rule", exact: true }).click();

    const responseCookieRules = extension.extensionPage.locator(".response-cookie-rule");
    await expect(responseCookieRules).toHaveCount(2);

    for (const rule of await responseCookieRules.all()) {
      await expect(rule.locator(".cookie-response-fields .detail-editor")).toHaveClass(/is-session/);
      await expect(rule.locator(".detail-field-max-age")).toBeHidden();

      const domainPosition = await rule.locator(".domain").evaluate((input) => input.closest("label")?.offsetTop);
      const securePosition = await rule.locator(".secure").evaluate((input) => input.closest("label")?.offsetTop);
      expect(securePosition).toBe(domainPosition);
    }
  } finally {
    await extension.close();
  }
});

test("adds rules from grouped request and response sections", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, []);
    await extension.extensionPage.reload();

    await extension.extensionPage.getByRole("button", { name: "Add response header rule", exact: true }).click();
    await extension.extensionPage.getByRole("button", { name: /Cookies/ }).click();
    await extension.extensionPage.getByRole("button", { name: "Add response cookie rule", exact: true }).click();

    await expect.poll(async () => {
      const stored = await readStoredRules(extension.extensionPage);
      return stored.profiles[0].rules.map((rule) => rule.kind);
    }).toEqual(["responseHeader", "responseCookie"]);
  } finally {
    await extension.close();
  }
});

test("allows up to five profiles before showing the profile limit", async () => {
  const extension = await launchExtension();

  try {
    await extension.extensionPage.getByRole("button", { name: "Profiles" }).click();

    for (let profileNumber = 2; profileNumber <= 5; profileNumber += 1) {
      await extension.extensionPage.getByRole("button", { name: "Add profile" }).click();
      await expect(extension.extensionPage.getByLabel("Profile name")).toHaveValue(`Profile ${profileNumber}`);
      await extension.extensionPage.getByRole("button", { name: "Create" }).click();
    }

    await expect(extension.extensionPage.getByText("Profile 5")).toBeVisible();
    await expect(extension.extensionPage.getByText("Profile limit reached.")).toBeVisible();
    await expect(extension.extensionPage.getByRole("button", { name: "Profile limit reached" })).toBeDisabled();
    await expect(extension.extensionPage.getByRole("menuitem", { name: "Add profile" })).toHaveCount(0);

    const stored = await readStoredRules(extension.extensionPage);
    expect(stored.profiles).toHaveLength(5);
  } finally {
    await extension.close();
  }
});

test("deletes an inactive profile without changing the active profile", async () => {
  const extension = await launchExtension();

  try {
    await seedProfiles(
      extension.extensionPage,
      [
        {
          id: "profile-one",
          name: "Profile 1",
          rules: [requestHeaderRule({
            id: "profile-one-rule",
            header: "X-E2E-Profile-One",
            value: "profile-one-value"
          })]
        },
        {
          id: "profile-two",
          name: "Profile 2",
          rules: [requestHeaderRule({
            id: "profile-two-rule",
            header: "X-E2E-Profile-Two",
            value: "profile-two-value"
          })]
        }
      ],
      "profile-one"
    );
    await extension.extensionPage.reload();
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    await extension.extensionPage.getByRole("button", { name: "Profiles" }).click();
    const profileTwoRow = extension.extensionPage.locator(".profile-menu-row").filter({ hasText: "Profile 2" });
    await profileTwoRow.getByRole("button", { name: "Delete Profile 2" }).click();
    await expect(profileTwoRow.getByText("Delete?")).toBeVisible();
    await profileTwoRow.getByRole("button", { name: "Yes", exact: true }).click();

    await expect(extension.extensionPage.getByText("Profile 2", { exact: true })).toHaveCount(0);
    await expect.poll(async () => {
      const stored = await readStoredRules(extension.extensionPage);
      return {
        activeProfileId: stored.activeProfileId,
        profileIds: stored.profiles.map((profile) => profile.id)
      };
    }).toEqual({
      activeProfileId: "profile-one",
      profileIds: ["profile-one"]
    });
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    const page = await extension.context.newPage();
    await page.goto(server.origin);
    const echo = await page.evaluate(async () => (await fetch("/echo")).json());

    expect(echo.headers["x-e2e-profile-one"]).toBe("profile-one-value");
    expect(echo.headers["x-e2e-profile-two"]).toBeUndefined();
  } finally {
    await extension.close();
  }
});

test("exports and imports selected profiles from the profile menu", async () => {
  const extension = await launchExtension();

  try {
    await seedProfiles(
      extension.extensionPage,
      [
        {
          id: "profile-one",
          name: "Profile 1",
          rules: [requestHeaderRule({ id: "profile-one-rule" })]
        },
        {
          id: "profile-two",
          name: "Profile 2",
          rules: [requestHeaderRule({ id: "profile-two-rule", header: "X-E2E-Imported" })]
        }
      ],
      "profile-one"
    );
    await extension.extensionPage.reload();

    await extension.extensionPage.getByRole("button", { name: "Profiles" }).click();
    await extension.extensionPage.getByRole("button", { name: "Export" }).click();
    await extension.extensionPage.getByLabel("Profile 1").setChecked(false);
    const downloadPromise = extension.extensionPage.waitForEvent("download");
    await extension.extensionPage.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    const exportPath = await download.path();

    expect(exportPath).toBeTruthy();

    const exported = JSON.parse(await fs.readFile(exportPath || "", "utf8"));
    expect(exported.profiles.map((profile) => profile.name)).toEqual(["Profile 2"]);

    await seedProfiles(
      extension.extensionPage,
      [1, 2, 3, 4, 5].map((number) => ({
        id: `full-profile-${number}`,
        name: `Full Profile ${number}`,
        rules: []
      })),
      "full-profile-1"
    );
    await extension.extensionPage.reload();
    await extension.extensionPage.getByRole("button", { name: "Profiles" }).click();

    const blockedFileChooserPromise = extension.extensionPage.waitForEvent("filechooser");
    await extension.extensionPage.getByRole("button", { name: "Import" }).click();
    const blockedFileChooser = await blockedFileChooserPromise;
    await blockedFileChooser.setFiles(exportPath || "");

    await expect(extension.extensionPage.getByText("Profile limit reached. Delete a profile before importing new profiles.")).toBeVisible();
    await expect(extension.extensionPage.getByRole("button", { name: "Import" })).toBeDisabled();

    await seedProfiles(
      extension.extensionPage,
      [
        {
          id: "default",
          name: "Default",
          rules: []
        },
        {
          id: "existing-profile-two",
          name: "Profile 2",
          rules: [requestHeaderRule({ id: "old-profile-two-rule", header: "X-E2E-Old" })]
        }
      ],
      "default"
    );
    await extension.extensionPage.reload();
    await extension.extensionPage.getByRole("button", { name: "Profiles" }).click();

    const fileChooserPromise = extension.extensionPage.waitForEvent("filechooser");
    await extension.extensionPage.getByRole("button", { name: "Import" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(exportPath || "");

    await expect(extension.extensionPage.locator(".profile-transfer-option").filter({ hasText: "Profile 2" }).locator("input")).toBeChecked();
    await extension.extensionPage.getByRole("button", { name: "Import" }).click();

    const stored = await readStoredRules(extension.extensionPage);
    expect(stored.profiles.map((profile) => profile.name)).toEqual(["Default", "Profile 2"]);
    expect(stored.profiles[1].id).toBe("existing-profile-two");
    expect(stored.profiles[1].rules[0]).toMatchObject({
      id: "profile-two-rule",
      header: "X-E2E-Imported"
    });

    await seedProfiles(
      extension.extensionPage,
      [
        {
          id: "default",
          name: "Default",
          rules: []
        },
        {
          id: "active-profile-two",
          name: "Profile 2",
          rules: [requestHeaderRule({ id: "stale-profile-two-rule", header: "X-E2E-Stale" })]
        }
      ],
      "active-profile-two"
    );
    await extension.extensionPage.reload();
    await extension.extensionPage.getByRole("button", { name: "Profiles" }).click();

    const activeFileChooserPromise = extension.extensionPage.waitForEvent("filechooser");
    await extension.extensionPage.getByRole("button", { name: "Import" }).click();
    const activeFileChooser = await activeFileChooserPromise;
    await activeFileChooser.setFiles(exportPath || "");

    await extension.extensionPage.getByRole("button", { name: "Import" }).click();

    const activeStored = await readStoredRules(extension.extensionPage);
    expect(activeStored.profiles[1].id).toBe("active-profile-two");
    expect(activeStored.profiles[1].rules[0]).toMatchObject({
      id: "profile-two-rule",
      header: "X-E2E-Imported"
    });
  } finally {
    await extension.close();
  }
});

test("activates an inactive profile and applies only its rules", async () => {
  const extension = await launchExtension();

  try {
    await seedProfiles(
      extension.extensionPage,
      [
        {
          id: "profile-one",
          name: "Profile 1",
          rules: [
            requestHeaderRule({
              id: "profile-one-rule",
              header: "X-E2E-Profile-One",
              value: "profile-one-value"
            })
          ]
        },
        {
          id: "profile-two",
          name: "Profile 2",
          rules: [
            requestHeaderRule({
              id: "profile-two-rule",
              header: "X-E2E-Profile-Two",
              value: "profile-two-value"
            })
          ]
        }
      ],
      "profile-one"
    );
    await extension.extensionPage.reload();
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    await extension.extensionPage.getByRole("button", { name: "Profiles" }).click();
    const profileTwoRow = extension.extensionPage.locator(".profile-menu-row").filter({ hasText: "Profile 2" });
    await profileTwoRow.hover();
    await profileTwoRow.getByRole("button", { name: "activate", exact: true }).click();

    await expect.poll(async () => {
      const stored = await readStoredRules(extension.extensionPage);
      return stored.activeProfileId;
    }).toBe("profile-two");
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    const page = await extension.context.newPage();
    await page.goto(server.origin);

    const echo = await page.evaluate(async () => {
      const response = await fetch("/echo");
      return response.json();
    });

    expect(echo.headers["x-e2e-profile-one"]).toBeUndefined();
    expect(echo.headers["x-e2e-profile-two"]).toBe("profile-two-value");
  } finally {
    await extension.close();
  }
});

test("does not apply disabled rules", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [requestHeaderRule({ enabled: false })]);
    await waitForAppliedRuleCount(extension.extensionPage, 0);

    const page = await extension.context.newPage();
    await page.goto(server.origin);

    const echo = await page.evaluate(async () => {
      const response = await fetch("/echo");
      return response.json();
    });

    expect(echo.headers["x-e2e-request"]).toBeUndefined();
  } finally {
    await extension.close();
  }
});

test("skips invalid rules and reports warning sync status", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [
      requestHeaderRule(),
      requestHeaderRule({
        id: "invalid-request-header-rule",
        header: "Invalid Header Name"
      })
    ]);
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    await expect.poll(async () => {
      const syncStatus = await readSyncStatus(extension.extensionPage);
      return `${syncStatus.level}:${syncStatus.message}`;
    }).toBe("warning:1 invalid rule skipped.");
  } finally {
    await extension.close();
  }
});

test("grants website access from the popup and requests rule synchronization", async () => {
  const extension = await launchExtension();

  try {
    await extension.extensionPage.addInitScript(() => {
      const state = {
        granted: false,
        permissionRequests: [] as unknown[],
        syncMessages: [] as unknown[]
      };

      Object.defineProperty(chrome.permissions, "contains", {
        configurable: true,
        value: async () => state.granted
      });
      Object.defineProperty(chrome.permissions, "request", {
        configurable: true,
        value: async (permission: unknown) => {
          state.permissionRequests.push(permission);
          state.granted = true;
          return true;
        }
      });
      Object.defineProperty(chrome.runtime, "sendMessage", {
        configurable: true,
        value: async (message: unknown) => {
          state.syncMessages.push(message);
        }
      });
      Object.defineProperty(globalThis, "__hostAccessTestState", { value: state });
    });
    await extension.extensionPage.reload();

    await expect(extension.extensionPage.locator("#host-access-banner")).toBeVisible();
    await extension.extensionPage.getByRole("button", { name: "Grant access" }).click();

    await expect(extension.extensionPage.locator("#host-access-banner")).toBeHidden();
    await expect(extension.extensionPage.locator(".profile-current-badge")).toHaveText("Active");
    const state = await extension.extensionPage.evaluate(() =>
      (globalThis as typeof globalThis & {
        __hostAccessTestState: {
          permissionRequests: unknown[];
          syncMessages: unknown[];
        };
      }).__hostAccessTestState
    );
    expect(state.permissionRequests).toEqual([{ origins: ["<all_urls>"] }]);
    expect(state.syncMessages).toEqual([{ type: "syncOverrideRules" }]);
  } finally {
    await extension.close();
  }
});

test("reports missing website access and stops applying rules", async () => {
  const deniedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "header-override-no-access-e2e-"));
  const extensionPath = path.join(deniedRoot, "extension");
  const userDataDir = path.join(deniedRoot, "browser-profile");

  try {
    await fs.cp(path.resolve(process.cwd(), "extension"), extensionPath, { recursive: true });
    const manifestPath = path.join(extensionPath, "manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    await fs.writeFile(manifestPath, `${JSON.stringify({ ...manifest, host_permissions: [] }, null, 2)}\n`);

    const extension = await launchExtension({ extensionPath, userDataDir });

    try {
      await seedRules(extension.extensionPage, [requestHeaderRule()]);
      await extension.extensionPage.reload();

      await expect(extension.extensionPage.locator("#host-access-banner")).toBeVisible();
      await expect(extension.extensionPage.getByText("Website access required")).toBeVisible();
      await expect(extension.extensionPage.getByRole("button", { name: "Grant access" })).toBeVisible();
      await expect(extension.extensionPage.locator(".profile-current-badge")).toHaveText("No access");
      await expect.poll(async () => {
        const syncStatus = await readSyncStatus(extension.extensionPage);
        return `${syncStatus.level}:${syncStatus.message}:${syncStatus.appliedCount}`;
      }).toBe("error:Website access is required before override rules can be applied.:0");
      await expect.poll(async () => extension.extensionPage.evaluate(() => chrome.action.getBadgeText({})))
        .toBe("!");
      await expect.poll(async () => extension.extensionPage.evaluate(async () =>
        (await chrome.declarativeNetRequest.getDynamicRules()).length
      )).toBe(0);
    } finally {
      await extension.close();
    }
  } finally {
    await fs.rm(deniedRoot, { recursive: true, force: true });
  }
});

test("preserves configured profiles and working rules across an extension version upgrade", async () => {
  const upgradeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "header-override-upgrade-e2e-"));
  const extensionPath = path.join(upgradeRoot, "extension");
  const userDataDir = path.join(upgradeRoot, "browser-profile");
  const manifestPath = path.join(extensionPath, "manifest.json");

  try {
    await fs.cp(path.resolve(process.cwd(), "extension"), extensionPath, { recursive: true });
    const currentManifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const previousVersionParts = currentManifest.version.split(".").map(Number);
    let previousVersion = "";

    for (let index = previousVersionParts.length - 1; index >= 0; index -= 1) {
      if (previousVersionParts[index] > 0) {
        previousVersionParts[index] -= 1;
        previousVersion = previousVersionParts.join(".");
        break;
      }
    }

    if (!previousVersion) {
      throw new Error(`Could not derive a previous version from ${currentManifest.version}.`);
    }

    await fs.writeFile(
      manifestPath,
      `${JSON.stringify({ ...currentManifest, version: previousVersion }, null, 2)}\n`
    );

    const configuredRules = [
      requestHeaderRule({
        id: "upgrade-request-header",
        header: "X-E2E-Upgrade-Request",
        value: "upgrade-request-value"
      }),
      responseHeaderRule({
        id: "upgrade-response-header",
        header: "X-E2E-Upgrade-Response",
        value: "upgrade-response-value"
      }),
      requestCookieRule({
        id: "upgrade-request-cookie",
        name: "e2e_upgrade_request_cookie",
        value: "upgrade-request-cookie-value"
      }),
      responseCookieRule({
        id: "upgrade-response-cookie",
        name: "e2e_upgrade_response_cookie",
        value: "upgrade-response-cookie-value"
      }),
      requestHeaderRule({
        id: "upgrade-disabled-rule",
        enabled: false,
        header: "X-E2E-Upgrade-Disabled",
        value: "must-not-apply"
      })
    ];
    const preUpgradeStorage = {
      schemaVersion: 4,
      rulesEnabled: true,
      masterToggleSnapshot: null,
      activeProfileId: "upgrade-active-profile",
      profiles: [
        {
          id: "upgrade-active-profile",
          name: "Upgrade Active",
          rules: configuredRules
        },
        {
          id: "upgrade-inactive-profile",
          name: "Upgrade Inactive",
          rules: [requestHeaderRule({
            id: "upgrade-inactive-rule",
            header: "X-E2E-Upgrade-Inactive",
            value: "must-not-apply"
          })]
        }
      ]
    };

    const installedExtension = await launchExtension({ extensionPath, userDataDir });
    const extensionId = installedExtension.extensionId;

    try {
      await seedStorageData(installedExtension.extensionPage, preUpgradeStorage);
      await waitForAppliedRuleCount(installedExtension.extensionPage, 4);
      expect((await readStoredRules(installedExtension.extensionPage)).schemaVersion).toBe(4);
    } finally {
      await installedExtension.close();
    }

    await fs.writeFile(manifestPath, `${JSON.stringify(currentManifest, null, 2)}\n`);

    const upgradedExtension = await launchExtension({ extensionPath, userDataDir });

    try {
      expect(upgradedExtension.extensionId).toBe(extensionId);
      await waitForAppliedRuleCount(upgradedExtension.extensionPage, 4);

      const upgradedStorage = await readStoredRules(upgradedExtension.extensionPage);
      expect(upgradedStorage).toMatchObject({
        schemaVersion: 5,
        rulesEnabled: true,
        masterToggleSnapshot: null,
        activeProfileId: "upgrade-active-profile"
      });
      expect(upgradedStorage.profiles.map((profile) => ({ id: profile.id, name: profile.name }))).toEqual([
        { id: "upgrade-active-profile", name: "Upgrade Active" },
        { id: "upgrade-inactive-profile", name: "Upgrade Inactive" }
      ]);
      expect(upgradedStorage.profiles[0].rules.map((rule) => ({
        id: rule.id,
        kind: rule.kind,
        enabled: rule.enabled
      }))).toEqual(configuredRules.map((rule) => ({
        id: rule.id,
        kind: rule.kind,
        enabled: rule.enabled
      })));
      expect(upgradedStorage.profiles[1].rules[0]).toMatchObject({
        id: "upgrade-inactive-rule",
        enabled: true,
        header: "X-E2E-Upgrade-Inactive"
      });
      await expect.poll(async () => upgradedExtension.extensionPage.evaluate(() => chrome.action.getBadgeText({})))
        .toBe("4");

      const page = await upgradedExtension.context.newPage();
      await page.goto(server.origin);
      const echo = await page.evaluate(async () => (await fetch("/echo")).json());
      const responseHeaderValue = await page.evaluate(async () => {
        const response = await fetch("/empty");
        return response.headers.get("x-e2e-upgrade-response");
      });
      const cookies = await upgradedExtension.context.cookies(server.origin);

      expect(echo.headers["x-e2e-upgrade-request"]).toBe("upgrade-request-value");
      expect(echo.headers.cookie).toContain("e2e_upgrade_request_cookie=upgrade-request-cookie-value");
      expect(echo.headers["x-e2e-upgrade-disabled"]).toBeUndefined();
      expect(echo.headers["x-e2e-upgrade-inactive"]).toBeUndefined();
      expect(responseHeaderValue).toBe("upgrade-response-value");
      expect(cookies.find((cookie) => cookie.name === "e2e_upgrade_response_cookie")?.value)
        .toBe("upgrade-response-cookie-value");
    } finally {
      await upgradedExtension.close();
    }
  } finally {
    await fs.rm(upgradeRoot, { recursive: true, force: true });
  }
});

test("migrates legacy array-based rules into default profile storage", async () => {
  const extension = await launchExtension();

  try {
    await seedLegacyRules(extension.extensionPage, [
      requestHeaderRule({
        id: "legacy-request-header-rule",
        header: "X-E2E-Legacy",
        value: "migrated-value"
      })
    ]);

    await extension.extensionPage.reload();
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    const migrated = await readStoredRules(extension.extensionPage);

    expect(migrated.schemaVersion).toBe(5);
    expect(migrated.rulesEnabled).toBe(true);
    expect(migrated.activeProfileId).toBe("default");
    expect(migrated.profiles).toHaveLength(1);
    expect(migrated.profiles[0]).toMatchObject({
      id: "default",
      name: "Default"
    });
    expect(migrated.profiles[0].rules).toHaveLength(1);
    expect(migrated.profiles[0].rules[0]).toMatchObject({
      id: "legacy-request-header-rule",
      kind: "requestHeader",
      enabled: true,
      header: "X-E2E-Legacy",
      value: "migrated-value",
      operation: "set",
      urlFilter: "|http*"
    });

    const page = await extension.context.newPage();
    await page.goto(server.origin);

    const echo = await page.evaluate(async () => {
      const response = await fetch("/echo");
      return response.json();
    });

    expect(echo.headers["x-e2e-legacy"]).toBe("migrated-value");
  } finally {
    await extension.close();
  }
});

test("migrates old profiles with no enabled rules to an inactive master toggle", async () => {
  const extension = await launchExtension();

  try {
    await seedLegacyRules(extension.extensionPage, [
      requestHeaderRule({
        id: "legacy-disabled-rule",
        enabled: false
      })
    ]);

    await extension.extensionPage.reload();

    await expect(extension.extensionPage.locator("#global-rules-toggle")).not.toBeChecked();
    await expect(extension.extensionPage.locator("#global-rules-toggle"))
      .toHaveAttribute("aria-label", "All rules paused");
    await expect(extension.extensionPage.locator(".profile-current-badge"))
      .toHaveText("Inactive");

    const migrated = await readStoredRules(extension.extensionPage);
    expect(migrated.schemaVersion).toBe(5);
    expect(migrated.rulesEnabled).toBe(false);
    expect(migrated.profiles[0].rules[0].enabled).toBe(false);
  } finally {
    await extension.close();
  }
});

test("remembers the selected popup tab after reopening", async () => {
  const extension = await launchExtension();

  try {
    await extension.extensionPage.getByRole("button", { name: /Cookies/ }).click();
    await expect(extension.extensionPage.getByRole("button", { name: /Cookies/ })).toHaveAttribute("aria-current", "page");

    await extension.extensionPage.reload();

    await expect(extension.extensionPage.getByRole("button", { name: /Cookies/ })).toHaveAttribute("aria-current", "page");
    await expect(extension.extensionPage.getByText("No rules yet.")).toBeVisible();
  } finally {
    await extension.close();
  }
});
