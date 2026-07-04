/**
 * Presentation helpers shared across the multilinear tracker views: priority
 * labels/icons, status-category names/icons, and relation-kind headings. Pure,
 * dependency-light lookups so cards, rows, selects, and the activity feed all
 * agree on vocabulary and iconography.
 */
import {
  BanIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleIcon,
  CopyIcon,
  EyeIcon,
  InboxIcon,
  LayersIcon,
  ListTodoIcon,
  type LucideIcon,
} from "lucide-react";

import type {
  Priority,
  RelationKindInput,
  RunLinkKind,
  StatusCategory,
} from "@multilinear/core/model";

/** Human-facing priority names, indexed by the numeric priority value. */
export const PRIORITY_LABELS: Readonly<Record<Priority, string>> = {
  0: "No priority",
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

export const priorityLabel = (priority: Priority): string =>
  PRIORITY_LABELS[priority] ?? "No priority";

/** Ordered priority options for selects (highest urgency first, none last). */
export const PRIORITY_OPTIONS: ReadonlyArray<{ value: Priority; label: string }> = [
  { value: 0, label: "No priority" },
  { value: 1, label: "Urgent" },
  { value: 2, label: "High" },
  { value: 3, label: "Medium" },
  { value: 4, label: "Low" },
];

/** Board/list column labels keyed by category (echoes DEFAULT_STATUS_NAMES). */
export const CATEGORY_LABELS: Readonly<Record<StatusCategory, string>> = {
  triage: "Triage",
  backlog: "Backlog",
  ready: "Ready",
  in_progress: "In Progress",
  needs_review: "Needs Review",
  done: "Done",
  cancelled: "Cancelled",
  duplicate: "Duplicate",
};

export const categoryLabel = (category: StatusCategory): string => CATEGORY_LABELS[category];

const CATEGORY_ICONS: Readonly<Record<StatusCategory, LucideIcon>> = {
  triage: InboxIcon,
  backlog: CircleDashedIcon,
  ready: CircleIcon,
  in_progress: CircleDotIcon,
  needs_review: EyeIcon,
  done: CircleDotIcon,
  cancelled: BanIcon,
  duplicate: CopyIcon,
};

export const categoryIcon = (category: StatusCategory): LucideIcon => CATEGORY_ICONS[category];

/** Issue-type labels; `work` is the implied default and rarely shown. */
export const ISSUE_TYPE_LABELS = {
  work: "Work",
  idea: "Idea",
  spike: "Spike",
  config: "Config",
} as const;

export const ISSUE_TYPE_OPTIONS: ReadonlyArray<{
  value: keyof typeof ISSUE_TYPE_LABELS;
  label: string;
}> = [
  { value: "work", label: "Work" },
  { value: "idea", label: "Idea" },
  { value: "spike", label: "Spike" },
  { value: "config", label: "Config" },
];

/** Section headings for relations, keyed by the six surface relation kinds. */
export const RELATION_KIND_HEADINGS: Readonly<Record<RelationKindInput, string>> = {
  blocks: "Blocks",
  blocked_by: "Blocked by",
  parent: "Parent",
  child: "Child",
  relates_to: "Related",
  duplicate_of: "Duplicate of",
  discovered_from: "Discovered from",
};

/** Order relation groups appear in on the detail sidebar. */
export const RELATION_KIND_ORDER: ReadonlyArray<RelationKindInput> = [
  "blocks",
  "blocked_by",
  "parent",
  "child",
  "relates_to",
  "duplicate_of",
  "discovered_from",
];

export const RELATION_KIND_OPTIONS: ReadonlyArray<{
  value: RelationKindInput;
  label: string;
}> = RELATION_KIND_ORDER.map((value) => ({ value, label: RELATION_KIND_HEADINGS[value] }));

export const RUN_LINK_KIND_LABELS: Readonly<Record<RunLinkKind, string>> = {
  thread: "Thread",
  worktree: "Worktree",
  pr: "PR",
};

export const RUN_LINK_KIND_OPTIONS: ReadonlyArray<{ value: RunLinkKind; label: string }> = [
  { value: "thread", label: "Thread" },
  { value: "worktree", label: "Worktree" },
  { value: "pr", label: "PR" },
];

const RUN_LINK_ICONS: Readonly<Record<RunLinkKind, LucideIcon>> = {
  thread: ListTodoIcon,
  worktree: LayersIcon,
  pr: CircleDotIcon,
};

export const runLinkIcon = (kind: RunLinkKind): LucideIcon => RUN_LINK_ICONS[kind];

/** A curated palette for new labels — no new theme colors, just hex swatches. */
export const LABEL_COLOR_PRESETS: ReadonlyArray<string> = [
  "#5e6ad2",
  "#26b5ce",
  "#4cb782",
  "#f2c94c",
  "#f2994a",
  "#eb5757",
  "#bb87fc",
  "#95a2b3",
];
