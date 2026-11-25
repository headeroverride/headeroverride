import { expect, test } from "@playwright/test";
import {
  launchExtension,
  reloadExtensionPage,
  requestCookieRule,
  requestHeaderRule,
  responseHeaderRule,
  seedProfiles,
  seedRules
} from "./fixtures/extension";

test("filters the current tab and highlights only matching fields", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [
      requestHeaderRule({ id: "auth", header: "Authorization", value: "Bearer test-token", comment: "Login header", urlFilter: "*api.example.com/*" }),
      responseHeaderRule({ id: "cors", header: "Access-Control-Allow-Origin", value: "https://app.example.com" }),
      requestCookieRule({ id: "cookie", name: "auth_session", value: "signed-in" })
    ]);
    await reloadExtensionPage(extension.extensionPage);

    const page = extension.extensionPage;
    const search = page.getByRole("searchbox", { name: "Search rules" });
    const box = await search.locator("..").boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs((box!.x + box!.width / 2) - 380)).toBeLessThan(2);
    await expect(search).not.toBeFocused();

    await search.fill("  BEARER  ");
    await expect(page.locator(".rule")).toHaveCount(1);
    await expect(page.locator(".rule[data-rule-id='auth'] .value")).toHaveClass(/search-match/);
    await expect(page.locator(".rule[data-rule-id='auth'] .header")).not.toHaveClass(/search-match/);
    await expect(page.getByRole("button", { name: /Headers\s+2/ })).toBeVisible();

    await search.fill("login");
    await expect(page.locator(".rule[data-rule-id='auth'] .comment")).toHaveClass(/search-match/);
    await search.fill("api.example");
    await expect(page.locator(".rule[data-rule-id='auth'] .url-filter-trigger")).toHaveClass(/search-match/);

    await search.fill("auth");
    await expect(page.locator(".rule[data-rule-id='auth'] .header")).toHaveClass(/search-match/);
    await expect(page.locator(".rule .drag-handle")).toHaveAttribute("draggable", "false");
    await expect(page.locator(".rule .drag-handle")).toHaveAttribute("title", "Clear search to reorder rules");

    await page.getByRole("button", { name: /Cookies/ }).click();
    await expect(search).toHaveValue("auth");
    await expect(page.locator(".rule")).toHaveCount(1);
    await expect(page.locator(".rule[data-rule-id='cookie'] .name")).toHaveClass(/search-match/);
    await expect(page.getByRole("button", { name: /Cookies\s+1/ })).toBeVisible();

    await search.fill("no-such-rule");
    await expect(page.getByText("No matching rules.")).toBeVisible();
    await expect(page.locator(".rule-section")).toHaveCount(0);
    await search.press("Escape");
    await expect(search).toHaveValue("");
    await expect(page.locator(".rule")).toHaveCount(1);
    await expect(page.locator(".rule .drag-handle")).toHaveAttribute("draggable", "true");
  } finally {
    await extension.close();
  }
});

test("keeps search within the viewed profile and refreshes after editing", async () => {
  const extension = await launchExtension();

  try {
    await seedProfiles(extension.extensionPage, [
      { id: "one", name: "One", rules: [requestHeaderRule({ id: "first", header: "X-Target" })] },
      { id: "two", name: "Two", rules: [requestHeaderRule({ id: "second", header: "X-Other" })] }
    ], "one");
    await reloadExtensionPage(extension.extensionPage);

    const page = extension.extensionPage;
    const search = page.getByRole("searchbox", { name: "Search rules" });
    await search.fill("target");
    await expect(page.locator(".rule[data-rule-id='first']")).toBeVisible();
    await page.getByRole("button", { name: "Profiles" }).click();
    await page.getByRole("menuitem", { name: "Two", exact: true }).click();
    await expect(search).toHaveValue("target");
    await expect(page.getByText("No matching rules.")).toBeVisible();

    await search.fill("other");
    const header = page.locator(".rule[data-rule-id='second'] .header");
    await expect(header).toHaveClass(/search-match/);
    await header.fill("X-Renamed");
    await header.blur();
    await expect(page.getByText("No matching rules.")).toBeVisible();

    await search.fill("renamed");
    await expect(page.locator(".rule[data-rule-id='second']")).toBeVisible();
    await page.getByRole("button", { name: "Add request header" }).click();
    await expect(search).toHaveValue("");
    await expect(page.locator(".rule")).toHaveCount(2);
    await expect(page.locator(".rule").last().locator(".header")).toBeFocused();
  } finally {
    await extension.close();
  }
});
