import {
  DEFAULT_PROFILE_ID,
  MAX_PROFILES,
  RULE_KINDS,
  STORAGE_SCHEMA_VERSION
} from "./constants.js";

const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const HEADER_OPERATIONS = ["set", "remove"];
const COOKIE_OPERATIONS = ["add", "delete"];
const SAME_SITE_VALUES = ["no_restriction", "lax", "strict"];

function objectOrEmpty(value) {
  return value && typeof value === "object" ? value : {};
}

function text(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function ruleKind(rule) {
  return oneOf(rule?.kind, RULE_KINDS, "requestHeader");
}

export function isCookieRule(ruleOrKind) {
  const kind = typeof ruleOrKind === "string" ? ruleOrKind : ruleKind(ruleOrKind);
  return kind === "requestCookie" || kind === "responseCookie";
}

export function readRule(value) {
  const rule = objectOrEmpty(value);
  const kind = ruleKind(rule);
  const common = {
    id: text(rule.id) || crypto.randomUUID(),
    kind,
    enabled: Boolean(rule.enabled),
    value: text(rule.value),
    comment: text(rule.comment)
  };

  if (isCookieRule(kind)) {
    const isResponse = kind === "responseCookie";
    const sameSiteFallback = isResponse ? "lax" : "";
    const sameSite = rule.sameSite === ""
      ? ""
      : oneOf(rule.sameSite, SAME_SITE_VALUES, sameSiteFallback);

    return {
      ...common,
      name: text(rule.name),
      domain: text(rule.domain),
      path: text(rule.path) || (isResponse ? "/" : ""),
      secure: Boolean(rule.secure),
      sameSite,
      session: rule.session !== false,
      maxAge: text(rule.maxAge) || (isResponse ? "2592000" : ""),
      operation: isResponse ? oneOf(rule.operation, COOKIE_OPERATIONS, "add") : "add",
      urlFilter: text(rule.urlFilter) || "|http*"
    };
  }

  return {
    ...common,
    header: text(rule.header),
    operation: oneOf(rule.operation, HEADER_OPERATIONS, "set"),
    urlFilter: text(rule.urlFilter) || "|http*"
  };
}

export function readProfile(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return {
    id: text(value.id).trim() || crypto.randomUUID(),
    name: text(value.name).trim() || "Untitled",
    rules: Array.isArray(value.rules) ? value.rules.map(readRule) : []
  };
}

export function createStorageData(rules = []) {
  const storedRules = Array.isArray(rules) ? rules.map(readRule) : [];

  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    rulesEnabled: storedRules.length === 0 || storedRules.some((rule) => rule.enabled),
    masterToggleSnapshot: null,
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [{ id: DEFAULT_PROFILE_ID, name: "Default", rules: storedRules }]
  };
}

export function createDefaultRule() {
  return readRule({
    kind: "requestHeader",
    enabled: true,
    header: "X-Debug-Mode",
    value: "true",
    urlFilter: "|http*"
  });
}

export function readStorageData(value, { includeDefaultRule = false } = {}) {
  const fallbackRules = includeDefaultRule ? [createDefaultRule()] : [];

  if (Array.isArray(value)) {
    return createStorageData(value);
  }

  if (!value || typeof value !== "object") {
    return createStorageData(fallbackRules);
  }

  const profiles = Array.isArray(value.profiles)
    ? value.profiles.map(readProfile).filter(Boolean).slice(0, MAX_PROFILES)
    : [];
  const finalProfiles = profiles.length > 0 ? profiles : createStorageData(fallbackRules).profiles;
  const activeProfileId = finalProfiles.some((profile) => profile.id === value.activeProfileId)
    ? value.activeProfileId
    : finalProfiles[0].id;
  const activeProfile = finalProfiles.find((profile) => profile.id === activeProfileId);

  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    rulesEnabled: typeof value.rulesEnabled === "boolean"
      ? value.rulesEnabled
      : activeProfile.rules.length === 0 || activeProfile.rules.some((rule) => rule.enabled),
    masterToggleSnapshot: value.masterToggleSnapshot && typeof value.masterToggleSnapshot === "object"
      ? value.masterToggleSnapshot
      : null,
    activeProfileId,
    profiles: finalProfiles
  };
}

export function activeProfile(data) {
  return data.profiles.find((profile) => profile.id === data.activeProfileId) || data.profiles[0];
}

export function validHeaderName(value) {
  if (typeof value !== "string") {
    return "";
  }

  const name = value.trim();
  return HEADER_NAME_PATTERN.test(name) ? name : "";
}

export function validCookieName(value) {
  if (typeof value !== "string") {
    return "";
  }

  const name = value.trim();
  return name && !/[=;\s]/.test(name) ? name : "";
}
