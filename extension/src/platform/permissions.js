import { REQUIRED_HOST_ORIGINS } from "../shared/constants.js";

export const HOST_ACCESS_ALL = "all";
export const HOST_ACCESS_LIMITED = "limited";
export const HOST_ACCESS_NONE = "none";

function permissionRequest() {
  return { origins: [...REQUIRED_HOST_ORIGINS] };
}

export async function getHostAccessState() {
  if (globalThis.chrome?.permissions?.getAll) {
    const permissions = await chrome.permissions.getAll();
    const origins = Array.isArray(permissions?.origins) ? permissions.origins : [];

    if (REQUIRED_HOST_ORIGINS.every((origin) => origins.includes(origin))) {
      return HOST_ACCESS_ALL;
    }

    return origins.length > 0 ? HOST_ACCESS_LIMITED : HOST_ACCESS_NONE;
  }

  if (globalThis.chrome?.permissions?.contains) {
    return await chrome.permissions.contains(permissionRequest())
      ? HOST_ACCESS_ALL
      : HOST_ACCESS_NONE;
  }

  return HOST_ACCESS_ALL;
}

export async function hasRequiredHostAccess() {
  return await getHostAccessState() === HOST_ACCESS_ALL;
}

export async function requestRequiredHostAccess() {
  if (!globalThis.chrome?.permissions?.request) {
    return false;
  }

  const granted = await chrome.permissions.request(permissionRequest());
  return Boolean(granted) && hasRequiredHostAccess();
}
