import { REQUIRED_HOST_ORIGINS } from "../shared/constants.js";

function permissionRequest() {
  return { origins: [...REQUIRED_HOST_ORIGINS] };
}

export async function hasRequiredHostAccess() {
  if (!globalThis.chrome?.permissions?.contains) {
    return true;
  }

  return chrome.permissions.contains(permissionRequest());
}

export async function requestRequiredHostAccess() {
  if (!globalThis.chrome?.permissions?.request) {
    return false;
  }

  const granted = await chrome.permissions.request(permissionRequest());
  return Boolean(granted) && hasRequiredHostAccess();
}
