export async function readStorage(keys) {
  return chrome.storage.local.get(keys);
}

export async function writeStorage(values) {
  await chrome.storage.local.set(values);
}
