export async function replaceDynamicRules(rules) {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });

  if (rules.length === 0) {
    return 0;
  }

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules });
    return 0;
  } catch (batchError) {
    return addRulesIndividually(rules);
  }
}

async function addRulesIndividually(rules) {
  let failedRules = 0;

  for (const rule of rules) {
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [rule] });
    } catch (error) {
      console.warn("Skipped invalid declarative override rule.", rule, error);
      failedRules += 1;
    }
  }

  return failedRules;
}
