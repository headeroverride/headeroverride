import { STORAGE_KEY, SYNC_RULES_MESSAGE } from "../shared/constants.js";
import { readStorageData } from "../shared/model.js";
import { readStorage, writeStorage } from "../platform/storage.js";
import { scheduleRuleSync } from "./sync.js";

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await readStorage(STORAGE_KEY);
  const migratedData = readStorageData(stored[STORAGE_KEY], { includeDefaultRule: true });

  await writeStorage({ [STORAGE_KEY]: migratedData });
  await scheduleRuleSync();
});

chrome.runtime.onStartup.addListener(scheduleRuleSync);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEY]) {
    scheduleRuleSync();
  }
});

chrome.permissions?.onAdded?.addListener(scheduleRuleSync);
chrome.permissions?.onRemoved?.addListener(scheduleRuleSync);

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === SYNC_RULES_MESSAGE) {
    scheduleRuleSync();
  }
});
