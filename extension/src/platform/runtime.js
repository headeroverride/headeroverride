import { SYNC_RULES_MESSAGE } from "../shared/constants.js";

export async function requestRuleSync() {
  await chrome.runtime.sendMessage({ type: SYNC_RULES_MESSAGE });
}
