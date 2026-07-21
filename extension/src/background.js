import "./config.js";

const STORAGE_KEY = "headerOverrideRules";
const SYNC_STATUS_KEY = "headerOverrideSyncStatus";
const STORAGE_SCHEMA_VERSION = 2;
const DEFAULT_PROFILE_ID = "default";
const MAX_PROFILES = globalThis.HEADER_OVERRIDE_CONFIG.maxProfiles;
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
let syncInFlight = false;
let syncPending = false;
const RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "other"
];

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const migratedData = normalizeStorageData(stored[STORAGE_KEY], true);

  await chrome.storage.local.set({ [STORAGE_KEY]: migratedData });

  await syncAndUpdateBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await syncAndUpdateBadge();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEY]) {
    syncAndUpdateBadge();
  }
});

async function syncAndUpdateBadge() {
  syncPending = true;

  if (syncInFlight) {
    return;
  }

  syncInFlight = true;

  try {
    while (syncPending) {
      syncPending = false;

      try {
        await syncRules();
      } catch (error) {
        console.error("Failed to sync override rules.", error);
      } finally {
        await updateActionBadge();
      }
    }
  } finally {
    syncInFlight = false;

    if (syncPending) {
      await syncAndUpdateBadge();
    }
  }
}

async function syncRules() {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const data = normalizeStorageData(stored[STORAGE_KEY], false);
  const savedRules = getActiveProfile(data).rules;
  const enabledRules = savedRules.filter((rule) => rule.enabled);
  const declarativeCandidates = enabledRules
    .map((rule, index) => toDeclarativeRule(rule, index));
  const addRules = declarativeCandidates
    .filter(Boolean);
  const invalidDeclarativeCount = declarativeCandidates.length - addRules.length;

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
  } catch (error) {
    await setSyncStatus("error", `Could not clear old rules: ${error.message}`);
    throw error;
  }

  const failedDeclarativeCount = await addDeclarativeRules(addRules);
  const appliedDeclarativeCount = addRules.length - failedDeclarativeCount;
  const skippedRuleCount = invalidDeclarativeCount + failedDeclarativeCount;
  const appliedRuleCount = appliedDeclarativeCount;

  await setSyncStatus(
    skippedRuleCount > 0 ? "warning" : "ok",
    skippedRuleCount > 0 ? `${skippedRuleCount} invalid rule skipped.` : "",
    appliedRuleCount
  );
}

async function addDeclarativeRules(addRules) {
  if (addRules.length === 0) {
    return 0;
  }

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules });
    return 0;
  } catch (batchError) {
    return addRulesIndividually(addRules);
  }
}

async function updateActionBadge() {
  const stored = await chrome.storage.local.get([STORAGE_KEY, SYNC_STATUS_KEY]);
  const data = normalizeStorageData(stored[STORAGE_KEY], false);
  const savedRules = getActiveProfile(data).rules;
  const syncStatus = stored[SYNC_STATUS_KEY];
  const enabledCount = savedRules.filter((rule) => rule.enabled).length;
  const appliedCount = Number.isInteger(syncStatus?.appliedCount)
    ? syncStatus.appliedCount
    : enabledCount;
  const hasSyncError = syncStatus?.level === "error";

  await chrome.action.setBadgeBackgroundColor({ color: hasSyncError ? "#b42318" : "#115e59" });
  await chrome.action.setBadgeText({
    text: hasSyncError ? "!" : appliedCount > 0 ? String(appliedCount) : ""
  });
}

function toDeclarativeRule(rule, index) {
  const kind = getRuleKind(rule);
  const urlFilter = typeof rule.urlFilter === "string" && rule.urlFilter.trim()
    ? rule.urlFilter.trim()
    : "|http*";
  const headerAction = toHeaderAction(rule, kind);

  if (!headerAction) {
    return null;
  }

  const action = {
    type: "modifyHeaders"
  };

  if (kind === "responseHeader" || kind === "responseCookie") {
    action.responseHeaders = [headerAction];
  } else {
    action.requestHeaders = [headerAction];
  }

  return {
    id: index + 1,
    priority: 1,
    action,
    condition: {
      urlFilter,
      resourceTypes: RESOURCE_TYPES
    }
  };
}

function toHeaderAction(rule, kind) {
  if (kind === "requestCookie") {
    const cookieName = normalizeCookieName(rule.name);

    if (!cookieName) {
      return null;
    }

    return {
      header: "cookie",
      operation: "append",
      value: `${cookieName}=${String(rule.value ?? "")}`
    };
  }

  if (kind === "responseCookie") {
    const cookieName = normalizeCookieName(rule.name);

    if (!cookieName) {
      return null;
    }

    return {
      header: "Set-Cookie",
      operation: "append",
      value: buildSetCookieValue(cookieName, rule)
    };
  }

  const headerName = normalizeHeaderName(rule.header);

  if (!headerName) {
    return null;
  }

  return {
    header: headerName,
    operation: "set",
    value: String(rule.value ?? "")
  };
}

function buildSetCookieValue(name, rule) {
  const cookieParts = [`${name}=${String(rule.value ?? "")}`];
  const domain = normalizeOptionalText(rule.domain);
  const path = normalizeOptionalText(rule.path);
  const sameSite = normalizeSameSite(rule.sameSite);
  const maxAge = Number(rule.maxAge);

  if (domain) {
    cookieParts.push(`Domain=${domain}`);
  }

  if (path) {
    cookieParts.push(`Path=${path}`);
  }

  if (sameSite) {
    cookieParts.push(`SameSite=${formatSameSiteAttribute(sameSite)}`);
  }

  if (rule.session === false) {
    const maxAgeSeconds = Number.isFinite(maxAge) && maxAge > 0 ? Math.floor(maxAge) : 2592000;
    cookieParts.push(`Max-Age=${maxAgeSeconds}`);
  }

  if (Boolean(rule.secure)) {
    cookieParts.push("Secure");
  }

  return cookieParts.join("; ");
}

function normalizeHeaderName(value) {
  if (typeof value !== "string") {
    return "";
  }

  const headerName = value.trim();
  return HEADER_NAME_PATTERN.test(headerName) ? headerName : "";
}

function normalizeCookieName(value) {
  if (typeof value !== "string") {
    return "";
  }

  const name = value.trim();
  return name && !/[=;\s]/.test(name) ? name : "";
}

function normalizeOptionalText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSameSite(value) {
  return ["no_restriction", "lax", "strict"].includes(value) ? value : "";
}

function formatSameSiteAttribute(value) {
  const labels = {
    no_restriction: "None",
    lax: "Lax",
    strict: "Strict"
  };

  return labels[value] || value;
}

function getRuleKind(rule) {
  return ["requestHeader", "responseHeader", "requestCookie", "responseCookie"].includes(rule.kind)
    ? rule.kind
    : "requestHeader";
}

function normalizeStoredSameSite(value, fallback) {
  if (value === "") {
    return "";
  }

  return ["no_restriction", "lax", "strict"].includes(value) ? value : fallback;
}

function normalizeStorageData(value, includeDefaultRule) {
  const fallbackRules = includeDefaultRule ? [createDefaultRule()] : [];

  if (Array.isArray(value)) {
    return createStorageData(value);
  }

  if (!value || typeof value !== "object") {
    return createStorageData(fallbackRules);
  }

  const profiles = Array.isArray(value.profiles)
    ? value.profiles.map(normalizeProfile).filter(Boolean)
    : [];
  const normalizedProfiles = profiles.length > 0
    ? profiles
    : createStorageData(fallbackRules).profiles;
  const limitedProfiles = normalizedProfiles.slice(0, MAX_PROFILES);
  const activeProfileId = limitedProfiles.some((profile) => profile.id === value.activeProfileId)
    ? value.activeProfileId
    : limitedProfiles[0].id;

  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    activeProfileId,
    profiles: limitedProfiles
  };
}

function createStorageData(rules) {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [
      {
        id: DEFAULT_PROFILE_ID,
        name: "Default",
        rules: Array.isArray(rules) ? rules.map(normalizeRule) : []
      }
    ]
  };
}

function createDefaultRule() {
  return {
    id: crypto.randomUUID(),
    kind: "requestHeader",
    enabled: true,
    header: "X-Debug-Mode",
    value: "true",
    urlFilter: "|http*",
    comment: ""
  };
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  const id = typeof profile.id === "string" && profile.id.trim()
    ? profile.id
    : crypto.randomUUID();
  const name = typeof profile.name === "string" && profile.name.trim()
    ? profile.name.trim()
    : "Untitled";

  return {
    id,
    name,
    rules: Array.isArray(profile.rules) ? profile.rules.map(normalizeRule) : []
  };
}

function normalizeRule(rule) {
  if (!rule || typeof rule !== "object") {
    rule = {};
  }

  const kind = getRuleKind(rule);
  const normalized = {
    id: rule.id || crypto.randomUUID(),
    kind,
    enabled: Boolean(rule.enabled),
    value: rule.value || "",
    comment: rule.comment || ""
  };

  if (kind === "requestCookie" || kind === "responseCookie") {
    const isResponseCookie = kind === "responseCookie";

    return {
      ...normalized,
      name: rule.name || "",
      domain: rule.domain || "",
      path: rule.path || (isResponseCookie ? "/" : ""),
      secure: Boolean(rule.secure),
      sameSite: normalizeStoredSameSite(rule.sameSite, isResponseCookie ? "lax" : ""),
      session: rule.session !== false,
      maxAge: rule.maxAge || (isResponseCookie ? "2592000" : ""),
      urlFilter: rule.urlFilter || "|http*"
    };
  }

  return {
    ...normalized,
    header: rule.header || "",
    urlFilter: rule.urlFilter || "|http*"
  };
}

function getActiveProfile(data) {
  return data.profiles.find((profile) => profile.id === data.activeProfileId) || data.profiles[0];
}

async function addRulesIndividually(rules) {
  let failedRules = 0;

  for (const rule of rules) {
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [rule] });
    } catch (error) {
      console.warn("Skipped invalid declarative override rule.", rule, error);
      failedRules += 1;
    }
  }

  return failedRules;
}

async function setSyncStatus(level, message, appliedCount = 0) {
  await chrome.storage.local.set({
    [SYNC_STATUS_KEY]: {
      level,
      message,
      appliedCount,
      updatedAt: Date.now()
    }
  });
}
