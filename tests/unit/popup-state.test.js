import assert from "node:assert/strict";
import test from "node:test";

import { mergeProfiles, readProfilesJson } from "../../extension/src/popup/profile-transfer.js";
import {
  captureRuleStates,
  restoreRuleStates,
  setEveryRuleEnabled
} from "../../extension/src/popup/state.js";

const profiles = [{
  id: "default",
  name: "Default",
  rules: [{ id: "one", kind: "requestHeader", enabled: true, header: "X-One" }]
}];

test("captures, disables, and restores rule states", () => {
  const snapshot = captureRuleStates(profiles);
  const disabled = setEveryRuleEnabled(profiles, false);
  const restored = restoreRuleStates(disabled, snapshot);

  assert.equal(disabled[0].rules[0].enabled, false);
  assert.equal(restored[0].rules[0].enabled, true);
});

test("reads both profile export objects and legacy profile arrays", () => {
  assert.equal(readProfilesJson(JSON.stringify({ profiles }))[0].name, "Default");
  assert.equal(readProfilesJson(JSON.stringify(profiles))[0].name, "Default");
});

test("replaces profiles by name while preserving their local identity", () => {
  const replacement = [{
    id: "imported-id",
    name: "Default",
    rules: [{ id: "two", kind: "requestHeader", enabled: true, header: "X-Two" }]
  }];
  const result = mergeProfiles(profiles, replacement);

  assert.equal(result.error, "");
  assert.equal(result.profiles[0].id, "default");
  assert.equal(result.profiles[0].rules[0].header, "X-Two");
});
