export const STORAGE_KEY = "headerOverrideRules";
export const POPUP_STATE_KEY = "headerOverridePopupState";
export const SYNC_STATUS_KEY = "headerOverrideSyncStatus";
export const STORAGE_SCHEMA_VERSION = 5;
export const DEFAULT_PROFILE_ID = "default";
export const MAX_PROFILES = 5;

export const RULE_KINDS = Object.freeze([
  "requestHeader",
  "responseHeader",
  "requestCookie",
  "responseCookie"
]);

export const RESOURCE_TYPES = Object.freeze([
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
]);
