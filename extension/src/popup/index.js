import {
  MAX_PROFILES,
  POPUP_STATE_KEY,
  STORAGE_KEY,
  STORAGE_SCHEMA_VERSION
} from "../shared/constants.js";
import {
  createStorageData,
  readRule,
  readStorageData,
  ruleKind
} from "../shared/model.js";
import { createProfilesExport, mergeProfiles, readProfilesJson } from "./profile-transfer.js";
import { readStorage, writeStorage } from "../platform/storage.js";
import { createQueuedStorageWriter, saveSelectedTab } from "./persistence.js";
import { createRuleListView } from "./views/rule-list-view.js";
import {
  captureRuleStates,
  createRule,
  restoreRuleStates,
  setEveryRuleEnabled,
  shouldExpandNewRule
} from "./state.js";
const rulesContainer = document.querySelector("#rules");
const headerTemplate = document.querySelector("#header-rule-template");
const cookieTemplate = document.querySelector("#cookie-rule-template");
const urlHelpTemplate = document.querySelector("#url-help-template");
const profileMenuButton = document.querySelector("#profile-menu-button");
const profileMenu = document.querySelector("#profile-menu");
const profileCurrent = document.querySelector("#profile-current");
const globalRulesToggle = document.querySelector("#global-rules-toggle");
const tabs = Array.from(document.querySelectorAll(".tab"));
const countNodes = Array.from(document.querySelectorAll("[data-count]"));
const importProfilesInput = document.createElement("input");

importProfilesInput.type = "file";
importProfilesInput.accept = "application/json,.json";
importProfilesInput.hidden = true;
document.body.append(importProfilesInput);

let activeTab = "headers";
let storageData = createStorageData([]);
let profiles = storageData.profiles;
let activeProfileId = storageData.activeProfileId;
let viewedProfileId = activeProfileId;
let rules = [];
let rulesEnabled = true;
let masterToggleSnapshot = null;
const expandedCookieDetails = new Set();
const ruleListView = createRuleListView({
  rulesContainer,
  headerTemplate,
  cookieTemplate,
  urlHelpTemplate,
  tabs,
  countNodes,
  expandedCookieDetails,
  onUpdateRule: updateRule,
  onDeleteRule: deleteRule
});
let isAddingProfile = false;
let profileMenuMode = "list";
let importableProfiles = [];
let importProfilesError = "";
let pendingDeleteProfileId = "";
const saveNow = createQueuedStorageWriter(STORAGE_KEY, () => {
  updateViewedProfileRules(rules);
  return toStorageData();
});

init();

async function init() {
  const stored = await readStorage([STORAGE_KEY, POPUP_STATE_KEY]);
  storageData = readStorageData(stored[STORAGE_KEY]);
  activeTab = readActiveTab(stored[POPUP_STATE_KEY]?.activeTab);
  profiles = storageData.profiles;
  activeProfileId = storageData.activeProfileId;
  viewedProfileId = activeProfileId;
  rulesEnabled = storageData.rulesEnabled;
  masterToggleSnapshot = storageData.masterToggleSnapshot;
  if (!rulesEnabled) {
    profiles = profiles.map((profile) => ({
      ...profile,
      rules: profile.rules.map((rule) => readRule({ ...rule, enabled: false }))
    }));
  }
  rules = getViewedProfile().rules;
  const normalizedData = toStorageData();
  if (!isSameStorageData(stored[STORAGE_KEY], normalizedData)) {
    await writeStorage({ [STORAGE_KEY]: normalizedData });
  }
  render();
}

profileMenuButton.addEventListener("click", () => {
  toggleProfileMenu(profileMenu.hidden);
});

globalRulesToggle.addEventListener("change", () => {
  rulesEnabled = globalRulesToggle.checked;
  if (rulesEnabled) {
    profiles = restoreRuleStates(profiles, masterToggleSnapshot);
    masterToggleSnapshot = null;
  } else {
    masterToggleSnapshot = captureRuleStates(profiles);
    profiles = setEveryRuleEnabled(profiles, false);
  }
  rules = getViewedProfile().rules;
  render();
  saveNow();
});

importProfilesInput.addEventListener("change", async () => {
  const file = importProfilesInput.files?.[0];
  importProfilesInput.value = "";

  if (!file) {
    return;
  }

  try {
    importableProfiles = await readProfilesFile(file);
    importProfilesError = importableProfiles.length > 0
      ? ""
      : "No profiles found in this file.";
  } catch (error) {
    importableProfiles = [];
    importProfilesError = "Could not read profiles from this file.";
  }

  profileMenuMode = "import";
  isAddingProfile = false;
  pendingDeleteProfileId = "";
  renderProfileMenu();
  toggleProfileMenu(true);
});

profileMenu.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : event.target.parentElement;
  const item = target?.closest("[data-action], [data-profile-id]");

  if (!item) {
    return;
  }

  if (handleProfileMenuAction(item)) {
    toggleProfileMenu(true);
  } else {
    toggleProfileMenu(false);
  }
});

function handleProfileMenuAction(item) {
  switch (item.dataset.action) {
    case "deleteProfile":
      pendingDeleteProfileId = item.dataset.profileId || "";
      isAddingProfile = false;
      renderProfileMenu();
      return true;

    case "cancelDeleteProfile":
      pendingDeleteProfileId = "";
      renderProfileMenu();
      return true;

    case "confirmDeleteProfile":
      deleteProfile(item.dataset.profileId);
      pendingDeleteProfileId = "";
      renderProfileMenu();
      return true;

    case "addProfile":
      return showCreateProfileForm();

    case "cancelProfile":
      isAddingProfile = false;
      renderProfileMenu();
      return true;

    case "createProfile":
      addProfileFromMenu();
      return true;

    case "activateProfile":
      switchProfile(item.dataset.profileId);
      return false;

    case "viewProfile":
      viewProfile(item.dataset.profileId);
      return false;

    case "showExportProfiles":
      showProfileTransferMenu("export");
      return true;

    case "showImportProfiles":
      importProfilesError = "";
      importableProfiles = [];
      importProfilesInput.click();
      return true;

    case "cancelProfileTransfer":
      showProfileTransferMenu("list");
      return true;

    case "exportSelectedProfiles":
      exportSelectedProfiles();
      profileMenuMode = "list";
      renderProfileMenu();
      return true;

    case "importSelectedProfiles":
      return handleImportSelectedProfiles();

    default:
      return false;
  }
}

function showCreateProfileForm() {
  if (profiles.length >= MAX_PROFILES) {
    return true;
  }

  isAddingProfile = true;
  profileMenuMode = "list";
  pendingDeleteProfileId = "";
  renderProfileMenu();
  focusProfileNameInput();
  return true;
}

function showProfileTransferMenu(mode) {
  profileMenuMode = mode;
  isAddingProfile = false;
  pendingDeleteProfileId = "";

  if (mode === "list") {
    importableProfiles = [];
    importProfilesError = "";
  }

  renderProfileMenu();
}

function handleImportSelectedProfiles() {
  if (importSelectedProfiles()) {
    profileMenuMode = "list";
    importableProfiles = [];
    importProfilesError = "";
    render();
    saveNow();
  } else {
    renderProfileMenu();
  }

  return true;
}

for (const tab of tabs) {
  tab.addEventListener("click", () => {
    activeTab = readActiveTab(tab.dataset.tab);
    ruleListView.closeHelp();
    render();
    saveSelectedTab(activeTab);
  });
}

document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".url-heading")) {
    ruleListView.closeHelp();
  }

  if (!event.target.closest(".profile-menu")) {
    toggleProfileMenu(false);
  }
});

rulesContainer.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : event.target.parentElement;
  const addButton = target?.closest("[data-action='add-rule']");

  if (!addButton) {
    return;
  }

  const kind = ruleKind({ kind: addButton.dataset.kind });
  rules = [...rules, createRuleForKind(kind)];
  updateViewedProfileRules(rules);
  render();
  saveNow();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    isAddingProfile = false;
    profileMenuMode = "list";
    importableProfiles = [];
    importProfilesError = "";
    pendingDeleteProfileId = "";
    ruleListView.closeHelp();
    toggleProfileMenu(false);
    renderProfileMenu();
  }
});

function render() {
  const rulesChanged = syncRulesToMasterState();
  renderGlobalRulesToggle();
  renderCurrentProfile();
  renderProfileMenu();
  ruleListView.render(rules, activeTab);
  if (rulesChanged) {
    saveNow();
  }
}

function syncRulesToMasterState() {
  if (rulesEnabled) {
    return false;
  }

  const hasEnabledRules = profiles.some((profile) => profile.rules.some((rule) => rule.enabled));
  if (!hasEnabledRules) {
    return false;
  }

  profiles = setEveryRuleEnabled(profiles, false);
  rules = getViewedProfile().rules;
  return true;
}

function renderGlobalRulesToggle() {
  globalRulesToggle.checked = rulesEnabled;
  globalRulesToggle.title = rulesEnabled ? "Pause all rules" : "Enable all rules";
  globalRulesToggle.setAttribute("aria-label", rulesEnabled ? "All rules enabled" : "All rules paused");
}

function renderCurrentProfile() {
  const viewedProfile = getViewedProfile();
  const isActive = viewedProfile.id === activeProfileId;

  profileCurrent.textContent = "";
  const name = document.createElement("span");
  name.className = "profile-current-name";
  name.textContent = viewedProfile.name;
  profileCurrent.append(name);

  if (isActive) {
    const badge = document.createElement("span");
    badge.className = "profile-current-badge";
    badge.classList.toggle("is-paused", !rulesEnabled);
    badge.textContent = rulesEnabled ? "Active" : "Inactive";
    profileCurrent.append(badge);
  }

  profileCurrent.title = isActive
    ? rulesEnabled ? `${viewedProfile.name} is active` : `${viewedProfile.name} is paused`
    : viewedProfile.name;
}

function renderProfileMenu() {
  profileMenu.textContent = "";

  const heading = document.createElement("div");
  heading.className = "profile-menu-heading";
  const headingText = document.createElement("span");
  headingText.textContent = "Profiles";
  const addProfileButton = document.createElement("button");
  addProfileButton.className = "profile-add-button";
  addProfileButton.type = "button";
  addProfileButton.dataset.action = "addProfile";
  addProfileButton.title = profiles.length >= MAX_PROFILES ? "Profile limit reached" : "Add profile";
  addProfileButton.setAttribute("aria-label", addProfileButton.title);
  addProfileButton.disabled = profiles.length >= MAX_PROFILES;
  addProfileButton.textContent = "+";
  heading.append(headingText, addProfileButton);
  profileMenu.append(heading);

  if (profileMenuMode === "export") {
    renderProfileTransferMenu({
      title: "Export profiles",
      profilesToShow: profiles,
      action: "exportSelectedProfiles",
      actionLabel: "Export",
      emptyText: "No profiles to export."
    });
    return;
  }

  if (profileMenuMode === "import") {
    const availableSlots = MAX_PROFILES - profiles.length;
    const hasReplacementProfiles = importableProfiles.some((profile) =>
      profiles.some((existingProfile) => existingProfile.name.toLowerCase() === profile.name.toLowerCase())
    );
    renderProfileTransferMenu({
      title: "Import profiles",
      profilesToShow: importableProfiles,
      action: "importSelectedProfiles",
      actionLabel: "Import",
      emptyText: importProfilesError || "Choose a JSON file to import profiles.",
      message: importProfilesError || (availableSlots <= 0 && !hasReplacementProfiles
        ? "Profile limit reached. Delete a profile before importing new profiles."
        : ""),
      actionDisabled: importableProfiles.length === 0 || (availableSlots <= 0 && !hasReplacementProfiles)
    });
    return;
  }

  for (const profile of profiles) {
    const item = document.createElement("button");
    item.className = [
      "profile-menu-item",
      profile.id === activeProfileId ? "is-active" : "",
      profile.id === viewedProfileId ? "is-viewed" : ""
    ].filter(Boolean).join(" ");
    item.type = "button";
    item.setAttribute("role", "menuitem");
    item.dataset.action = "viewProfile";
    item.dataset.profileId = profile.id;

    const name = document.createElement("span");
    name.className = "profile-menu-name";
    name.textContent = profile.name;
    item.append(name);

    if (profile.id === activeProfileId) {
      const active = document.createElement("span");
      active.className = "profile-menu-check";
      active.textContent = "Active";
      item.append(active);
    }

    const deleteSlot = document.createElement("span");

    if (profile.id !== activeProfileId) {
      if (pendingDeleteProfileId === profile.id) {
        const confirm = document.createElement("div");
        confirm.className = "profile-delete-confirm";

        const text = document.createElement("span");
        text.textContent = "Delete?";

        const yes = document.createElement("button");
        yes.type = "button";
        yes.dataset.action = "confirmDeleteProfile";
        yes.dataset.profileId = profile.id;
        yes.textContent = "Yes";

        const no = document.createElement("button");
        no.type = "button";
        no.dataset.action = "cancelDeleteProfile";
        no.textContent = "No";

        confirm.append(text, yes, no);
        deleteSlot.append(confirm);
      } else {
        const deleteButton = document.createElement("button");
        deleteButton.className = "profile-delete";
        deleteButton.type = "button";
        deleteButton.title = "Delete profile and rules";
        deleteButton.setAttribute("aria-label", `Delete ${profile.name}`);
        deleteButton.dataset.action = "deleteProfile";
        deleteButton.dataset.profileId = profile.id;
        deleteButton.textContent = "x";

        const activateButton = document.createElement("button");
        activateButton.className = "profile-activate";
        activateButton.type = "button";
        activateButton.dataset.action = "activateProfile";
        activateButton.dataset.profileId = profile.id;
        activateButton.textContent = "activate";

        deleteSlot.append(activateButton, deleteButton);
      }
    }

    const row = document.createElement("div");
    row.className = "profile-menu-row";
    row.append(item, deleteSlot);
    profileMenu.append(row);
  }

  if (isAddingProfile && profiles.length < MAX_PROFILES) {
    profileMenu.append(renderCreateProfileForm());
  }

  const transferActions = document.createElement("div");
  transferActions.className = "profile-transfer-actions";

  const importButton = document.createElement("button");
  importButton.type = "button";
  importButton.dataset.action = "showImportProfiles";
  importButton.textContent = "Import";

  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.dataset.action = "showExportProfiles";
  exportButton.textContent = "Export";

  transferActions.append(importButton, exportButton);
  profileMenu.append(transferActions);

  if (profiles.length >= MAX_PROFILES) {
    const limit = document.createElement("div");
    limit.className = "profile-limit";
    limit.textContent = "Profile limit reached.";
    profileMenu.append(limit);
    return;
  }
}

function renderCreateProfileForm() {
  const form = document.createElement("div");
  form.className = "profile-create";

  const input = document.createElement("input");
  input.className = "profile-name-input";
  input.type = "text";
  input.placeholder = "Profile name";
  input.value = `Profile ${profiles.length + 1}`;
  input.setAttribute("aria-label", "Profile name");
  input.addEventListener("input", () => {
    input.classList.remove("has-error");
    const errorNode = form.querySelector(".profile-create-error");
    if (errorNode) {
      errorNode.textContent = "";
    }
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (addProfileFromMenu(input)) {
        toggleProfileMenu(true);
      }
    }

    if (event.key === "Escape") {
      event.stopPropagation();
      isAddingProfile = false;
      renderProfileMenu();
    }
  });

  const actions = document.createElement("div");
  actions.className = "profile-create-actions";
  const error = document.createElement("div");
  error.className = "profile-create-error";
  error.setAttribute("role", "status");

  const createButton = document.createElement("button");
  createButton.type = "button";
  createButton.dataset.action = "createProfile";
  createButton.textContent = "Create";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.dataset.action = "cancelProfile";
  cancelButton.textContent = "Cancel";

  actions.append(createButton, cancelButton);
  form.append(input, error, actions);
  return form;
}

function renderProfileTransferMenu({ title, profilesToShow, action, actionLabel, emptyText, message = "", actionDisabled = false }) {
  const subheading = document.createElement("div");
  subheading.className = "profile-transfer-heading";
  subheading.textContent = title;
  profileMenu.append(subheading);

  const form = document.createElement("div");
  form.className = "profile-transfer";

  if (profilesToShow.length === 0) {
    const empty = document.createElement("div");
    empty.className = importProfilesError ? "profile-transfer-error" : "profile-transfer-empty";
    empty.textContent = emptyText;
    form.append(empty);
  } else {
    for (const profile of profilesToShow) {
      const label = document.createElement("label");
      label.className = "profile-transfer-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "profile";
      checkbox.value = profile.id;
      checkbox.checked = true;

      const name = document.createElement("span");
      name.textContent = profile.name;

      label.append(checkbox, name);
      form.append(label);
    }
  }

  if (message && profilesToShow.length > 0) {
    const messageNode = document.createElement("div");
    messageNode.className = "profile-transfer-error";
    messageNode.textContent = message;
    form.append(messageNode);
  }

  const actions = document.createElement("div");
  actions.className = "profile-transfer-footer";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.dataset.action = "cancelProfileTransfer";
  cancelButton.textContent = "Cancel";

  const actionButton = document.createElement("button");
  actionButton.type = "button";
  actionButton.dataset.action = action;
  actionButton.textContent = actionLabel;
  actionButton.disabled = actionDisabled || profilesToShow.length === 0;

  actions.append(cancelButton, actionButton);
  form.append(actions);
  profileMenu.append(form);
}


function updateRule(id, patch) {
  rules = rules.map((rule) => rule.id === id ? readRule({ ...rule, ...patch }) : rule);
  updateViewedProfileRules(rules);
  if (viewedProfileId === activeProfileId && rules.length > 0) {
    if (patch.enabled === false && !rules.some((rule) => rule.enabled)) {
      rulesEnabled = false;
      masterToggleSnapshot = null;
    } else if (patch.enabled === true && rules.some((rule) => rule.enabled)) {
      rulesEnabled = true;
      masterToggleSnapshot = null;
    }
  }

  if (viewedProfileId === activeProfileId && ((patch.enabled === false && !rules.some((rule) => rule.enabled))
    || (patch.enabled === true && rules.some((rule) => rule.enabled)))) {
    renderGlobalRulesToggle();
    renderCurrentProfile();
  }
  ruleListView.updateCounts(rules, activeTab);
  saveNow();
}

function deleteRule(id) {
  expandedCookieDetails.delete(id);
  rules = rules.filter((rule) => rule.id !== id);
  updateViewedProfileRules(rules);
  if (viewedProfileId === activeProfileId && !rules.some((rule) => rule.enabled)) {
    rulesEnabled = false;
    masterToggleSnapshot = null;
  }
  render();
  saveNow();
}

function createRuleForKind(kind) {
  const rule = createRule(kind);

  if (shouldExpandNewRule(rule)) {
    expandedCookieDetails.add(rule.id);
  }
  return rule;
}

function addProfileFromMenu(input = profileMenu.querySelector(".profile-name-input")) {
  const profileName = (input?.value ?? "").trim();

  if (profiles.length >= MAX_PROFILES) {
    return false;
  }

  if (!profileName) {
    input?.focus();
    return false;
  }

  if (profiles.some((profile) => profile.name.toLowerCase() === profileName.toLowerCase())) {
    const error = profileMenu.querySelector(".profile-create-error");
    input?.classList.add("has-error");
    if (error) {
      error.textContent = "Profile name already exists.";
    }
    input?.focus();
    input?.select();
    return false;
  }

  updateViewedProfileRules(rules);

  const profile = {
    id: crypto.randomUUID(),
    name: profileName,
    rules: []
  };

  profiles = [...profiles, profile];
  isAddingProfile = false;
  pendingDeleteProfileId = "";
  render();
  saveNow();
  return true;
}

function exportSelectedProfiles() {
  const selectedIds = getSelectedProfileIds();
  const selectedProfiles = profiles.filter((profile) => selectedIds.includes(profile.id));

  if (selectedProfiles.length === 0) {
    return false;
  }

  updateViewedProfileRules(rules);

  const payload = createProfilesExport(selectedProfiles);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `header-override-profiles-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

function importSelectedProfiles() {
  const selectedIds = getSelectedProfileIds();
  const selectedProfiles = importableProfiles
    .filter((profile) => selectedIds.includes(profile.id));

  if (selectedProfiles.length === 0) {
    importProfilesError = "Select at least one profile.";
    return false;
  }

  updateViewedProfileRules(rules);

  const result = mergeProfiles(profiles, selectedProfiles);
  if (result.error) {
    importProfilesError = result.error;
    return false;
  }

  profiles = result.profiles;
  rules = getViewedProfile().rules;
  return true;
}

function getSelectedProfileIds() {
  return Array.from(profileMenu.querySelectorAll(".profile-transfer-option input:checked"))
    .map((input) => input.value);
}

async function readProfilesFile(file) {
  const text = await file.text();
  return readProfilesJson(text);
}

function focusProfileNameInput() {
  requestAnimationFrame(() => {
    const input = profileMenu.querySelector(".profile-name-input");
    input?.focus();
    input?.select();
  });
}

function switchProfile(profileId) {
  if (profileId === activeProfileId || !profiles.some((profile) => profile.id === profileId)) {
    return;
  }

  updateViewedProfileRules(rules);
  activeProfileId = profileId;
  viewedProfileId = profileId;
  rules = getViewedProfile().rules;
  expandedCookieDetails.clear();
  render();
  saveNow();
}

function viewProfile(profileId) {
  if (profileId === viewedProfileId || !profiles.some((profile) => profile.id === profileId)) {
    return;
  }

  updateViewedProfileRules(rules);
  viewedProfileId = profileId;
  rules = getViewedProfile().rules;
  expandedCookieDetails.clear();
  render();
  saveNow();
}

function deleteProfile(profileId) {
  if (!profiles.some((profile) => profile.id === profileId)) {
    return;
  }

  const nextProfiles = profiles.filter((profile) => profile.id !== profileId);

  if (nextProfiles.length === 0) {
    const emptyStorage = createStorageData([]);
    profiles = emptyStorage.profiles;
    activeProfileId = emptyStorage.activeProfileId;
    viewedProfileId = activeProfileId;
  } else {
    profiles = nextProfiles;

    if (activeProfileId === profileId) {
      activeProfileId = profiles[0].id;
    }

    if (viewedProfileId === profileId) {
      viewedProfileId = activeProfileId;
    }
  }

  rules = getViewedProfile().rules;
  activeTab = "headers";
  isAddingProfile = false;
  pendingDeleteProfileId = "";
  expandedCookieDetails.clear();
  render();
  saveNow();
}


function getActiveProfile() {
  return profiles.find((profile) => profile.id === activeProfileId) || profiles[0];
}

function getViewedProfile() {
  return profiles.find((profile) => profile.id === viewedProfileId) || getActiveProfile();
}

function updateViewedProfileRules(nextRules) {
  rules = nextRules.map(readRule);
  profiles = profiles.map((profile) => profile.id === viewedProfileId
    ? { ...profile, rules }
    : profile);
}

function toStorageData() {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    rulesEnabled,
    masterToggleSnapshot,
    activeProfileId,
    profiles: profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      rules: profile.rules.map(readRule)
    }))
  };
}

function isSameStorageData(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function readActiveTab(value) {
  if (value === "requestCookie" || value === "responseCookie") {
    return "cookies";
  }

  if (value === "requestHeader" || value === "responseHeader") {
    return "headers";
  }

  return tabs.some((tab) => tab.dataset.tab === value) ? value : "headers";
}


function toggleProfileMenu(isOpen) {
  profileMenu.hidden = !isOpen;
  profileMenuButton.setAttribute("aria-expanded", String(isOpen));
}
