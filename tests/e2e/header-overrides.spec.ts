import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
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

    expect(migrated.schemaVersion).toBe(2);
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
