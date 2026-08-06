import {
  isCookieRule,
  ruleKind,
  validCookieName,
  validHeaderName
} from "../../shared/model.js";

export function createRuleListView({
  rulesContainer,
  headerTemplate,
  cookieTemplate,
  urlHelpTemplate,
  tabs,
  countNodes,
  expandedCookieDetails,
  onUpdateRule,
  onDeleteRule
}) {
  let rules = [];
  let activeTab = "headers";
  const updateRule = onUpdateRule;
  const deleteRule = onDeleteRule;

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
  
    const sectionRules = rules.filter((rule) => ruleKind(rule) === kind);
    const list = document.createElement("div");
    list.className = "rule-section-list";
  
    for (const rule of sectionRules) {
      list.append(isCookieRule(kind) ? renderCookieRule(rule) : renderHeaderRule(rule));
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
    appendHeadText(head, isCookieRule(kind) ? "Name" : "Header");
    appendHeadText(head, "Value");
    appendUrlHelp(head, kind);
    appendHeadText(head, "Comment");
    appendHeadText(head, "");
  
    return head;
  }
  
  function renderHeaderRule(rule) {
    const node = headerTemplate.content.firstElementChild.cloneNode(true);
    const row = node.querySelector(".header-rule-main");
    const kind = ruleKind(rule);
    const enabled = node.querySelector(".enabled");
    const header = node.querySelector(".header");
    const value = node.querySelector(".value");
    const operationToggle = node.querySelector(".operation-toggle");
    const urlFilter = node.querySelector(".url-filter");
    const comment = node.querySelector(".comment");
    const deleteButton = node.querySelector(".delete");
  
    node.classList.toggle("request-header-rule", kind === "requestHeader");
    node.classList.toggle("response-header-rule", kind === "responseHeader");
    setFieldChecked(enabled, Boolean(rule.enabled));
    setFieldValue(header, rule.header || "");
    setFieldValue(value, rule.value || "");
    setFieldValue(urlFilter, rule.urlFilter || "|http*");
    setFieldValue(comment, rule.comment || "");
    updateCommentStyle(comment);
    updateHeaderOperation(node, kind, rule.operation);
  
    enabled?.addEventListener("change", () => updateRule(rule.id, { enabled: enabled.checked }));
    bindEnabledColumnToggle(row, enabled, () => updateRule(rule.id, { enabled: enabled.checked }));
    header?.addEventListener("input", () => updateRule(rule.id, { header: header.value }));
    value?.addEventListener("input", () => updateRule(rule.id, { value: value.value }));
    operationToggle?.addEventListener("click", () => {
      const operation = getNextHeaderOperation(node.dataset.operation || getHeaderOperation(rule));
      updateRule(rule.id, { operation });
      updateHeaderOperation(node, kind, operation);
    });
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
    const kind = ruleKind(rule);
    const row = node.querySelector(".cookie-primary");
    const enabled = node.querySelector(".enabled");
    const name = node.querySelector(".name");
    const value = node.querySelector(".value");
    const operationToggle = node.querySelector(".operation-toggle");
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
    updateCookieOperation(node, kind, rule.operation);
    updateCommentStyle(comment);
  
    enabled?.addEventListener("change", () => updateRule(rule.id, { enabled: enabled.checked }));
    bindEnabledColumnToggle(row, enabled, () => updateRule(rule.id, { enabled: enabled.checked }));
    name?.addEventListener("input", () => updateRule(rule.id, { name: name.value }));
    value?.addEventListener("input", () => updateRule(rule.id, { value: value.value }));
    operationToggle?.addEventListener("click", () => {
      const operation = (node.dataset.operation || getCookieOperation(rule)) === "delete" ? "add" : "delete";
      updateRule(rule.id, { operation });
      updateCookieOperation(node, kind, operation);
    });
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
  
  function updateHeaderOperation(node, kind, operation) {
    const toggle = node.querySelector(".operation-toggle");
    const value = node.querySelector(".value");
    const normalizedOperation = getHeaderOperation({ operation });
    const isHeader = kind === "requestHeader" || kind === "responseHeader";
  
    if (!toggle) {
      return;
    }
  
    toggle.hidden = !isHeader;
    node.dataset.operation = normalizedOperation;
    toggle.textContent = getHeaderOperationSymbol(normalizedOperation);
    toggle.title = `${capitalize(kind === "requestHeader" ? "Request" : "Response")} header operation: ${capitalize(normalizedOperation)}`;
    toggle.setAttribute("aria-label", toggle.title);
    if (value) {
      value.hidden = isHeader && normalizedOperation === "remove";
    }
  }
  
  function updateCookieOperation(node, kind, operation) {
    const toggle = node.querySelector(".operation-toggle");
    const value = node.querySelector(".value");
    const session = node.querySelector(".cookie-response-fields .session");
    const normalizedOperation = getCookieOperation({ operation });
    const isResponse = kind === "responseCookie";
  
    if (!toggle) {
      return;
    }
  
    toggle.hidden = !isResponse;
    node.dataset.operation = normalizedOperation;
    toggle.textContent = normalizedOperation === "delete" ? "−" : "+";
    toggle.title = `Response cookie operation: ${normalizedOperation === "delete" ? "Delete" : "Add"}`;
    toggle.setAttribute("aria-label", toggle.title);
    if (value) {
      value.hidden = isResponse && normalizedOperation === "delete";
    }
  
    if (isResponse) {
      for (const selector of [".same-site", ".session", ".max-age", ".secure"]) {
        const field = node.querySelector(`.cookie-response-fields ${selector}`)?.closest("label, .detail-check");
        if (field) {
          const isSessionMaxAge = selector === ".max-age" && getControlValue(session, "true") !== "false";
          field.hidden = normalizedOperation === "delete" || isSessionMaxAge;
        }
      }
    }
  }
  
  function getHeaderOperation(rule) {
    return ["set", "remove"].includes(rule?.operation) ? rule.operation : "set";
  }
  
  function getNextHeaderOperation(operation) {
    const operations = ["set", "remove"];
    return operations[(operations.indexOf(operation) + 1) % operations.length];
  }
  
  function getHeaderOperationSymbol(operation) {
    return {
      set: "=",
      remove: "−"
    }[operation] || "=";
  }
  
  function getCookieOperation(rule) {
    return rule?.operation === "delete" ? "delete" : "add";
  }
  
  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  
  function updateCookieDirection(node, ruleId, kind, sessionValue) {
    const isRequest = kind === "requestCookie";
    const requestFields = node.querySelector(".cookie-request-fields");
    const responseFields = node.querySelector(".cookie-response-fields");
    const maxAge = node.querySelector(".cookie-response-fields .max-age");
    const maxAgeField = maxAge?.closest(".detail-field");
    const isDeleteOperation = getCookieOperation({ operation: node.dataset.operation }) === "delete";
  
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
      maxAgeField.hidden = isDeleteOperation || sessionValue !== "false";
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
  
  function isCountableRule(rule, kind) {
    return Boolean(rule.enabled) && ruleKind(rule) === kind && Boolean(validHeaderName(rule.header));
  }
  
  function isCountableCookieRule(rule, kind) {
    return Boolean(rule.enabled) && ruleKind(rule) === kind && Boolean(validCookieName(rule.name));
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

  return {
    render(nextRules, nextActiveTab) {
      rules = nextRules;
      activeTab = nextActiveTab;
      updateTabs();
      renderRules();
    },
    updateCounts(nextRules, nextActiveTab) {
      rules = nextRules;
      activeTab = nextActiveTab;
      updateTabs();
    },
    closeHelp: closeUrlFilterHelp
  };
}
