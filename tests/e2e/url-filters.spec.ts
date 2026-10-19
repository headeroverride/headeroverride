import { expect, test as base, type Page } from "@playwright/test";
import {
  launchExtension,
  readStoredRules,
  reloadExtensionPage,
  requestCookieRule,
  requestHeaderRule,
  responseCookieRule,
  responseHeaderRule,
  seedProfiles,
  seedRules,
  waitForAppliedRuleCount,
  type ExtensionHarness,
  type OverrideRule
} from "./fixtures/extension";

const test = base.extend<{ extension: ExtensionHarness }>({
  extension: async ({}, use) => {
    const extension = await launchExtension();
    try {
      await extension.extensionPage.setViewportSize({ width: 760, height: 520 });
      await use(extension);
    } finally {
      await extension.close();
    }
  }
});

function trigger(page: Page, ruleId: string) {
  return page.locator(`.rule[data-rule-id="${ruleId}"]`)
    .getByRole("button", { name: /^Edit URL filter for / });
}

function editor(page: Page) {
  return page.getByRole("dialog", { name: /^URL filter for / });
}

async function openEditor(page: Page, ruleId: string) {
  await trigger(page, ruleId).click();
  await expect(editor(page)).toBeVisible();
  return editor(page);
}

async function savedFilter(page: Page, ruleId: string, profileId = "default") {
  const stored = await readStoredRules(page);
  return stored.profiles.find((profile) => profile.id === profileId)
    ?.rules.find((rule) => rule.id === ruleId)?.urlFilter;
}

async function appliedFilters(page: Page) {
  return page.evaluate(async () => {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    return rules.map((rule) => rule.condition.urlFilter).sort();
  });
}

async function prepare(page: Page, rules: OverrideRule[]) {
  await seedRules(page, rules);
  await reloadExtensionPage(page);
}

for (const [kind, createRule] of [
  ["request header", requestHeaderRule],
  ["response header", responseHeaderRule],
  ["request cookie", requestCookieRule],
  ["response cookie", responseCookieRule]
] as const) {
  test(`saves ${kind} URL edits only through Done and applies the saved scope`, async ({ extension }) => {
    const page = extension.extensionPage;
    const rule = createRule({ urlFilter: "*saved.example.com/*" });
    await prepare(page, [rule]);
    await waitForAppliedRuleCount(page, 1);
    if (kind.endsWith("cookie")) await page.getByRole("button", { name: /Cookies/ }).click();

    const popup = await openEditor(page, rule.id);
    const input = popup.getByRole("textbox", { name: "URL filter", exact: true });
    await input.fill("*draft.example.com/*");
    await input.press("Enter");
    await input.press("Tab");

    await expect(popup).toBeVisible();
    expect(await savedFilter(page, rule.id)).toBe("*saved.example.com/*");
    expect(await appliedFilters(page)).toEqual(["*saved.example.com/*"]);
    await expect(trigger(page, rule.id)).toHaveAttribute("title", "URL filter: *saved.example.com/*");

    await popup.getByRole("button", { name: "Done", exact: true }).click();
    await expect(popup).toBeHidden();
    await expect.poll(() => savedFilter(page, rule.id)).toBe("*draft.example.com/*");
    await expect.poll(() => appliedFilters(page)).toEqual(["*draft.example.com/*"]);
    await expect(trigger(page, rule.id)).toHaveAttribute("title", "URL filter: *draft.example.com/*");
    await expect(trigger(page, rule.id)).toBeFocused();

    await reloadExtensionPage(page);
    await openEditor(page, rule.id);
    await expect(editor(page).getByRole("textbox", { name: "URL filter", exact: true }))
      .toHaveValue("*draft.example.com/*");
  });
}

test("keeps scope changes local until Done and normalizes an empty custom filter", async ({ extension }) => {
  const page = extension.extensionPage;
  const rule = requestHeaderRule({ urlFilter: "*saved.example.com/*" });
  await prepare(page, [rule]);
  const popup = await openEditor(page, rule.id);
  const input = popup.getByRole("textbox", { name: "URL filter", exact: true });

  await input.fill("*draft.example.com/*");
  await popup.getByRole("button", { name: "All websites", exact: true }).click();
  await expect(input).toBeHidden();
  await expect(popup.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  expect(await savedFilter(page, rule.id)).toBe("*saved.example.com/*");
  await expect(trigger(page, rule.id)).toHaveClass(/is-custom/);

  await popup.getByRole("button", { name: "Custom URL", exact: true }).click();
  await expect(input).toHaveValue("*draft.example.com/*");
  await popup.getByRole("button", { name: "All websites", exact: true }).click();
  await popup.getByRole("button", { name: "Done", exact: true }).click();
  await expect.poll(() => savedFilter(page, rule.id)).toBe("|http*");
  await expect(trigger(page, rule.id)).not.toHaveClass(/is-custom/);
  await expect(trigger(page, rule.id)).toHaveAttribute("title", "Applies to all websites");

  await openEditor(page, rule.id);
  await expect(popup.getByRole("button", { name: "All websites", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await popup.getByRole("button", { name: "Custom URL", exact: true }).click();
  await input.fill("");
  await popup.getByRole("button", { name: "Done", exact: true }).click();
  await expect(popup).toBeHidden();
  expect(await savedFilter(page, rule.id)).toBe("|http*");
  await reloadExtensionPage(page);
  await expect(trigger(page, rule.id)).not.toHaveClass(/is-custom/);
});

test("discards URL drafts on close, Escape, outside clicks, and switching rules", async ({ extension }) => {
  const page = extension.extensionPage;
  const first = requestHeaderRule({ id: "first", urlFilter: "*first.example.com/*" });
  const second = requestHeaderRule({ id: "second", urlFilter: "*second.example.com/*" });
  // Keep the other trigger above the open popup so switching is a real click.
  await prepare(page, [second, first]);
  await waitForAppliedRuleCount(page, 2);
  const stored = await readStoredRules(page);
  const applied = await appliedFilters(page);

  for (const dismiss of ["close", "escape", "outside", "keyboard-outside", "trigger", "switch"] as const) {
    const popup = await openEditor(page, first.id);
    await popup.getByRole("textbox", { name: "URL filter", exact: true }).fill(`*${dismiss}.example.com/*`);
    if (dismiss === "close") await popup.getByRole("button", { name: "Close URL filter", exact: true }).click();
    if (dismiss === "escape") await page.keyboard.press("Escape");
    if (dismiss === "outside") await page.getByRole("heading", { name: "Header Override", exact: true }).click();
    if (dismiss === "keyboard-outside") {
      const profiles = page.getByRole("button", { name: "Profiles", exact: true });
      await profiles.focus();
      await profiles.press("Enter");
      await expect(popup).toBeHidden();
      await page.keyboard.press("Escape");
    }
    if (dismiss === "trigger") await trigger(page, first.id).click();
    if (dismiss === "switch") {
      await trigger(page, second.id).click();
      await expect(editor(page).getByRole("textbox", { name: "URL filter", exact: true }))
        .toHaveValue(second.urlFilter);
      await editor(page).getByRole("button", { name: "Close URL filter", exact: true }).click();
    }
    await expect(editor(page)).toBeHidden();
    expect(await readStoredRules(page)).toEqual(stored);
    expect(await appliedFilters(page)).toEqual(applied);
    await openEditor(page, first.id);
    await expect(editor(page).getByRole("textbox", { name: "URL filter", exact: true }))
      .toHaveValue(first.urlFilter);
    await editor(page).getByRole("button", { name: "Close URL filter", exact: true }).click();
  }
});

test("discards drafts when changing tabs or profiles, even when profiles share a rule id", async ({ extension }) => {
  const page = extension.extensionPage;
  const first = requestHeaderRule({ id: "shared", urlFilter: "*first.example.com/*" });
  const second = requestHeaderRule({ id: "shared", urlFilter: "*second.example.com/*" });
  await seedProfiles(page, [
    { id: "first", name: "First profile", rules: [first] },
    { id: "second", name: "Second profile", rules: [second] }
  ], "first");
  await reloadExtensionPage(page);
  const stored = await readStoredRules(page);

  await openEditor(page, first.id);
  await editor(page).getByRole("textbox", { name: "URL filter", exact: true }).fill("*unsaved-tab.example/*");
  await page.getByRole("button", { name: /Cookies/ }).click();
  await expect(editor(page)).toBeHidden();
  await page.getByRole("button", { name: /Headers/ }).click();
  await openEditor(page, first.id);
  await expect(editor(page).getByRole("textbox", { name: "URL filter", exact: true })).toHaveValue(first.urlFilter);
  await editor(page).getByRole("textbox", { name: "URL filter", exact: true }).fill("*unsaved-profile.example/*");

  await page.getByRole("button", { name: "Profiles", exact: true }).click();
  await page.getByRole("menuitem", { name: "Second profile", exact: true }).click();
  await expect(editor(page)).toBeHidden();
  await openEditor(page, second.id);
  await expect(editor(page).getByRole("textbox", { name: "URL filter", exact: true })).toHaveValue(second.urlFilter);
  expect(await readStoredRules(page)).toEqual(stored);
});

test("keeps the editor open when a text selection is released outside, then dismisses on an outside press", async ({ extension }) => {
  const page = extension.extensionPage;
  const rule = requestHeaderRule({ urlFilter: "*saved.example.com/users/*" });
  await prepare(page, [rule]);
  const popup = await openEditor(page, rule.id);
  const input = popup.getByRole("textbox", { name: "URL filter", exact: true });
  await input.fill("*draft.example.com/users/*");
  const inputBox = (await input.boundingBox())!;
  const popupBox = (await popup.boundingBox())!;
  const outside = { x: popupBox.x - 16, y: inputBox.y + inputBox.height / 2 };

  await page.mouse.move(inputBox.x + inputBox.width - 8, outside.y);
  await page.mouse.down();
  await page.mouse.move(outside.x, outside.y, { steps: 10 });
  await page.mouse.up();

  expect(await input.evaluate((element: HTMLInputElement) =>
    (element.selectionEnd || 0) - (element.selectionStart || 0)
  )).toBeGreaterThan(0);
  await expect(popup).toBeVisible();
  await expect(input).toHaveValue("*draft.example.com/users/*");
  expect(await savedFilter(page, rule.id)).toBe(rule.urlFilter);

  await page.mouse.click(outside.x, outside.y);
  await expect(popup).toBeHidden();
  await openEditor(page, rule.id);
  await expect(input).toHaveValue(rule.urlFilter);
});

test("shows the original syntax hint inside the editor and aligns the compact URL header", async ({ extension }) => {
  const page = extension.extensionPage;
  await prepare(page, [requestHeaderRule(), responseHeaderRule(), requestCookieRule(), responseCookieRule()]);

  for (const [tab, ids] of [
    ["Headers", ["request-header-rule", "response-header-rule"]],
    ["Cookies", ["request-cookie-rule", "response-cookie-rule"]]
  ] as const) {
    await page.getByRole("button", { name: new RegExp(tab) }).click();
    await expect(page.locator(".rules-head").getByRole("button", { name: "URL filter syntax examples" })).toHaveCount(0);
    for (const id of ids) {
      const row = page.locator(`.rule[data-rule-id="${id}"]`);
      await expect(row.getByRole("textbox", { name: "URL filter", exact: true })).toHaveCount(0);
      const heading = row.locator("xpath=ancestor::section[1]")
        .getByRole("button", { name: /^Sort by URL;/ }).locator("span").first();
      const labelBox = (await heading.boundingBox())!;
      const buttonBox = (await trigger(page, id).boundingBox())!;
      expect(Math.abs(labelBox.x + labelBox.width / 2 - buttonBox.x - buttonBox.width / 2)).toBeLessThanOrEqual(1);

      const popup = await openEditor(page, id);
      const help = popup.getByRole("button", { name: "URL filter syntax examples", exact: true });
      await help.click();
      const hint = page.getByRole("tooltip").filter({ hasText: "URL filter syntax" });
      await expect(hint).toBeVisible();
      await expect(hint.getByText("Matches", { exact: true })).toBeVisible();
      await expect(hint.getByText("Does not match", { exact: true })).toBeVisible();
      await expect(hint.locator(".help-grid code")).toHaveText(["|https*", "*example.com*", "*api.example.com/users/*"]);
      await expect(hint.locator(".help-legend li")).toHaveText([
        "| at the start: URL starts with the filter. At the end: URL ends with it.",
        "* means any characters."
      ]);
      const hintBox = (await hint.boundingBox())!;
      expect(hintBox.x).toBeGreaterThanOrEqual(0);
      expect(hintBox.y).toBeGreaterThanOrEqual(0);
      expect(hintBox.x + hintBox.width).toBeLessThanOrEqual(760);
      expect(hintBox.y + hintBox.height).toBeLessThanOrEqual(520);
      await page.keyboard.press("Escape");
      await expect(hint).toBeHidden();
      await expect(popup).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(popup).toBeHidden();
    }
  }
});

test("updates URL sorting only after Done without changing stored manual order", async ({ extension }) => {
  const page = extension.extensionPage;
  const first = requestHeaderRule({ id: "first", urlFilter: "*a.example.com/*" });
  const second = requestHeaderRule({ id: "second", urlFilter: "*m.example.com/*" });
  await prepare(page, [first, second]);
  const request = page.locator(".rule-section").filter({
    has: page.getByRole("heading", { name: "Request", exact: true })
  });
  const ids = () => request.locator(".rule").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-rule-id")));
  const sort = request.getByRole("button", { name: /^Sort by URL;/ });
  await sort.click();
  await sort.click();
  await expect.poll(ids).toEqual(["first", "second"]);

  const popup = await openEditor(page, first.id);
  await popup.getByRole("textbox", { name: "URL filter", exact: true }).fill("*z.example.com/*");
  await popup.getByRole("button", { name: "URL filter syntax examples", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(popup).toBeVisible();
  expect(await ids()).toEqual(["first", "second"]);
  expect(await savedFilter(page, first.id)).toBe(first.urlFilter);

  await popup.getByRole("button", { name: "Done", exact: true }).click();
  await expect.poll(ids).toEqual(["second", "first"]);
  await expect(trigger(page, first.id)).toBeFocused();
  await expect.poll(() => savedFilter(page, first.id)).toBe("*z.example.com/*");
  expect((await readStoredRules(page)).profiles[0].rules.map((rule) => rule.id)).toEqual(["first", "second"]);
  await sort.click();
  await expect.poll(ids).toEqual(["first", "second"]);
});
