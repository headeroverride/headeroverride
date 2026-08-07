import assert from "node:assert/strict";
import test from "node:test";

import { MAX_PROFILES, STORAGE_SCHEMA_VERSION } from "../../extension/src/shared/constants.js";
import {
  activeProfile,
  readRule,
  readStorageData,
  validCookieName,
  validHeaderName
} from "../../extension/src/shared/model.js";

test("reads legacy rule arrays into the current storage schema", () => {
  const data = readStorageData([{
    id: "legacy",
    kind: "requestHeader",
    enabled: true,
    header: "X-Legacy",
    value: "yes"
  }]);

  assert.equal(data.schemaVersion, STORAGE_SCHEMA_VERSION);
  assert.equal(data.activeProfileId, "default");
  assert.equal(activeProfile(data).rules[0].header, "X-Legacy");
});

test("uses one rule reader for header and cookie defaults", () => {
  assert.deepEqual(
    readRule({ id: "header", kind: "responseHeader", operation: "unknown" }),
    {
      id: "header",
      kind: "responseHeader",
      enabled: false,
      value: "",
      comment: "",
      header: "",
      operation: "set",
      urlFilter: "|http*"
    }
  );

  const cookie = readRule({ id: "cookie", kind: "responseCookie" });
  assert.equal(cookie.path, "/");
  assert.equal(cookie.sameSite, "lax");
  assert.equal(cookie.maxAge, "2592000");
});

test("limits stored profiles and repairs an unknown active profile", () => {
  const profiles = Array.from({ length: MAX_PROFILES + 2 }, (_, index) => ({
    id: `profile-${index}`,
    name: `Profile ${index}`,
    rules: []
  }));
  const data = readStorageData({ activeProfileId: "missing", profiles });

  assert.equal(data.profiles.length, MAX_PROFILES);
  assert.equal(data.activeProfileId, "profile-0");
});

test("validates HTTP header and cookie names without changing stored values", () => {
  assert.equal(validHeaderName(" X-Debug "), "X-Debug");
  assert.equal(validHeaderName("bad header"), "");
  assert.equal(validCookieName(" session_id "), "session_id");
  assert.equal(validCookieName("bad=name"), "");
});
