/**
 * View pipeline for the board/list (MLT-48): filter → order → group.
 */
import { describe, expect, it } from "vite-plus/test";

import type { IssueSummary } from "@multilinear/core/views";

import { applyViewFilters, groupForList, orderIssues } from "./grouping";

const issue = (overrides: Partial<Record<keyof IssueSummary, unknown>>): IssueSummary =>
  ({
    id: "01",
    spaceId: "space",
    spaceKey: "MLT",
    number: 1,
    shortId: "MLT-1",
    title: "Issue",
    statusId: "status",
    category: "backlog",
    priority: 0,
    issueType: "work",
    labels: [],
    agentBlocked: false,
    pendingDuplicate: false,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    ...overrides,
  }) as IssueSummary;

const fixtures = [
  issue({ id: "a", priority: 3, category: "ready", updatedAt: "2026-07-03T00:00:00Z" }),
  issue({ id: "b", priority: 1, category: "backlog", updatedAt: "2026-07-01T00:00:00Z" }),
  issue({
    id: "c",
    priority: 0,
    category: "ready",
    createdAt: "2026-07-02T00:00:00Z",
    updatedAt: "2026-06-30T00:00:00Z",
  }),
];

const noFilters = { priorities: [], categories: [], labelIds: [] };

describe("applyViewFilters", () => {
  it("empty selections mean all", () => {
    expect(applyViewFilters(fixtures, noFilters)).toHaveLength(3);
  });

  it("filters compose across priority and category", () => {
    const filtered = applyViewFilters(fixtures, {
      ...noFilters,
      priorities: [3, 0],
      categories: ["ready"],
    });
    expect(filtered.map((entry) => entry.id)).toEqual(["a", "c"]);
  });

  it("label filter matches issues carrying any selected label", () => {
    const labelled = [
      issue({ id: "x", labels: [{ id: "l1", spaceId: "space", name: "bug", color: "#ff0000" }] }),
      issue({ id: "y" }),
    ];
    const filtered = applyViewFilters(labelled, {
      ...noFilters,
      labelIds: ["l1" as never],
    });
    expect(filtered.map((entry) => entry.id)).toEqual(["x"]);
  });
});

describe("orderIssues", () => {
  it("updated puts the most recently touched first", () => {
    expect(orderIssues(fixtures, "updated").map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });

  it("priority puts urgent first and no-priority last", () => {
    expect(orderIssues(fixtures, "priority").map((entry) => entry.id)).toEqual(["b", "a", "c"]);
  });

  it("created uses creation recency", () => {
    expect(orderIssues(fixtures, "created").map((entry) => entry.id)[0]).toBe("c");
  });

  it("ascending direction reverses the natural order", () => {
    expect(orderIssues(fixtures, "updated", "asc").map((entry) => entry.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
    expect(orderIssues(fixtures, "priority", "asc").map((entry) => entry.id)[0]).toBe("c");
  });
});

describe("groupForList", () => {
  it("priority grouping buckets in urgency order with no-priority last", () => {
    const groups = groupForList(fixtures, "priority").filter((group) => group.issues.length > 0);
    expect(groups.map((group) => group.label)).toEqual(["Urgent", "Medium", "No priority"]);
  });

  it("none is a single flat group preserving order", () => {
    const groups = groupForList(fixtures, "none");
    expect(groups).toHaveLength(1);
    expect(groups[0]?.issues).toHaveLength(3);
  });

  it("status grouping keeps canonical category order", () => {
    const groups = groupForList(fixtures, "status").filter((group) => group.issues.length > 0);
    expect(groups.map((group) => group.key)).toEqual(["backlog", "ready"]);
  });
});
