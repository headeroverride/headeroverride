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
  const customFields = popover.querySelector(".url-filter-custom");
  const scopeButtons = Array.from(popover.querySelectorAll("[data-url-scope]"));
  const helpEntries = new Set();
  let activeEditor = null;
  let activeHelp = null;

  popover.id = "url-filter-popover";
  input.id = "url-filter-input";
  popover.querySelector("label").htmlFor = input.id;
  popover.querySelector(".url-filter-help-slot").append(createHelp("url-filter-editor-help"));
  document.body.append(popover);

  for (const button of scopeButtons) {
    button.addEventListener("click", () => {
      const custom = button.dataset.urlScope === "custom";
      closeHelp();
      setScope(custom);
      positionEditor();
      if (custom) input.focus({ preventScroll: true });
    });
  }
  popover.querySelector(".url-filter-close").addEventListener("click", () => closeEditor());
  popover.querySelector(".url-filter-done").addEventListener("click", () => closeEditor({ save: true }));

  // Use the press location so dragging a text selection outside the popup
  // cannot dismiss it on release. Dismissal discards the draft; only Done saves.
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
    const filter = rule.urlFilter || DEFAULT_URL_FILTER;
    const isCustom = filter !== DEFAULT_URL_FILTER;
    const name = rule.header || rule.name || "rule";
    button.classList.toggle("is-custom", isCustom);
    button.title = isCustom ? `URL filter: ${filter}` : "Applies to all websites";
    button.setAttribute("aria-label", `Edit URL filter for ${name}: ${isCustom ? filter : "all websites"}`);
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
      popover.setAttribute("aria-label", `URL filter for ${currentRule.header || currentRule.name || "new rule"}`);
      setScope(input.value !== DEFAULT_URL_FILTER);
      popover.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      positionEditor();
      (customFields.hidden ? scopeButtons[0] : input).focus({ preventScroll: true });
    });
  }

  function setScope(custom) {
    customFields.hidden = !custom;
    for (const button of scopeButtons) {
      const selected = (button.dataset.urlScope === "custom") === custom;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
  }

  function closeEditor({ restoreFocus = true, save = false } = {}) {
    if (!activeEditor) return;
    const previous = activeEditor;
    const rule = getRule(previous.ruleId);
    const urlFilter = customFields.hidden ? DEFAULT_URL_FILTER : input.value || DEFAULT_URL_FILTER;
    activeEditor = null;
    closeHelp();
    popover.hidden = true;
    findTrigger(previous.ruleId)?.setAttribute("aria-expanded", "false");
    if (save && rule && urlFilter !== rule.urlFilter) {
      onUpdateRule(rule.id, { urlFilter });
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

  function createHelp(id) {
    const wrapper = helpTemplate.content.firstElementChild.cloneNode(true);
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
