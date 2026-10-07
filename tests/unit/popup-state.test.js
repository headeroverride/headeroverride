import assert from "node:assert/strict";
import test from "node:test";

import { mergeProfiles, readProfilesJson } from "../../extension/src/popup/profile-transfer.js";
import {
  captureRuleStates,
  reorderRulesWithinKind,
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

test("reorders one rule kind while preserving interleaved rule positions", () => {
  const rules = [
    { id: "request-one", kind: "requestHeader" },
    { id: "response-one", kind: "responseHeader" },
    { id: "request-two", kind: "requestHeader" },
    { id: "cookie-one", kind: "requestCookie" },
    { id: "request-three", kind: "requestHeader" }
  ];

  const movedUp = reorderRulesWithinKind(rules, "requestHeader", [
    "request-three",
    "request-one",
    "request-two"
  ]);
  assert.deepEqual(movedUp.map((rule) => rule.id), [
    "request-three",
    "response-one",
    "request-one",
    "cookie-one",
    "request-two"
  ]);

  const movedDown = reorderRulesWithinKind(movedUp, "requestHeader", [
    "request-one",
    "request-two",
    "request-three"
  ]);
  assert.deepEqual(movedDown.map((rule) => rule.id), rules.map((rule) => rule.id));
});

test("returns the original rules for unchanged or invalid reorder requests", () => {
  const rules = [
    { id: "one", kind: "requestHeader" },
    { id: "two", kind: "requestHeader" }
  ];

  assert.equal(reorderRulesWithinKind(rules, "requestHeader", ["one", "two"]), rules);
  assert.equal(reorderRulesWithinKind(rules, "requestHeader", ["one"]), rules);
  assert.equal(reorderRulesWithinKind(rules, "requestHeader", ["one", "missing"]), rules);
  assert.equal(reorderRulesWithinKind(rules, "requestHeader", ["one", "one"]), rules);
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
