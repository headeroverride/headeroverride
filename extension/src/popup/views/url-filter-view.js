import { ruleKind } from "../../shared/model.js";

const DEFAULT_URL_FILTER = "|http*";

export function createUrlFilterView({
  rulesContainer,
  rulesShell,
  helpTemplate,
  popoverTemplate,
  getRule,
  onUpdateRule,
  onCommit,
  onCloseHelp
}) {
  const popover = popoverTemplate.content.firstElementChild.cloneNode(true);
  const input = popover.querySelector(".url-filter");
  const regexInput = popover.querySelector(".regex-filter");
  const editorRow = popover.querySelector(".url-filter-editor-row");
  const inputFields = Array.from(popover.querySelectorAll("[data-input-mode]"));
  const error = popover.querySelector(".url-filter-error");
  const scopeButtons = Array.from(popover.querySelectorAll("[data-url-scope]"));
  const helpEntries = new Set();
  let activeEditor = null;
  let activeHelp = null;
  let selectedScope = "all";
  let validating = false;

  popover.id = "url-filter-popover";
  input.id = "url-filter-input";
  regexInput.id = "regex-filter-input";
  popover.querySelector('[data-help-mode="all"]').append(createHelp(
    document.querySelector("#any-help-template"), "any-filter-editor-help"
  ));
  popover.querySelector('[data-help-mode="pattern"]').append(createHelp(helpTemplate, "url-filter-editor-help"));
  popover.querySelector('[data-help-mode="regex"]').append(createHelp(
    document.querySelector("#regex-help-template"), "regex-filter-editor-help"
  ));
  document.body.append(popover);

  for (const button of scopeButtons) {
    button.addEventListener("click", () => {
      closeHelp();
      setScope(button.dataset.urlScope);
      positionEditor();
      if (selectedScope === "pattern") input.focus({ preventScroll: true });
      if (selectedScope === "regex") regexInput.focus({ preventScroll: true });
    });
  }
  regexInput.addEventListener("input", clearError);
  popover.querySelector(".url-filter-save").addEventListener("click", () => { void closeEditor({ save: true }); });

  // Use the press location so dragging a text selection outside the popup
  // cannot dismiss it on release. Dismissal discards the draft; only Save commits it.
  function dismissOnOutsideInteraction(event) {
    if (!event.target.closest(".url-filter-popover, .url-filter-trigger, .url-help-wrapper, .url-help-panel")) {
      closeEditor({ restoreFocus: false });
    }
  }
  document.addEventListener("pointerdown", dismissOnOutsideInteraction);
  document.addEventListener("click", (event) => {
    if (event.detail === 0) dismissOnOutsideInteraction(event);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (activeHelp) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeHelp();
    } else if (activeEditor) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeEditor();
    }
  });
  rulesShell.addEventListener("scroll", () => {
    closeHelp();
    closeEditor({ restoreFocus: false });
  });
  window.addEventListener("resize", () => {
    closeHelp();
    positionEditor();
  });

  function findTrigger(ruleId) {
    return Array.from(rulesContainer.querySelectorAll(".rule"))
      .find((node) => node.dataset.ruleId === ruleId)?.querySelector(".url-filter-trigger");
  }

  function updateTrigger(button, rule) {
    const regex = rule.regexFilter || "";
    const filter = regex || rule.urlFilter || DEFAULT_URL_FILTER;
    const isCustom = Boolean(regex) || filter !== DEFAULT_URL_FILTER;
    const name = rule.header || rule.name || "rule";
    button.classList.toggle("is-custom", isCustom);
    button.title = regex ? `Regex: ${regex}` : isCustom ? `URL pattern: ${filter}` : "Applies to all websites";
    button.setAttribute("aria-label", `Edit URL filter for ${name}: ${regex ? `regex ${regex}` : isCustom ? `URL pattern ${filter}` : "all websites"}`);
  }

  function bindTrigger(node, rule) {
    const button = node.querySelector(".url-filter-trigger");
    updateTrigger(button, rule);
    button.setAttribute("aria-controls", popover.id);
    button.addEventListener("click", () => {
      const wasOpen = activeEditor?.ruleId === rule.id;
      closeEditor({ restoreFocus: false });
      if (wasOpen) return;

      // Reopening always starts from the latest saved rule, not an old draft.
      const currentRule = getRule(rule.id);
      const trigger = findTrigger(rule.id);
      if (!currentRule || !trigger) return;
      onCloseHelp();
      updateTrigger(trigger, currentRule);
      activeEditor = { ruleId: rule.id, kind: ruleKind(currentRule) };
      input.value = currentRule.urlFilter || DEFAULT_URL_FILTER;
      regexInput.value = currentRule.regexFilter || "";
      clearError();
      popover.setAttribute("aria-label", `URL filter for ${currentRule.header || currentRule.name || "new rule"}`);
      setScope(regexInput.value ? "regex" : input.value !== DEFAULT_URL_FILTER ? "pattern" : "all");
      popover.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      positionEditor();
      (selectedScope === "regex" ? regexInput : selectedScope === "pattern" ? input : scopeButtons[0])
        .focus({ preventScroll: true });
    });
  }

  function setScope(scope) {
    selectedScope = scope;
    popover.classList.toggle("is-all", scope === "all");
    editorRow.hidden = scope === "all";
    clearError();
    for (const field of inputFields) field.hidden = field.dataset.inputMode !== scope;
    for (const button of scopeButtons) {
      const selected = button.dataset.urlScope === scope;
      button.parentElement.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
  }

  function clearError() {
    error.textContent = "";
    error.hidden = true;
    regexInput.removeAttribute("aria-invalid");
  }

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
    regexInput.setAttribute("aria-invalid", "true");
    regexInput.focus({ preventScroll: true });
    positionEditor();
  }

  async function closeEditor({ restoreFocus = true, save = false } = {}) {
    if (!activeEditor || (save && validating)) return;
    const previous = activeEditor;
    const rule = getRule(previous.ruleId);
    const urlFilter = selectedScope === "pattern" ? input.value || DEFAULT_URL_FILTER : DEFAULT_URL_FILTER;
    const regexFilter = selectedScope === "regex" ? regexInput.value : "";
    if (save && rule && selectedScope === "regex") {
      if (!regexFilter.trim()) {
        showError("Enter a regular expression.");
        return;
      }
      if (/[^\x00-\x7F]/.test(regexFilter)) {
        showError("Use ASCII characters in the regex. URLs encode other characters.");
        return;
      }
      validating = true;
      try {
        const result = await chrome.declarativeNetRequest.isRegexSupported({
          regex: regexFilter,
          isCaseSensitive: false
        });
        if (activeEditor !== previous || selectedScope !== "regex" || regexInput.value !== regexFilter) return;
        if (!result.isSupported) {
          showError(result.reason === "memoryLimitExceeded"
            ? "This regex is too complex for the browser."
            : "This regex has unsupported or invalid syntax.");
          return;
        }
      } catch (validationError) {
        if (activeEditor === previous && selectedScope === "regex") {
          showError(`Could not validate regex: ${validationError.message}`);
        }
        return;
      } finally {
        validating = false;
      }
      if (activeEditor !== previous || selectedScope !== "regex" || regexInput.value !== regexFilter) return;
    }
    activeEditor = null;
    closeHelp();
    popover.hidden = true;
    findTrigger(previous.ruleId)?.setAttribute("aria-expanded", "false");
    if (save && rule && (urlFilter !== rule.urlFilter || regexFilter !== (rule.regexFilter || ""))) {
      onUpdateRule(rule.id, { urlFilter, regexFilter });
      const trigger = findTrigger(rule.id);
      if (trigger) updateTrigger(trigger, getRule(rule.id));
      onCommit(previous.kind);
    }
    if (restoreFocus) findTrigger(previous.ruleId)?.focus({ preventScroll: true });
  }

  function positionEditor() {
    if (!activeEditor) return;
    const trigger = findTrigger(activeEditor.ruleId);
    if (trigger) positionPanel(popover, trigger);
  }

  function positionPanel(panel, anchor) {
    const rect = anchor.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const below = rect.bottom + 8;
    const top = below + height <= window.innerHeight - 12 ? below : rect.top - height - 8;
    panel.style.left = `${Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))}px`;
    panel.style.top = `${Math.max(12, Math.min(top, window.innerHeight - height - 12))}px`;
  }

  function createHelp(template, id) {
    const wrapper = template.content.firstElementChild.cloneNode(true);
    const button = wrapper.querySelector(".help-tip");
    const panel = wrapper.querySelector(".help-panel");
    wrapper.classList.add("url-help-wrapper");
    panel.classList.add("url-help-panel");
    panel.id = id;
    panel.setAttribute("aria-hidden", "true");
    button.setAttribute("aria-controls", id);
    button.setAttribute("aria-describedby", id);
    document.body.append(panel);
    const entry = { button, panel, pinned: false, openTimer: null, closeTimer: null };
    helpEntries.add(entry);

    button.addEventListener("pointerenter", () => {
      clearTimeout(entry.closeTimer);
      if (activeHelp !== entry) entry.openTimer = setTimeout(() => showHelp(entry), 450);
    });
    button.addEventListener("pointerleave", () => scheduleHelpClose(entry));
    button.addEventListener("focus", () => {
      if (button.matches(":focus-visible")) showHelp(entry);
    });
    button.addEventListener("blur", () => scheduleHelpClose(entry));
    button.addEventListener("click", () => {
      if (activeHelp === entry && entry.pinned) closeHelp();
      else showHelp(entry, true);
    });
    panel.addEventListener("pointerenter", () => clearTimeout(entry.closeTimer));
    panel.addEventListener("pointerleave", () => scheduleHelpClose(entry));
    return wrapper;
  }

  function showHelp(entry, pinned = false) {
    onCloseHelp();
    activeHelp = entry;
    entry.pinned = pinned;
    positionPanel(entry.panel, entry.button);
    entry.panel.classList.add("is-open");
    entry.panel.setAttribute("aria-hidden", "false");
    entry.button.setAttribute("aria-expanded", "true");
  }

  function scheduleHelpClose(entry) {
    clearTimeout(entry.openTimer);
    if (entry.pinned || entry.button.matches(":focus-visible")) return;
    entry.closeTimer = setTimeout(() => {
      if (activeHelp === entry) closeHelp();
    }, 150);
  }

  function closeHelp() {
    for (const entry of helpEntries) {
      clearTimeout(entry.openTimer);
      clearTimeout(entry.closeTimer);
      entry.panel.classList.remove("is-open");
      entry.panel.setAttribute("aria-hidden", "true");
      entry.button.setAttribute("aria-expanded", "false");
      entry.pinned = false;
    }
    activeHelp = null;
  }

  return {
    bindTrigger,
    closeHelp,
    reset() {
      closeEditor({ restoreFocus: false });
      closeHelp();
    }
  };
}
