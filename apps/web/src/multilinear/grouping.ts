/**
 * Group issue summaries into the canonical category order. Shared by the board
 * (columns) and the list view (grouped rows).
 */
import { STATUS_CATEGORIES, type StatusCategory } from "@multilinear/core/model";
import type { IssueSummary } from "@multilinear/core/views";

export interface CategoryGroup {
  category: StatusCategory;
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
