import { RULE_KINDS } from "../shared/constants.js";

const SORT_DIRECTIONS = ["asc", "desc"];
const COMMON_SORT_FIELDS = ["enabled", "value", "urlFilter", "comment"];
const SORT_FIELDS_BY_KIND = Object.freeze({
  requestHeader: Object.freeze(["enabled", "header", ...COMMON_SORT_FIELDS.slice(1)]),
  responseHeader: Object.freeze(["enabled", "header", ...COMMON_SORT_FIELDS.slice(1)]),
  requestCookie: Object.freeze(["enabled", "name", ...COMMON_SORT_FIELDS.slice(1)]),
  responseCookie: Object.freeze(["enabled", "name", ...COMMON_SORT_FIELDS.slice(1)])
});
const textCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base"
});

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function readSectionSort(kind, value) {
  const candidate = objectOrEmpty(value);
  const fields = SORT_FIELDS_BY_KIND[kind] || [];

  if (!fields.includes(candidate.field) || !SORT_DIRECTIONS.includes(candidate.direction)) {
    return null;
  }

  return { field: candidate.field, direction: candidate.direction };
}

export function readSortingByProfile(value, profileIds) {
  const source = objectOrEmpty(value);
  const result = {};

  for (const profileId of profileIds) {
    const storedProfileSorts = objectOrEmpty(source[profileId]);
    const profileSorts = {};

    for (const kind of RULE_KINDS) {
      const sort = readSectionSort(kind, storedProfileSorts[kind]);
      if (sort) {
        profileSorts[kind] = sort;
      }
    }

    if (Object.keys(profileSorts).length > 0) {
      result[profileId] = profileSorts;
    }
  }

  return result;
}

export function cycleSectionSort(currentSort, field) {
  if (!currentSort || currentSort.field !== field) {
    return { field, direction: "desc" };
  }

  if (currentSort.direction === "desc") {
    return { field, direction: "asc" };
  }

  return null;
}

export function setProfileSectionSort(sortingByProfile, profileId, kind, nextSort) {
  const result = { ...sortingByProfile };
  const profileSorts = { ...(result[profileId] || {}) };

  if (nextSort) {
    profileSorts[kind] = nextSort;
  } else {
    delete profileSorts[kind];
  }

  if (Object.keys(profileSorts).length > 0) {
    result[profileId] = profileSorts;
  } else {
    delete result[profileId];
  }

  return result;
}

export function removeProfileSorting(sortingByProfile, profileId) {
  const result = { ...sortingByProfile };
  delete result[profileId];
  return result;
}

export function sortRulesForSection(rules, kind, value) {
  const sort = readSectionSort(kind, value);
  const indexedRules = rules.map((rule, index) => ({ rule, index }));

  if (!sort) {
    return indexedRules.map(({ rule }) => rule);
  }

  indexedRules.sort((left, right) => {
    const comparison = compareFieldValues(left.rule, right.rule, sort.field, sort.direction);
    return comparison || left.index - right.index;
  });

  return indexedRules.map(({ rule }) => rule);
}

function compareFieldValues(leftRule, rightRule, field, direction) {
  if (field === "enabled") {
    const comparison = Number(Boolean(leftRule.enabled)) - Number(Boolean(rightRule.enabled));
    return direction === "desc" ? -comparison : comparison;
  }

  const left = String(leftRule[field] ?? "").trim();
  const right = String(rightRule[field] ?? "").trim();
  const leftEmpty = left.length === 0;
  const rightEmpty = right.length === 0;

  if (leftEmpty || rightEmpty) {
    if (leftEmpty && rightEmpty) {
      return 0;
    }
    return leftEmpty ? 1 : -1;
  }

  const comparison = textCollator.compare(left, right);
  return direction === "desc" ? -comparison : comparison;
}
