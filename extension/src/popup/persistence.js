import { writeStorage } from "../platform/storage.js";

export function createQueuedStorageWriter(storageKey, getSnapshot, errorMessage = "Failed to save override rules.") {
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
      console.error(errorMessage, error);
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
