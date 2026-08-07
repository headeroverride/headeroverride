import { isCookieRule, readRule } from "../shared/model.js";

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
