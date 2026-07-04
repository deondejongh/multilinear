/**
 * View preferences for the tracker (MLT-48): ordering, list grouping, shown
 * properties, and the client-side filter extensions (priority / category).
 * Persisted to localStorage — the "per-user client persistence first" step
 * from the issue; named saved views and config files are later increments.
 */
import type { LabelId, Priority, StatusCategory } from "@multilinear/core/model";

export type IssueOrdering = "updated" | "created" | "priority";
/** "desc" is each ordering's natural direction: newest / most urgent first. */
export type OrderingDirection = "desc" | "asc";
export type ListGrouping = "status" | "priority" | "none";

export interface DisplayOptions {
  readonly ordering: IssueOrdering;
  readonly orderingDirection: OrderingDirection;
  /** Grouping for the list view; the board always groups by status. */
  readonly listGrouping: ListGrouping;
  /** Board: render status columns that hold no issues. */
  readonly showEmptyColumns: boolean;
  /** List: render groups that hold no issues. */
  readonly showEmptyGroups: boolean;
  readonly showPriority: boolean;
  readonly showShortId: boolean;
  readonly showLabels: boolean;
  readonly showType: boolean;
}

export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  ordering: "updated",
  orderingDirection: "desc",
  listGrouping: "status",
  showEmptyColumns: false,
  showEmptyGroups: false,
  showPriority: true,
  showShortId: true,
  showLabels: true,
  showType: true,
};

export interface ViewFilterPrefs {
  /** Empty = all priorities. */
  readonly priorities: ReadonlyArray<Priority>;
  /** Empty = all categories. */
  readonly categories: ReadonlyArray<StatusCategory>;
  /** Empty = all labels; otherwise issues carrying ANY selected label. */
  readonly labelIds: ReadonlyArray<LabelId>;
}

export const DEFAULT_VIEW_FILTERS: ViewFilterPrefs = {
  priorities: [],
  categories: [],
  labelIds: [],
};

export interface ViewPrefs {
  readonly view: "board" | "list";
  readonly display: DisplayOptions;
  readonly filters: ViewFilterPrefs;
}

export const DEFAULT_VIEW_PREFS: ViewPrefs = {
  view: "board",
  display: DEFAULT_DISPLAY_OPTIONS,
  filters: DEFAULT_VIEW_FILTERS,
};

const STORAGE_KEY = "multilinear.viewPrefs.v1";

/** Merge stored prefs over the defaults so new fields pick up defaults. */
export function loadViewPrefs(): ViewPrefs {
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_VIEW_PREFS;
    const parsed = JSON.parse(raw) as Partial<ViewPrefs>;
    return {
      view: parsed.view === "list" ? "list" : "board",
      display: { ...DEFAULT_DISPLAY_OPTIONS, ...parsed.display },
      filters: { ...DEFAULT_VIEW_FILTERS, ...parsed.filters },
    };
  } catch {
    return DEFAULT_VIEW_PREFS;
  }
}

export function saveViewPrefs(prefs: ViewPrefs): void {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable (private mode, quota) — prefs stay session-local.
  }
}
