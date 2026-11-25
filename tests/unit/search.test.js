import assert from "node:assert/strict";
import test from "node:test";

import { getRuleSearchMatches, normalizeSearchQuery } from "../../extension/src/popup/search.js";

test("normalizes and matches searchable rule fields without case sensitivity", () => {
  assert.equal(normalizeSearchQuery("  AuTh  "), "auth");
  assert.deepEqual(getRuleSearchMatches({
    header: "Authorization",
    value: "Bearer auth-token",
    comment: "Auth for API",
    urlFilter: "*auth.example.com/*"
  }, "  AUTH  "), {
    header: true,
    name: false,
    value: true,
    comment: true,
    url: true,
    matched: true
  });
});

test("matches cookie name and regex URL but excludes cookie details", () => {
  const cookie = {
    name: "session_id",
    value: "abc",
    comment: "Login",
    urlFilter: "|http*",
    regexFilter: "^https://api.example.com/",
    domain: "private.example.com",
    path: "/private",
    sameSite: "strict"
  };

  assert.equal(getRuleSearchMatches(cookie, "session").name, true);
  assert.equal(getRuleSearchMatches(cookie, "api.example").url, true);
  assert.equal(getRuleSearchMatches({ ...cookie, urlFilter: "*hidden.example.com/*" }, "hidden").matched, false);
  assert.equal(getRuleSearchMatches(cookie, "private").matched, false);
  assert.equal(getRuleSearchMatches(cookie, "strict").matched, false);
  assert.equal(getRuleSearchMatches(cookie, " ").matched, true);
});
