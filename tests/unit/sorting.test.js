import assert from "node:assert/strict";
import test from "node:test";

import {
  cycleSectionSort,
  readSectionSort,
  readSortingByProfile,
  setProfileSectionSort,
  sortRulesForSection
} from "../../extension/src/popup/sorting.js";

test("cycles a section from unsorted to descending, ascending, and unsorted", () => {
  const descending = cycleSectionSort(null, "header");
  const ascending = cycleSectionSort(descending, "header");

  assert.deepEqual(descending, { field: "header", direction: "desc" });
  assert.deepEqual(ascending, { field: "header", direction: "asc" });
  assert.equal(cycleSectionSort(ascending, "header"), null);
  assert.deepEqual(cycleSectionSort(ascending, "comment"), {
    field: "comment",
    direction: "desc"
  });
});

test("validates sort fields by rule kind and ignores malformed stored state", () => {
  assert.deepEqual(readSectionSort("requestHeader", { field: "header", direction: "asc" }), {
    field: "header",
    direction: "asc"
  });
  assert.equal(readSectionSort("requestHeader", { field: "name", direction: "asc" }), null);
  assert.equal(readSectionSort("requestCookie", { field: "name", direction: "sideways" }), null);

  assert.deepEqual(readSortingByProfile({
    first: {
      requestHeader: { field: "header", direction: "desc" },
      responseCookie: { field: "domain", direction: "asc" }
    },
    removed: {
      requestCookie: { field: "name", direction: "asc" }
    }
  }, ["first"]), {
    first: {
      requestHeader: { field: "header", direction: "desc" }
    }
  });
});

test("stores one sort per profile section and removes empty profile state", () => {
  const withSort = setProfileSectionSort({}, "profile", "requestHeader", {
    field: "header",
    direction: "asc"
  });

  assert.deepEqual(withSort, {
    profile: {
      requestHeader: { field: "header", direction: "asc" }
    }
  });
  assert.deepEqual(setProfileSectionSort(withSort, "profile", "requestHeader", null), {});
});

test("sorts text naturally and case-insensitively while keeping empty values last", () => {
  const rules = [
    { id: "empty", header: "" },
    { id: "ten", header: "X-Header-10" },
    { id: "two-upper", header: "X-Header-2" },
    { id: "two-lower", header: "x-header-2" },
    { id: "spaces", header: "   " }
  ];

  assert.deepEqual(
    sortRulesForSection(rules, "requestHeader", { field: "header", direction: "asc" })
      .map((rule) => rule.id),
    ["two-upper", "two-lower", "ten", "empty", "spaces"]
  );
  assert.deepEqual(
    sortRulesForSection(rules, "requestHeader", { field: "header", direction: "desc" })
      .map((rule) => rule.id),
    ["ten", "two-upper", "two-lower", "empty", "spaces"]
  );
});

test("sorts enabled rules and restores stored order when sorting is cleared", () => {
  const rules = [
    { id: "enabled-one", enabled: true },
    { id: "disabled", enabled: false },
    { id: "enabled-two", enabled: true }
  ];

  assert.deepEqual(
    sortRulesForSection(rules, "responseHeader", { field: "enabled", direction: "asc" })
      .map((rule) => rule.id),
    ["disabled", "enabled-one", "enabled-two"]
  );
  assert.deepEqual(
    sortRulesForSection(rules, "responseHeader", { field: "enabled", direction: "desc" })
      .map((rule) => rule.id),
    ["enabled-one", "enabled-two", "disabled"]
  );
  assert.deepEqual(
    sortRulesForSection(rules, "responseHeader", null).map((rule) => rule.id),
    ["enabled-one", "disabled", "enabled-two"]
  );
});
