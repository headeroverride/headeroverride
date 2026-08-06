import assert from "node:assert/strict";
import test from "node:test";

import {
  hasRequiredHostAccess,
  requestRequiredHostAccess
} from "../../extension/src/platform/permissions.js";

test("treats host access as available when the permissions API is unavailable", async () => {
  const originalChrome = globalThis.chrome;

  try {
    delete globalThis.chrome;
    assert.equal(await hasRequiredHostAccess(), true);
  } finally {
    globalThis.chrome = originalChrome;
  }
});

test("checks and requests access to all URLs", async () => {
  const originalChrome = globalThis.chrome;
  const calls = [];

  try {
    globalThis.chrome = {
      permissions: {
        contains: async (permission) => {
          calls.push(["contains", permission]);
          return true;
        },
        request: async (permission) => {
          calls.push(["request", permission]);
          return true;
        }
      }
    };

    assert.equal(await requestRequiredHostAccess(), true);
    assert.deepEqual(calls, [
      ["request", { origins: ["<all_urls>"] }],
      ["contains", { origins: ["<all_urls>"] }]
    ]);
  } finally {
    globalThis.chrome = originalChrome;
  }
});
