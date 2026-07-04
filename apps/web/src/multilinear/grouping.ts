/**
 * Client-side view pipeline for the board and list (MLT-48): filter →
 * order → group. The board always groups by status category; the list can
 * also group by priority or show a flat list. Pure functions.
 */
import { STATUS_CATEGORIES, type Priority, type StatusCategory } from "@multilinear/core/model";
import type { IssueSummary } from "@multilinear/core/views";

import { CATEGORY_LABELS, priorityLabel } from "./presentation";
import type { IssueOrdering, ListGrouping, OrderingDirection, ViewFilterPrefs } from "./viewPrefs";

export interface CategoryGroup {
  category: StatusCategory;
  issues: ReadonlyArray<IssueSummary>;
}

/** A list-view group: status category, priority bucket, or the flat list. */
export interface ListGroup {
  key: string;
  label: string;
  category?: StatusCategory;
  priority?: Priority;
  issues: ReadonlyArray<IssueSummary>;
}

/** Buckets issues by category, preserving `STATUS_CATEGORIES` order. */
export function groupByCategory(issues: ReadonlyArray<IssueSummary>): ReadonlyArray<CategoryGroup> {
  const byCategory = new Map<StatusCategory, IssueSummary[]>();
  for (const category of STATUS_CATEGORIES) {
    byCategory.set(category, []);
  }
  for (const issue of issues) {
    byCategory.get(issue.category)?.push(issue);
  }
  return STATUS_CATEGORIES.map((category) => ({
    category,
    issues: byCategory.get(category) ?? [],
  }));
}

/** Priority buckets in urgency order, "No priority" last. */
const PRIORITY_GROUP_ORDER: ReadonlyArray<Priority> = [1, 2, 3, 4, 0];

/** Priority sort rank: urgent first, "No priority" (0) last. */
const priorityRank = (priority: Priority): number => (priority === 0 ? 5 : priority);

/** Apply the client-side filter extensions; empty selections mean "all". */
export function applyViewFilters(
  issues: ReadonlyArray<IssueSummary>,
  filters: ViewFilterPrefs,
): ReadonlyArray<IssueSummary> {
  const { priorities, categories, labelIds } = filters;
  if (priorities.length === 0 && categories.length === 0 && labelIds.length === 0) return issues;
  return issues.filter(
    (issue) =>
      (priorities.length === 0 || priorities.includes(issue.priority)) &&
      (categories.length === 0 || categories.includes(issue.category)) &&
      (labelIds.length === 0 || issue.labels.some((label) => labelIds.includes(label.id))),
  );
}

/**
 * Order issues for display. "desc" is each ordering's natural direction —
 * newest first / most urgent first ("updated" desc mirrors the server
 * default `updated_at DESC`); "asc" reverses it. Ties inside "priority"
 * fall back to recency.
 */
export function orderIssues(
  issues: ReadonlyArray<IssueSummary>,
  ordering: IssueOrdering,
  direction: OrderingDirection = "desc",
): ReadonlyArray<IssueSummary> {
  const sign = direction === "desc" ? 1 : -1;
  const byRecency = (a: IssueSummary, b: IssueSummary, field: "updatedAt" | "createdAt") =>
    b[field].localeCompare(a[field]) || b.id.localeCompare(a.id);
  switch (ordering) {
    case "updated":
      return issues.toSorted((a, b) => sign * byRecency(a, b, "updatedAt"));
    case "created":
      return issues.toSorted((a, b) => sign * byRecency(a, b, "createdAt"));
    case "priority":
      return issues.toSorted(
        (a, b) =>
          sign * (priorityRank(a.priority) - priorityRank(b.priority)) ||
          byRecency(a, b, "updatedAt"),
      );
  }
}

/** Group already-ordered issues for the list view. */
export function groupForList(
  issues: ReadonlyArray<IssueSummary>,
  grouping: ListGrouping,
): ReadonlyArray<ListGroup> {
  switch (grouping) {
    case "status":
      return groupByCategory(issues).map((group) => ({
        key: group.category,
        label: CATEGORY_LABELS[group.category],
        category: group.category,
        issues: group.issues,
      }));
    case "priority": {
      const buckets = new Map<Priority, IssueSummary[]>(
        PRIORITY_GROUP_ORDER.map((priority) => [priority, []]),
      );
      for (const issue of issues) {
        buckets.get(issue.priority)?.push(issue);
      }
      return PRIORITY_GROUP_ORDER.map((priority) => ({
        key: `priority-${priority}`,
        label: priorityLabel(priority),
        priority,
        issues: buckets.get(priority) ?? [],
      }));
    }
    case "none":
      return [{ key: "all", label: "All issues", issues }];
  }
}
