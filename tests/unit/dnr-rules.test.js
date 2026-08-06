import assert from "node:assert/strict";
import test from "node:test";

import { toDeclarativeRule } from "../../extension/src/shared/dnr-rules.js";

test("compiles a request header rule", () => {
  const compiled = toDeclarativeRule({
    kind: "requestHeader",
    header: "X-Debug",
    operation: "set",
    value: "on",
    urlFilter: "example.com"
  }, 2);

  assert.equal(compiled.id, 3);
  assert.deepEqual(compiled.action.requestHeaders, [{
    header: "X-Debug",
    operation: "set",
    value: "on"
  }]);
  assert.equal(compiled.condition.urlFilter, "example.com");
});

test("rejects invalid header and cookie names", () => {
  assert.equal(toDeclarativeRule({ kind: "requestHeader", header: "bad header" }, 0), null);
  assert.equal(toDeclarativeRule({ kind: "requestCookie", name: "bad=name" }, 0), null);
});

test("compiles persistent response cookie attributes", () => {
  const compiled = toDeclarativeRule({
    kind: "responseCookie",
    name: "session_id",
    value: "abc",
    domain: "example.com",
    path: "/account",
    sameSite: "strict",
    session: false,
    maxAge: "60",
    secure: true
  }, 0);

  assert.equal(
    compiled.action.responseHeaders[0].value,
    "session_id=abc; Domain=example.com; Path=/account; SameSite=Strict; Max-Age=60; Secure"
  );
});
