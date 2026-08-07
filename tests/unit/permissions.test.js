import assert from "node:assert/strict";
import test from "node:test";

import {
  getHostAccessState,
  hasRequiredHostAccess,
  HOST_ACCESS_ALL,
  HOST_ACCESS_LIMITED,
  HOST_ACCESS_NONE,
  requestRequiredHostAccess
} from "../../extension/src/platform/permissions.js";

test("treats host access as available when the permissions API is unavailable", async () => {
  const originalChrome = globalThis.chrome;

  try {
    delete globalThis.chrome;
    assert.equal(await getHostAccessState(), HOST_ACCESS_ALL);
    assert.equal(await hasRequiredHostAccess(), true);
  } finally {
    globalThis.chrome = originalChrome;
  }
});

test("distinguishes all, limited, and missing host access", async () => {
  const originalChrome = globalThis.chrome;
  let origins = ["<all_urls>"];

  try {
    globalThis.chrome = {
      permissions: {
        getAll: async () => ({ permissions: ["storage"], origins })
      }
    };

    assert.equal(await getHostAccessState(), HOST_ACCESS_ALL);
    origins = ["https://example.com/*"];
    assert.equal(await getHostAccessState(), HOST_ACCESS_LIMITED);
    origins = [];
    assert.equal(await getHostAccessState(), HOST_ACCESS_NONE);
  } finally {
    globalThis.chrome = originalChrome;
  }
});

test("requests access to all URLs", async () => {
  const originalChrome = globalThis.chrome;
  const calls = [];

  try {
    globalThis.chrome = {
      permissions: {
        getAll: async () => {
          calls.push(["getAll"]);
          return { origins: ["<all_urls>"] };
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
      ["getAll"]
    ]);
  } finally {
    globalThis.chrome = originalChrome;
  }
});
