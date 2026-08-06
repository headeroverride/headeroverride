import { STORAGE_KEY, SYNC_STATUS_KEY } from "../shared/constants.js";
import { toDeclarativeRule } from "../shared/dnr-rules.js";
import { activeProfile, readStorageData } from "../shared/model.js";
import { replaceDynamicRules } from "../platform/declarative-net-request.js";
import { hasRequiredHostAccess } from "../platform/permissions.js";
import { readStorage, writeStorage } from "../platform/storage.js";
import { updateActionBadge } from "./badge.js";

let syncInFlight = false;
let syncPending = false;

export async function scheduleRuleSync() {
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
      await scheduleRuleSync();
    }
  }
}

async function syncRules() {
  if (!await hasRequiredHostAccess()) {
    await replaceDynamicRules([]);
    await setSyncStatus(
      "error",
      "Website access is required before override rules can be applied."
    );
    return;
  }

  const stored = await readStorage(STORAGE_KEY);
  const data = readStorageData(stored[STORAGE_KEY]);
  const enabledRules = data.rulesEnabled
    ? activeProfile(data).rules.filter((rule) => rule.enabled)
    : [];
  const candidates = enabledRules.map(toDeclarativeRule);
  const rules = candidates.filter(Boolean);

  let failedCount;
  try {
    failedCount = await replaceDynamicRules(rules);
  } catch (error) {
    await setSyncStatus("error", `Could not clear old rules: ${error.message}`);
    throw error;
  }

  const skippedCount = candidates.length - rules.length + failedCount;
  await setSyncStatus(
    skippedCount > 0 ? "warning" : "ok",
    skippedCount > 0 ? `${skippedCount} invalid rule skipped.` : "",
    rules.length - failedCount
  );
}

async function setSyncStatus(level, message, appliedCount = 0) {
  await writeStorage({
    [SYNC_STATUS_KEY]: { level, message, appliedCount, updatedAt: Date.now() }
  });
}
