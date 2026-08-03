import { expect, test, type Page } from "@playwright/test";
import { launchExtension } from "./fixtures/extension";

async function readTheme(page: Page) {
  return page.evaluate(() => {
    const rootStyles = getComputedStyle(document.documentElement);
    const bodyStyles = getComputedStyle(document.body);

    return {
      colorScheme: rootStyles.colorScheme,
      background: bodyStyles.backgroundColor,
      text: bodyStyles.color,
      prefersDark: matchMedia("(prefers-color-scheme: dark)").matches
    };
  });
}

test("uses the light theme when the browser prefers light", async () => {
  const extension = await launchExtension();

  try {
    await extension.extensionPage.emulateMedia({ colorScheme: "light" });

    await expect.poll(() => readTheme(extension.extensionPage)).toEqual({
      colorScheme: "light",
      background: "rgb(247, 248, 251)",
      text: "rgb(27, 36, 48)",
      prefersDark: false
    });
  } finally {
    await extension.close();
  }
});

test("switches automatically when the browser prefers dark", async () => {
  const extension = await launchExtension();

  try {
    await extension.extensionPage.emulateMedia({ colorScheme: "light" });
    await expect.poll(() => readTheme(extension.extensionPage)).toMatchObject({
      colorScheme: "light",
      prefersDark: false
    });

    await extension.extensionPage.emulateMedia({ colorScheme: "dark" });

    await expect.poll(() => readTheme(extension.extensionPage)).toEqual({
      colorScheme: "dark",
      background: "rgb(17, 22, 29)",
      text: "rgb(237, 241, 245)",
      prefersDark: true
    });
  } finally {
    await extension.close();
  }
});
