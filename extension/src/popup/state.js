import { isCookieRule, readRule, ruleKind } from "../shared/model.js";

export function setEveryRuleEnabled(profiles, enabled) {
  return profiles.map((profile) => ({
    ...profile,
    rules: profile.rules.map((rule) => readRule({ ...rule, enabled }))
  }));
}

export function captureRuleStates(profiles) {
  return Object.fromEntries(profiles.map((profile) => [
    profile.id,
    Object.fromEntries(profile.rules.map((rule) => [rule.id, rule.enabled]))
  ]));
}

export function restoreRuleStates(profiles, snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return profiles;
  }

  return profiles.map((profile) => ({
    ...profile,
    rules: profile.rules.map((rule) => {
      const profileSnapshot = snapshot[profile.id];
      const enabled = profileSnapshot && Object.prototype.hasOwnProperty.call(profileSnapshot, rule.id)
        ? profileSnapshot[rule.id]
        : rule.enabled;
      return readRule({ ...rule, enabled });
    })
  }));
}

export function createRule(kind) {
  return readRule({ id: crypto.randomUUID(), kind, enabled: true });
}

export function shouldExpandNewRule(rule) {
  return isCookieRule(rule);
}

export function reorderRulesWithinKind(rules, kind, orderedRuleIds) {
  const kindIndexes = [];
  const kindRules = [];

  for (const [index, rule] of rules.entries()) {
    if (ruleKind(rule) === kind) {
      kindIndexes.push(index);
      kindRules.push(rule);
    }
  }

  if (kindRules.length !== orderedRuleIds.length) {
    return rules;
  }

  const rulesById = new Map(kindRules.map((rule) => [rule.id, rule]));
  if (rulesById.size !== kindRules.length
    || orderedRuleIds.some((id) => !rulesById.has(id))
    || new Set(orderedRuleIds).size !== orderedRuleIds.length) {
    return rules;
  }

  if (kindRules.every((rule, index) => rule.id === orderedRuleIds[index])) {
    return rules;
  }

  const reorderedRules = [...rules];
  for (const [index, ruleId] of orderedRuleIds.entries()) {
    reorderedRules[kindIndexes[index]] = rulesById.get(ruleId);
  }

  return reorderedRules;
}
