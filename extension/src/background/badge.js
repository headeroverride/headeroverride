import { STORAGE_KEY, SYNC_STATUS_KEY } from "../shared/constants.js";
import { activeProfile, readStorageData } from "../shared/model.js";
import { readStorage } from "../platform/storage.js";

export async function updateActionBadge() {
  const stored = await readStorage([STORAGE_KEY, SYNC_STATUS_KEY]);
  const data = readStorageData(stored[STORAGE_KEY]);
  const enabledCount = data.rulesEnabled
    ? activeProfile(data).rules.filter((rule) => rule.enabled).length
    : 0;
  const syncStatus = stored[SYNC_STATUS_KEY];
  const appliedCount = Number.isInteger(syncStatus?.appliedCount)
    ? syncStatus.appliedCount
    : enabledCount;
  const hasSyncError = syncStatus?.level === "error";

  await chrome.action.setBadgeBackgroundColor({ color: hasSyncError ? "#b42318" : "#115e59" });
  await chrome.action.setBadgeText({
    text: hasSyncError ? "!" : appliedCount > 0 ? String(appliedCount) : ""
  });
}
