import { POPUP_STATE_KEY } from "../shared/constants.js";
import { writeStorage } from "../platform/storage.js";

export function createQueuedStorageWriter(storageKey, getSnapshot) {
  let inFlight = false;
  let pending = false;

  async function persist() {
    inFlight = true;

    try {
      while (pending) {
        pending = false;
        await writeStorage({ [storageKey]: getSnapshot() });
      }
    } catch (error) {
      console.error("Failed to save override rules.", error);
    } finally {
      inFlight = false;
      if (pending) {
        persist();
      }
    }
  }

  return function scheduleWrite() {
    pending = true;
    if (!inFlight) {
      persist();
    }
  };
}

export async function saveSelectedTab(activeTab) {
  try {
    await writeStorage({ [POPUP_STATE_KEY]: { activeTab } });
  } catch (error) {
    console.error("Failed to save popup state.", error);
  }
}
