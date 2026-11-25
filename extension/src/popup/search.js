export function normalizeSearchQuery(value) {
  return String(value || "").trim().toLowerCase();
}

export function getRuleSearchMatches(rule, query) {
  const term = normalizeSearchQuery(query);
  const includes = (value) => term !== "" && String(value || "").toLowerCase().includes(term);
  const visibleUrl = rule.regexFilter || (rule.urlFilter === "|http*" ? "" : rule.urlFilter);
  const matches = {
    header: includes(rule.header),
    name: includes(rule.name),
    value: includes(rule.value),
    comment: includes(rule.comment),
    url: includes(visibleUrl)
  };

  return {
    ...matches,
    matched: !term || Object.values(matches).some(Boolean)
  };
}
