import { RESOURCE_TYPES } from "./constants.js";
import { ruleKind, validCookieName, validHeaderName } from "./model.js";

const SAME_SITE_LABELS = {
  no_restriction: "None",
  lax: "Lax",
  strict: "Strict"
};

function optionalText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function toDeclarativeRule(rule, index) {
  const kind = ruleKind(rule);
  const headerAction = toHeaderAction(rule, kind);

  if (!headerAction) {
    return null;
  }

  const action = { type: "modifyHeaders" };
  const direction = kind === "responseHeader" || kind === "responseCookie"
    ? "responseHeaders"
    : "requestHeaders";
  action[direction] = [headerAction];

  return {
    id: index + 1,
    priority: 1,
    action,
    condition: {
      urlFilter: optionalText(rule.urlFilter) || "|http*",
      resourceTypes: RESOURCE_TYPES
    }
  };
}

function toHeaderAction(rule, kind) {
  if (kind === "requestCookie") {
    const name = validCookieName(rule.name);
    return name ? {
      header: "cookie",
      operation: "append",
      value: `${name}=${String(rule.value ?? "")}`
    } : null;
  }

  if (kind === "responseCookie") {
    const name = validCookieName(rule.name);
    if (!name) {
      return null;
    }

    return {
      header: "Set-Cookie",
      operation: "append",
      value: rule.operation === "delete"
        ? deleteCookieValue(name, rule)
        : setCookieValue(name, rule)
    };
  }

  const header = validHeaderName(rule.header);
  if (!header) {
    return null;
  }

  const operation = rule.operation === "remove" ? "remove" : "set";
  return {
    header,
    operation,
    ...(operation === "remove" ? {} : { value: String(rule.value ?? "") })
  };
}

function deleteCookieValue(name, rule) {
  return cookieAttributes(`${name}=`, rule, ["domain", "path"]).concat("Max-Age=0").join("; ");
}

function setCookieValue(name, rule) {
  const parts = cookieAttributes(`${name}=${String(rule.value ?? "")}`, rule, ["domain", "path"]);
  const sameSite = SAME_SITE_LABELS[rule.sameSite];

  if (sameSite) {
    parts.push(`SameSite=${sameSite}`);
  }

  if (rule.session === false) {
    const maxAge = Number(rule.maxAge);
    parts.push(`Max-Age=${Number.isFinite(maxAge) && maxAge > 0 ? Math.floor(maxAge) : 2592000}`);
  }

  if (rule.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function cookieAttributes(firstPart, rule, names) {
  const parts = [firstPart];

  for (const name of names) {
    const value = optionalText(rule[name]);
    if (value) {
      parts.push(`${name[0].toUpperCase()}${name.slice(1)}=${value}`);
    }
  }

  return parts;
}
