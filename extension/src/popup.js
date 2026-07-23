const STORAGE_KEY = "headerOverrideRules";
const POPUP_STATE_KEY = "headerOverridePopupState";
const STORAGE_SCHEMA_VERSION = 2;
const DEFAULT_PROFILE_ID = "default";
const MAX_PROFILES = globalThis.HEADER_OVERRIDE_CONFIG.maxProfiles;
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const rulesContainer = document.querySelector("#rules");
const headerTemplate = document.querySelector("#header-rule-template");
const cookieTemplate = document.querySelector("#cookie-rule-template");
const urlHelpTemplate = document.querySelector("#url-help-template");
const profileMenuButton = document.querySelector("#profile-menu-button");
const profileMenu = document.querySelector("#profile-menu");
const profileCurrent = document.querySelector("#profile-current");
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
const expandedCookieDetails = new Set();
let isAddingProfile = false;
let profileMenuMode = "list";
let importableProfiles = [];
let importProfilesError = "";
let pendingDeleteProfileId = "";
let saveInFlight = false;
let savePending = false;

init();

async function init() {
  const stored = await chrome.storage.local.get([STORAGE_KEY, POPUP_STATE_KEY]);
  storageData = normalizeStorageData(stored[STORAGE_KEY]);
  activeTab = normalizeActiveTab(stored[POPUP_STATE_KEY]?.activeTab);
  profiles = storageData.profiles;
  activeProfileId = storageData.activeProfileId;
  viewedProfileId = activeProfileId;
  rules = getViewedProfile().rules;
  const normalizedData = toStorageData();
  if (!isSameStorageData(stored[STORAGE_KEY], normalizedData)) {
    await chrome.storage.local.set({ [STORAGE_KEY]: normalizedData });
  }
  render();
}

profileMenuButton.addEventListener("click", () => {
  toggleProfileMenu(profileMenu.hidden);
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
    activeTab = normalizeActiveTab(tab.dataset.tab);
    closeUrlFilterHelp();
    render();
    savePopupState();
  });
}

document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".url-heading")) {
    closeUrlFilterHelp();
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

  const kind = getRuleKind({ kind: addButton.dataset.kind });
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
    closeUrlFilterHelp();
    toggleProfileMenu(false);
    renderProfileMenu();
  }
});

function render() {
  renderCurrentProfile();
  renderProfileMenu();
  updateTabs();
  renderRules();
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
    badge.textContent = "Active";
    profileCurrent.append(badge);
  }

  profileCurrent.title = isActive ? `${viewedProfile.name} is active` : viewedProfile.name;
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

function updateTabs() {
  for (const tab of tabs) {
    tab.classList.toggle("is-active", tab.dataset.tab === activeTab);
    tab.setAttribute("aria-current", tab.dataset.tab === activeTab ? "page" : "false");
  }

  const counts = {
    requestHeader: rules.filter((rule) => isCountableRule(rule, "requestHeader")).length,
    responseHeader: rules.filter((rule) => isCountableRule(rule, "responseHeader")).length,
    requestCookie: rules.filter((rule) => isCountableCookieRule(rule, "requestCookie")).length,
    responseCookie: rules.filter((rule) => isCountableCookieRule(rule, "responseCookie")).length
  };
  counts.headers = counts.requestHeader + counts.responseHeader;
  counts.cookies = counts.requestCookie + counts.responseCookie;

  for (const countNode of countNodes) {
    const count = counts[countNode.dataset.count] ?? 0;
    countNode.textContent = String(count);
    countNode.classList.toggle("has-count", count > 0);
  }
}

function renderRules() {
  rulesContainer.textContent = "";

  const visibleKinds = getActiveTabKinds();
  let visibleCount = 0;

  for (const kind of visibleKinds) {
    const section = renderRuleSection(kind);
    visibleCount += section.ruleCount;
    rulesContainer.append(section.node);
  }

  if (visibleCount === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No rules yet.";
    rulesContainer.append(empty);
  }
}

async function savePopupState() {
  try {
    await chrome.storage.local.set({ [POPUP_STATE_KEY]: { activeTab } });
  } catch (error) {
    console.error("Failed to save popup state.", error);
  }
}

function renderRuleSection(kind) {
  const section = document.createElement("section");
  section.className = "rule-section";
  section.setAttribute("aria-labelledby", `${kind}-section-title`);

  const header = document.createElement("div");
  header.className = "rule-section-header";

  const titleGroup = document.createElement("div");
  titleGroup.className = "rule-section-title";

  const title = document.createElement("h2");
  title.id = `${kind}-section-title`;
  title.textContent = getSectionTitle(kind);
  titleGroup.append(title);

  if (kind === "requestHeader" || kind === "responseHeader" || kind === "requestCookie" || kind === "responseCookie") {
    titleGroup.append(renderSectionHelp(kind));
  }

  const addButton = document.createElement("button");
  addButton.className = "section-add-button";
  addButton.type = "button";
  addButton.dataset.action = "add-rule";
  addButton.dataset.kind = kind;
  addButton.title = `Add ${getSectionRuleName(kind)}`;
  addButton.setAttribute("aria-label", `Add ${getSectionRuleName(kind)}`);
  addButton.textContent = "+";

  header.append(titleGroup, addButton);
  section.append(header, renderSectionHead(kind));

  const sectionRules = rules.filter((rule) => getRuleKind(rule) === kind);
  const list = document.createElement("div");
  list.className = "rule-section-list";

  for (const rule of sectionRules) {
    list.append(isCookieKind(kind) ? renderCookieRule(rule) : renderHeaderRule(rule));
  }

  section.append(list);
  return { node: section, ruleCount: sectionRules.length };
}

function renderSectionHelp(kind) {
  const wrapper = document.createElement("span");
  wrapper.className = "section-help";

  const button = document.createElement("button");
  button.className = "help-tip";
  button.type = "button";
  button.setAttribute("aria-label", getSectionHelpLabel(kind));
  button.setAttribute("aria-expanded", "false");
  button.textContent = "?";

  const panel = document.createElement("span");
  panel.className = "help-panel section-help-panel";
  panel.id = getSectionHelpId(kind);
  panel.setAttribute("role", "tooltip");
  panel.textContent = getSectionHelpText(kind);

  button.setAttribute("aria-controls", panel.id);
  button.addEventListener("click", () => {
    const isOpen = !panel.classList.contains("is-open");
    closeUrlFilterHelp();
    panel.classList.toggle("is-open", isOpen);
    button.setAttribute("aria-expanded", String(isOpen));
  });

  wrapper.append(button, panel);
  return wrapper;
}

function getSectionHelpLabel(kind) {
  const labels = {
    requestHeader: "Request header behavior",
    responseHeader: "Response header behavior",
    requestCookie: "Request cookie behavior",
    responseCookie: "Response cookie behavior"
  };

  return labels[kind] || "Rule behavior";
}

function getSectionHelpId(kind) {
  const ids = {
    requestHeader: "request-header-help",
    responseHeader: "response-header-help",
    requestCookie: "request-cookie-help",
    responseCookie: "response-cookie-help"
  };

  return ids[kind] || "rule-help";
}

function getSectionHelpText(kind) {
  const texts = {
    requestHeader: "Adds headers to matching outgoing requests.",
    responseHeader: "Adds headers to matching responses. DevTools may not show injected headers in the Network tab.",
    requestCookie: "Request cookies are appended to the existing Cookie header on matching outgoing origin requests.",
    responseCookie: "Adds Set-Cookie headers to matching responses. The browser stores the cookie, but DevTools may not show the injected header in the Network tab."
  };

  return texts[kind] || "";
}

function renderSectionHead(kind) {
  const head = document.createElement("div");
  head.className = "rules-head header-head";

  appendHeadText(head, "On");
  appendHeadText(head, isCookieKind(kind) ? "Name" : "Header");
  appendHeadText(head, "Value");
  appendUrlHelp(head, kind);
  appendHeadText(head, "Comment");
  appendHeadText(head, "");

  return head;
}

function renderHeaderRule(rule) {
  const node = headerTemplate.content.firstElementChild.cloneNode(true);
  const row = node.querySelector(".header-rule-main");
  const enabled = node.querySelector(".enabled");
  const header = node.querySelector(".header");
  const value = node.querySelector(".value");
  const urlFilter = node.querySelector(".url-filter");
  const comment = node.querySelector(".comment");
  const deleteButton = node.querySelector(".delete");

  setFieldChecked(enabled, Boolean(rule.enabled));
  setFieldValue(header, rule.header || "");
  setFieldValue(value, rule.value || "");
  setFieldValue(urlFilter, rule.urlFilter || "|http*");
  setFieldValue(comment, rule.comment || "");
  updateCommentStyle(comment);

  enabled?.addEventListener("change", () => updateRule(rule.id, { enabled: enabled.checked }));
  bindEnabledColumnToggle(row, enabled, () => updateRule(rule.id, { enabled: enabled.checked }));
  header?.addEventListener("input", () => updateRule(rule.id, { header: header.value }));
  value?.addEventListener("input", () => updateRule(rule.id, { value: value.value }));
  urlFilter?.addEventListener("input", () => updateRule(rule.id, { urlFilter: urlFilter.value }));
  comment?.addEventListener("input", () => {
    updateCommentStyle(comment);
    updateRule(rule.id, { comment: comment.value });
  });
  deleteButton?.addEventListener("click", () => deleteRule(rule.id));

  return node;
}

function renderCookieRule(rule) {
  const node = cookieTemplate.content.firstElementChild.cloneNode(true);
  const kind = getRuleKind(rule);
  const row = node.querySelector(".cookie-primary");
  const enabled = node.querySelector(".enabled");
  const name = node.querySelector(".name");
  const value = node.querySelector(".value");
  const comment = node.querySelector(".comment");
  const urlFilterColumn = node.querySelector(".cookie-url-filter");
  const requestUrlFilter = node.querySelector(".cookie-request-fields .url-filter");
  const domain = node.querySelector(".cookie-response-fields .domain");
  const path = node.querySelector(".cookie-response-fields .path");
  const secure = node.querySelector(".cookie-response-fields .secure");
  const sameSite = node.querySelector(".cookie-response-fields .same-site");
  const session = node.querySelector(".cookie-response-fields .session");
  const maxAge = node.querySelector(".cookie-response-fields .max-age");
  const deleteButton = node.querySelector(".delete");
  const detailToggles = Array.from(node.querySelectorAll(".detail-toggle"));
  const detailDoneButtons = Array.from(node.querySelectorAll(".detail-done"));

  node.classList.toggle("request-cookie-rule", kind === "requestCookie");
  node.classList.toggle("response-cookie-rule", kind === "responseCookie");
  setFieldChecked(enabled, Boolean(rule.enabled));
  setFieldValue(name, rule.name || "");
  setFieldValue(value, rule.value || "");
  setFieldValue(comment, rule.comment || "");
  setFieldValue(urlFilterColumn, rule.urlFilter || "|http*");
  setFieldValue(requestUrlFilter, rule.urlFilter || "|http*");
  setFieldValue(domain, rule.domain || "");
  setFieldValue(path, rule.path || "");
  setFieldChecked(secure, Boolean(rule.secure));
  setFieldValue(sameSite, rule.sameSite || "lax");
  setFieldValue(session, String(rule.session !== false));
  setFieldValue(maxAge, rule.maxAge || "");
  updateCookieDirection(node, rule.id, kind, getControlValue(session, "true"));
  updateCommentStyle(comment);

  enabled?.addEventListener("change", () => updateRule(rule.id, { enabled: enabled.checked }));
  bindEnabledColumnToggle(row, enabled, () => updateRule(rule.id, { enabled: enabled.checked }));
  name?.addEventListener("input", () => updateRule(rule.id, { name: name.value }));
  value?.addEventListener("input", () => updateRule(rule.id, { value: value.value }));
  comment?.addEventListener("input", () => {
    updateCommentStyle(comment);
    updateRule(rule.id, { comment: comment.value });
  });
  urlFilterColumn?.addEventListener("input", () => {
    setFieldValue(requestUrlFilter, urlFilterColumn.value);
    updateRule(rule.id, { urlFilter: urlFilterColumn.value });
  });
  requestUrlFilter?.addEventListener("input", () => {
    setFieldValue(urlFilterColumn, requestUrlFilter.value);
    updateRule(rule.id, { urlFilter: requestUrlFilter.value });
  });
  domain?.addEventListener("input", () => updateRule(rule.id, { domain: domain.value }));
  path?.addEventListener("input", () => updateRule(rule.id, { path: path.value }));
  secure?.addEventListener("change", () => updateRule(rule.id, { secure: secure.checked }));
  sameSite?.addEventListener("change", () => updateRule(rule.id, { sameSite: sameSite.value }));
  session?.addEventListener("change", () => {
    updateCookieDirection(node, rule.id, kind, session.value);
    updateRule(rule.id, { session: session.value === "true" });
  });
  maxAge?.addEventListener("input", () => updateRule(rule.id, { maxAge: maxAge.value }));
  for (const toggle of detailToggles) {
    toggle.addEventListener("click", () => {
      expandedCookieDetails.add(rule.id);
      updateCookieDirection(node, rule.id, kind, getControlValue(session, "true"));
    });
  }
  for (const doneButton of detailDoneButtons) {
    doneButton.addEventListener("click", () => {
      expandedCookieDetails.delete(rule.id);
      updateCookieDirection(node, rule.id, kind, getControlValue(session, "true"));
    });
  }
  deleteButton?.addEventListener("click", () => deleteRule(rule.id));

  return node;
}

function bindEnabledColumnToggle(row, enabled, onToggle) {
  if (!row || !enabled) {
    return;
  }

  row.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : event.target.parentElement;

    if (target?.closest("input, select, button, textarea, a")) {
      return;
    }

    const firstField = enabled.nextElementSibling;

    if (!firstField) {
      return;
    }

    const rowRect = row.getBoundingClientRect();
    const firstFieldRect = firstField.getBoundingClientRect();
    const isInEnabledColumn = event.clientX >= rowRect.left
      && event.clientX < firstFieldRect.left
      && event.clientY >= rowRect.top
      && event.clientY <= rowRect.bottom;

    if (!isInEnabledColumn) {
      return;
    }

    enabled.checked = !enabled.checked;
    onToggle();
  });
}

function updateCookieDirection(node, ruleId, kind, sessionValue) {
  const isRequest = kind === "requestCookie";
  const requestFields = node.querySelector(".cookie-request-fields");
  const responseFields = node.querySelector(".cookie-response-fields");
  const maxAge = node.querySelector(".cookie-response-fields .max-age");
  const maxAgeField = maxAge?.closest(".detail-field");

  if (!requestFields || !responseFields) {
    return;
  }

  const activeFields = isRequest ? requestFields : responseFields;
  const inactiveFields = isRequest ? responseFields : requestFields;
  const isExpanded = expandedCookieDetails.has(ruleId);
  const activeSummary = activeFields?.querySelector(".detail-summary");
  const activeSummaryText = activeFields?.querySelector(".detail-summary-text");
  const activeEditor = activeFields?.querySelector(".detail-editor");
  const inactiveSummary = inactiveFields?.querySelector(".detail-summary");
  const inactiveEditor = inactiveFields?.querySelector(".detail-editor");

  requestFields.hidden = true;
  responseFields.hidden = isRequest;
  if (maxAgeField) {
    maxAgeField.hidden = sessionValue !== "false";
  }
  responseFields?.querySelector(".detail-editor")?.classList.toggle("is-session", sessionValue !== "false");
  if (isRequest) {
    return;
  }

  if (activeSummary) {
    activeSummary.hidden = isExpanded;
  }
  if (activeEditor) {
    activeEditor.hidden = !isExpanded;
  }
  if (inactiveSummary) {
    inactiveSummary.hidden = true;
  }
  if (inactiveEditor) {
    inactiveEditor.hidden = true;
  }
  if (activeSummaryText) {
    activeSummaryText.textContent = getResponseCookieSummary(node);
  }
}

function appendHeadText(target, text) {
  const span = document.createElement("span");
  span.textContent = text;
  target.append(span);
}

function appendUrlHelp(target, kind) {
  const node = urlHelpTemplate.content.firstElementChild.cloneNode(true);
  const button = node.querySelector(".help-tip");
  const panel = node.querySelector(".help-panel");
  const id = `url-filter-help-${kind}`;

  panel.id = id;
  button.setAttribute("aria-controls", id);
  button.addEventListener("click", () => {
    const isOpen = !panel.classList.contains("is-open");
    closeUrlFilterHelp();
    panel.classList.toggle("is-open", isOpen);
    button.setAttribute("aria-expanded", String(isOpen));
  });

  target.append(node);
}

function updateRule(id, patch) {
  rules = rules.map((rule) => rule.id === id ? normalizeRule({ ...rule, ...patch }) : rule);
  updateViewedProfileRules(rules);
  updateTabs();
  saveNow();
}

function deleteRule(id) {
  expandedCookieDetails.delete(id);
  rules = rules.filter((rule) => rule.id !== id);
  updateViewedProfileRules(rules);
  render();
  saveNow();
}

function saveNow() {
  savePending = true;

  if (!saveInFlight) {
    persistPendingSaves();
  }
}

async function persistPendingSaves() {
  saveInFlight = true;

  try {
    while (savePending) {
      updateViewedProfileRules(rules);
      const snapshot = toStorageData();
      savePending = false;
      await chrome.storage.local.set({ [STORAGE_KEY]: snapshot });
    }
  } catch (error) {
    console.error("Failed to save override rules.", error);
  } finally {
    saveInFlight = false;

    if (savePending) {
      persistPendingSaves();
    }
  }
}

function createRuleForKind(kind) {
  if (isCookieKind(kind)) {
    const rule = normalizeRule({
      id: crypto.randomUUID(),
      kind,
      enabled: true
    });
    expandedCookieDetails.add(rule.id);
    return rule;
  }

  const rule = normalizeRule({
    id: crypto.randomUUID(),
    kind,
    enabled: true
  });
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

  const payload = {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profiles: selectedProfiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      rules: profile.rules.map(toStorageRule)
    }))
  };
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

  const existingNames = new Set(profiles.map((profile) => profile.name.toLowerCase()));
  const selectedNewProfiles = selectedProfiles
    .filter((profile) => !existingNames.has(profile.name.toLowerCase()));
  const availableSlots = MAX_PROFILES - profiles.length;

  if (selectedNewProfiles.length > availableSlots) {
    importProfilesError = availableSlots <= 0
      ? "Profile limit reached. Delete a profile before importing new profiles."
      : `You can import ${availableSlots} more ${availableSlots === 1 ? "profile" : "profiles"}.`;
    return false;
  }

  const replacementsByName = new Map(
    selectedProfiles.map((profile) => [profile.name.toLowerCase(), profile])
  );
  const replacedProfiles = profiles.map((profile) => {
    const replacement = replacementsByName.get(profile.name.toLowerCase());

    if (!replacement) {
      return profile;
    }

    return {
      ...profile,
      name: replacement.name,
      rules: replacement.rules.map(normalizeRule)
    };
  });
  const imported = selectedNewProfiles.map((profile) => ({
    id: crypto.randomUUID(),
    name: profile.name,
    rules: profile.rules.map(normalizeRule)
  }));

  profiles = [...replacedProfiles, ...imported];
  rules = getViewedProfile().rules;
  return true;
}

function getSelectedProfileIds() {
  return Array.from(profileMenu.querySelectorAll(".profile-transfer-option input:checked"))
    .map((input) => input.value);
}

async function readProfilesFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const sourceProfiles = Array.isArray(parsed?.profiles)
    ? parsed.profiles
    : Array.isArray(parsed)
      ? parsed
      : [];

  return sourceProfiles
    .map(normalizeProfile)
    .filter(Boolean)
    .slice(0, MAX_PROFILES);
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

function getResponseCookieSummary(node) {
  const fields = node.querySelector(".cookie-response-fields");
  return getStructuredCookieSummary({
    domain: getFieldValue(fields, ".domain").trim(),
    path: getFieldValue(fields, ".path").trim(),
    sameSite: getFieldValue(fields, ".same-site"),
    session: getFieldValue(fields, ".session", "true") === "true",
    maxAge: getFieldValue(fields, ".max-age").trim(),
    secure: getFieldChecked(fields, ".secure")
  });
}

function getFieldValue(root, selector, fallback = "") {
  return root?.querySelector(selector)?.value ?? fallback;
}

function getFieldChecked(root, selector) {
  return Boolean(root?.querySelector(selector)?.checked);
}

function getControlValue(control, fallback = "") {
  return control?.value ?? fallback;
}

function setFieldValue(control, value) {
  if (control) {
    control.value = value;
  }
}

function setFieldChecked(control, checked) {
  if (control) {
    control.checked = checked;
  }
}

function getStructuredCookieSummary({ prefix, domain, path, sameSite, session, maxAge, secure }) {
  const parts = [
    prefix || "",
    domain ? `Domain ${domain}` : "",
    path ? `Path ${path}` : "",
    sameSite ? `SameSite ${formatSameSite(sameSite)}` : "",
    session ? "Session" : `Max-Age ${maxAge || "2592000"}s`,
    secure ? "Secure" : ""
  ].filter(Boolean);

  return parts.join(" | ");
}

function formatSameSite(value) {
  const labels = {
    no_restriction: "None",
    lax: "Lax",
    strict: "Strict"
  };

  return labels[value] || value;
}

function normalizeRule(rule) {
  if (!rule || typeof rule !== "object") {
    rule = {};
  }

  const kind = getRuleKind(rule);
  const normalized = {
    id: rule.id || crypto.randomUUID(),
    kind,
    enabled: Boolean(rule.enabled),
    value: rule.value || "",
    comment: rule.comment || ""
  };

  if (isCookieKind(kind)) {
    const isResponseCookie = kind === "responseCookie";

    return {
      ...normalized,
      name: rule.name || "",
      domain: rule.domain || "",
      path: rule.path || (isResponseCookie ? "/" : ""),
      secure: Boolean(rule.secure),
      sameSite: normalizeStoredSameSite(rule.sameSite, isResponseCookie ? "lax" : ""),
      session: rule.session !== false,
      maxAge: rule.maxAge || (isResponseCookie ? "2592000" : ""),
      urlFilter: rule.urlFilter || "|http*"
    };
  }

  return {
    ...normalized,
    header: rule.header || "",
    urlFilter: rule.urlFilter || "|http*"
  };
}

function toStorageRule(rule) {
  return normalizeRule(rule);
}

function normalizeStorageData(value) {
  if (Array.isArray(value)) {
    return createStorageData(value);
  }

  if (!value || typeof value !== "object") {
    return createStorageData([]);
  }

  const normalizedProfiles = Array.isArray(value.profiles)
    ? value.profiles.map(normalizeProfile).filter(Boolean)
    : [];
  const finalProfiles = normalizedProfiles.length > 0
    ? normalizedProfiles
    : createStorageData([]).profiles;
  const limitedProfiles = finalProfiles.slice(0, MAX_PROFILES);
  const finalActiveProfileId = limitedProfiles.some((profile) => profile.id === value.activeProfileId)
    ? value.activeProfileId
    : limitedProfiles[0].id;

  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    activeProfileId: finalActiveProfileId,
    profiles: limitedProfiles
  };
}

function createStorageData(initialRules) {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [
      {
        id: DEFAULT_PROFILE_ID,
        name: "Default",
        rules: Array.isArray(initialRules) ? initialRules.map(normalizeRule) : []
      }
    ]
  };
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  const id = typeof profile.id === "string" && profile.id.trim()
    ? profile.id
    : crypto.randomUUID();
  const name = typeof profile.name === "string" && profile.name.trim()
    ? profile.name.trim()
    : "Untitled";

  return {
    id,
    name,
    rules: Array.isArray(profile.rules) ? profile.rules.map(normalizeRule) : []
  };
}

function getActiveProfile() {
  return profiles.find((profile) => profile.id === activeProfileId) || profiles[0];
}

function getViewedProfile() {
  return profiles.find((profile) => profile.id === viewedProfileId) || getActiveProfile();
}

function updateViewedProfileRules(nextRules) {
  rules = nextRules.map(normalizeRule);
  profiles = profiles.map((profile) => profile.id === viewedProfileId
    ? { ...profile, rules }
    : profile);
}

function toStorageData() {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    activeProfileId,
    profiles: profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      rules: profile.rules.map(toStorageRule)
    }))
  };
}

function isSameStorageData(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getRuleKind(rule) {
  return ["requestHeader", "responseHeader", "requestCookie", "responseCookie"].includes(rule.kind)
    ? rule.kind
    : "requestHeader";
}

function normalizeStoredSameSite(value, fallback) {
  if (value === "") {
    return "";
  }

  return ["no_restriction", "lax", "strict"].includes(value) ? value : fallback;
}

function normalizeActiveTab(value) {
  if (value === "requestCookie" || value === "responseCookie") {
    return "cookies";
  }

  if (value === "requestHeader" || value === "responseHeader") {
    return "headers";
  }

  return tabs.some((tab) => tab.dataset.tab === value) ? value : "headers";
}

function isCountableRule(rule, kind) {
  return Boolean(rule.enabled) && getRuleKind(rule) === kind && Boolean(normalizeHeaderName(rule.header));
}

function isCountableCookieRule(rule, kind) {
  return Boolean(rule.enabled) && getRuleKind(rule) === kind && Boolean(normalizeCookieName(rule.name));
}

function normalizeHeaderName(value) {
  if (typeof value !== "string") {
    return "";
  }

  const headerName = value.trim();
  return HEADER_NAME_PATTERN.test(headerName) ? headerName : "";
}

function normalizeCookieName(value) {
  if (typeof value !== "string") {
    return "";
  }

  const name = value.trim();
  return name && !/[=;\s]/.test(name) ? name : "";
}

function isCookieKind(kind) {
  return kind === "requestCookie" || kind === "responseCookie";
}

function getActiveTabKinds() {
  return activeTab === "cookies"
    ? ["requestCookie", "responseCookie"]
    : ["requestHeader", "responseHeader"];
}

function getSectionTitle(kind) {
  return kind === "requestHeader" || kind === "requestCookie" ? "Request" : "Response";
}

function getSectionRuleName(kind) {
  const names = {
    requestHeader: "request header rule",
    responseHeader: "response header rule",
    requestCookie: "request cookie rule",
    responseCookie: "response cookie rule"
  };

  return names[kind] || "rule";
}

function updateCommentStyle(comment) {
  if (!comment) {
    return;
  }

  comment.classList.toggle("has-comment", Boolean(comment.value.trim()));
}

function closeUrlFilterHelp() {
  for (const panel of document.querySelectorAll(".help-panel")) {
    panel.classList.remove("is-open");
  }

  for (const button of document.querySelectorAll(".help-tip")) {
    button.setAttribute("aria-expanded", "false");
  }
}

function toggleProfileMenu(isOpen) {
  profileMenu.hidden = !isOpen;
  profileMenuButton.setAttribute("aria-expanded", String(isOpen));
}
