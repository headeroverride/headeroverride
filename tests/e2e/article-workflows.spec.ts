import { expect, test } from "@playwright/test";
import {
  launchExtension,
  requestCookieRule,
  requestHeaderRule,
  responseHeaderRule,
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

test("CORS guide: a scoped response header override makes a cross-origin API response readable", async () => {
  const apiServer = await startTestServer();
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [
      responseHeaderRule({
        id: "article-cors-response-header",
        header: "Access-Control-Allow-Origin",
        value: server.origin,
        urlFilter: "*article/cors-api*"
      })
    ]);
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    const page = await extension.context.newPage();
    await page.goto(server.origin);

    const result = await page.evaluate(async (apiOrigin) => {
      const response = await fetch(`${apiOrigin}/article/cors-api`);
      return {
        status: response.status,
        body: await response.json()
      };
    }, apiServer.origin);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, source: "article-cors-api" });
  } finally {
    await extension.close();
    await apiServer.close();
  }
});

test("authentication guide: a scoped Authorization override authenticates a protected API request", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [
      requestHeaderRule({
        id: "article-auth-header",
        header: "Authorization",
        value: "Bearer article-test-token",
        urlFilter: "*article/auth*"
      })
    ]);
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    const page = await extension.context.newPage();
    await page.goto(server.origin);

    const result = await page.evaluate(async () => {
      const response = await fetch("/article/auth");
      return {
        status: response.status,
        body: await response.json()
      };
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, source: "article-auth" });
  } finally {
    await extension.close();
  }
});

test("authentication guide: a scoped request cookie authenticates a protected API request", async () => {
  const extension = await launchExtension();

  try {
    await seedRules(extension.extensionPage, [
      requestCookieRule({
        id: "article-auth-cookie",
        name: "article_session",
        value: "authenticated",
        urlFilter: "*article/auth*"
      })
    ]);
    await waitForAppliedRuleCount(extension.extensionPage, 1);

    const page = await extension.context.newPage();
    await page.goto(server.origin);

    const result = await page.evaluate(async () => {
      const response = await fetch("/article/auth");
      return {
        status: response.status,
        body: await response.json()
      };
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, source: "article-auth" });
  } finally {
    await extension.close();
  }
});
