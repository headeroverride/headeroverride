import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  launchExtension,
  readPopupState,
  readStoredRules,
  requestCookieRule,
  requestHeaderRule,
  responseCookieRule,
  responseHeaderRule,
  seedPopupState,
  seedProfiles,
  seedRules
} from "./fixtures/extension";

function section(page: Page, name: "Request" | "Response") {
  return page.locator(".rule-section").filter({
    has: page.getByRole("heading", { name, exact: true })
  });
}

async function values(target: Locator, selector: string) {
  return target.locator(selector).evaluateAll((inputs) => inputs.map((input) =>
    input instanceof HTMLInputElement ? input.value : ""
  ));
}

async function clickSort(target: Locator, label: string) {
  await target.getByRole("button", { name: new RegExp(`^Sort by ${label};`) }).click();
}

test("previews and cycles the On-field arrow for enabled rules", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [
      requestHeaderRule({ id: "enabled-one", header: "X-Enabled-One", enabled: true }),
      requestHeaderRule({ id: "enabled-two", header: "X-Enabled-Two", enabled: true })
    ]);
    await extension.extensionPage.reload();

    const request = section(extension.extensionPage, "Request");
    await expect(request.locator(".enabled")).toHaveCount(2);
    await expect(request.locator(".enabled").first()).toBeChecked();
    await expect(request.locator(".enabled").last()).toBeChecked();

    const onHeading = request.getByRole("columnheader", { name: /Sort by On/ });
    const onSort = request.getByRole("button", { name: /^Sort by On;/ });
    const arrow = onSort.locator(".sort-indicator");
    const onLabel = onSort.locator("span").first();
    const firstEnabled = request.locator(".enabled").first();
    const [labelBox, checkboxBox, arrowBox] = await Promise.all([
      onLabel.boundingBox(),
      firstEnabled.boundingBox(),
      arrow.boundingBox()
    ]);

    expect(labelBox).not.toBeNull();
    expect(checkboxBox).not.toBeNull();
    expect(arrowBox).not.toBeNull();
    expect(Math.abs(
      (labelBox?.x || 0) + (labelBox?.width || 0) / 2
      - ((checkboxBox?.x || 0) + (checkboxBox?.width || 0) / 2)
    )).toBeLessThanOrEqual(2);
    expect((arrowBox?.x || 0) - ((labelBox?.x || 0) + (labelBox?.width || 0)))
      .toBeLessThanOrEqual(1);

    await onSort.hover();
    await expect(onHeading).toHaveAttribute("aria-sort", "none");
    await expect(arrow).toHaveText("↓");
    await expect(arrow).toHaveCSS("opacity", "1");

    await onSort.click();
    await expect(onHeading).toHaveAttribute("aria-sort", "descending");
    await expect(arrow).toHaveText("↓");
    await expect(arrow).toHaveCSS("opacity", "1");

    await onSort.click();
    await expect(onHeading).toHaveAttribute("aria-sort", "ascending");
    await expect(arrow).toHaveText("↑");
    await expect(arrow).toHaveCSS("opacity", "1");

    await onSort.click();
    await expect(onHeading).toHaveAttribute("aria-sort", "none");
    await expect(onHeading).toHaveClass(/suppress-sort-preview/);
    await expect.poll(() => onSort.evaluate((button) => button.matches(":hover")))
      .toBe(true);
    await extension.extensionPage.waitForTimeout(300);
    await expect(onHeading).toHaveClass(/suppress-sort-preview/);
    await expect(arrow).toHaveCSS("opacity", "0");

    const box = await onSort.boundingBox();
    expect(box).not.toBeNull();
    await extension.extensionPage.mouse.move(
      (box?.x || 0) + 2,
      (box?.y || 0) + (box?.height || 0) / 2
    );
    await expect.poll(() => onSort.evaluate((button) => button.matches(":hover")))
      .toBe(true);
    await expect(arrow).toHaveText("↓");
    await expect(arrow).toHaveCSS("opacity", "1");
  } finally {
    await extension.close();
  }
});

test("sorts every visible column independently and clears back to stored order", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [
      requestHeaderRule({
        id: "request-bravo",
        enabled: true,
        header: "X-Bravo-10",
        value: "20",
        urlFilter: "*z.example*",
        comment: "second"
      }),
      responseHeaderRule({ id: "response-zulu", header: "X-Zulu" }),
      requestHeaderRule({
        id: "request-alpha",
        enabled: false,
        header: "X-Alpha-2",
        value: "3",
        urlFilter: "*a.example*",
        comment: "first"
      }),
      responseHeaderRule({ id: "response-alpha", header: "X-Alpha" })
    ]);
    await extension.extensionPage.reload();

    const request = section(extension.extensionPage, "Request");
    const response = section(extension.extensionPage, "Response");

    await clickSort(request, "On");
    await expect.poll(() => values(request, ".header")).toEqual(["X-Bravo-10", "X-Alpha-2"]);
    await clickSort(request, "On");
    await expect.poll(() => values(request, ".header")).toEqual(["X-Alpha-2", "X-Bravo-10"]);
    await clickSort(request, "On");
    const clearedOnSort = request.getByRole("button", { name: /^Sort by On;/ });
    await expect(clearedOnSort.locator(".sort-indicator")).toHaveCSS("opacity", "0");
    await extension.extensionPage.locator(".toolbar").hover();
    await clearedOnSort.hover();
    await expect(clearedOnSort.locator(".sort-indicator")).toHaveCSS("opacity", "1");

    for (const [label, selector, ascending] of [
      ["Header", ".header", ["X-Alpha-2", "X-Bravo-10"]],
      ["Value", ".value", ["3", "20"]],
      ["URL", ".url-filter", ["*a.example*", "*z.example*"]],
      ["Comment", ".comment", ["first", "second"]]
    ] as const) {
      await clickSort(request, label);
      await expect.poll(() => values(request, selector)).toEqual([...ascending].reverse());
      await clickSort(request, label);
      await expect.poll(() => values(request, selector)).toEqual(ascending);
      await clickSort(request, label);
      await expect.poll(() => values(request, ".header")).toEqual(["X-Bravo-10", "X-Alpha-2"]);
    }

    await expect.poll(() => values(response, ".header")).toEqual(["X-Zulu", "X-Alpha"]);
    expect((await readStoredRules(extension.extensionPage)).profiles[0].rules.map((rule) => rule.id))
      .toEqual(["request-bravo", "response-zulu", "request-alpha", "response-alpha"]);
  } finally {
    await extension.close();
  }
});

test("persists independent section sorting per profile and tab", async () => {
  const extension = await launchExtension();

  try {
    await seedProfiles(extension.extensionPage, [
      {
        id: "profile-one",
        name: "Profile One",
        rules: [
          requestHeaderRule({ id: "one-request-b", header: "X-B" }),
          responseHeaderRule({ id: "one-response-b", header: "X-Response-B" }),
          requestHeaderRule({ id: "one-request-a", header: "X-A" }),
          responseHeaderRule({ id: "one-response-a", header: "X-Response-A" }),
          requestCookieRule({ id: "one-cookie-b", name: "cookie_10" }),
          requestCookieRule({ id: "one-cookie-a", name: "cookie_2" }),
          responseCookieRule({ id: "one-response-cookie", name: "response_cookie" })
        ]
      },
      {
        id: "profile-two",
        name: "Profile Two",
        rules: [
          requestHeaderRule({ id: "two-z", header: "X-Z" }),
          requestHeaderRule({ id: "two-y", header: "X-Y" })
        ]
      }
    ], "profile-one");
    await extension.extensionPage.reload();

    await clickSort(section(extension.extensionPage, "Request"), "Header");
    await clickSort(section(extension.extensionPage, "Request"), "Header");
    await clickSort(section(extension.extensionPage, "Response"), "Header");
    await extension.extensionPage.getByRole("button", { name: /Cookies/ }).click();
    await clickSort(section(extension.extensionPage, "Request"), "Name");
    await clickSort(section(extension.extensionPage, "Request"), "Name");
    await expect.poll(() => values(section(extension.extensionPage, "Request"), ".name"))
      .toEqual(["cookie_2", "cookie_10"]);

    await extension.extensionPage.getByRole("button", { name: "Profiles" }).click();
    await extension.extensionPage.getByRole("menuitem", { name: "Profile Two", exact: true }).click();
    await extension.extensionPage.getByRole("button", { name: /Headers/ }).click();
    await expect.poll(() => values(section(extension.extensionPage, "Request"), ".header"))
      .toEqual(["X-Z", "X-Y"]);
    await clickSort(section(extension.extensionPage, "Request"), "Header");

    await extension.extensionPage.getByRole("button", { name: "Profiles" }).click();
    await extension.extensionPage.getByRole("menuitem", { name: /Profile One/ }).click();
    await expect.poll(() => values(section(extension.extensionPage, "Request"), ".header"))
      .toEqual(["X-A", "X-B"]);
    await expect.poll(() => values(section(extension.extensionPage, "Response"), ".header"))
      .toEqual(["X-Response-B", "X-Response-A"]);

    await extension.extensionPage.getByRole("button", { name: /Cookies/ }).click();
    await extension.extensionPage.reload();
    await expect(extension.extensionPage.getByRole("button", { name: /Cookies/ }))
      .toHaveAttribute("aria-current", "page");
    await expect.poll(() => values(section(extension.extensionPage, "Request"), ".name"))
      .toEqual(["cookie_2", "cookie_10"]);

    await expect.poll(() => readPopupState(extension.extensionPage)).toMatchObject({
      activeTab: "cookies",
      sortingByProfile: {
        "profile-one": {
          requestHeader: { field: "header", direction: "asc" },
          responseHeader: { field: "header", direction: "desc" },
          requestCookie: { field: "name", direction: "asc" }
        },
        "profile-two": {
          requestHeader: { field: "header", direction: "desc" }
        }
      }
    });
  } finally {
    await extension.close();
  }
});

test("reorders committed edits and enabled changes while repairing malformed popup state", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [
      requestHeaderRule({ id: "stored-first", header: "X-A", enabled: true }),
      requestHeaderRule({ id: "stored-second", header: "X-B", enabled: false })
    ]);
    await seedPopupState(extension.extensionPage, {
      activeTab: "unknown",
      sortingByProfile: {
        default: {
          requestHeader: { field: "domain", direction: "sideways" }
        },
        missing: {
          requestHeader: { field: "header", direction: "asc" }
        }
      }
    });
    await extension.extensionPage.reload();

    const request = section(extension.extensionPage, "Request");
    await expect.poll(() => values(request, ".header")).toEqual(["X-A", "X-B"]);
    await expect.poll(() => readPopupState(extension.extensionPage)).toEqual({
      activeTab: "headers",
      sortingByProfile: {}
    });

    await clickSort(request, "Header");
    await clickSort(request, "Header");
    await request.locator(".header").first().fill("X-Z");
    await request.locator(".header").first().press("Tab");
    await expect.poll(() => values(request, ".header")).toEqual(["X-B", "X-Z"]);

    await clickSort(request, "On");
    await clickSort(request, "On");
    await expect.poll(() => values(request, ".header")).toEqual(["X-B", "X-Z"]);
    await request.locator(".enabled").first().check();
    await expect.poll(() => values(request, ".header")).toEqual(["X-Z", "X-B"]);

    const stored = await readStoredRules(extension.extensionPage);
    expect(stored.profiles[0].rules.map((rule) => rule.id))
      .toEqual(["stored-first", "stored-second"]);
  } finally {
    await extension.close();
  }
});
