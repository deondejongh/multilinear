/**
 * Zustand store for the multilinear tracker views: filters, cached board
 * data, and command execution with refresh-on-mutation. Follows the
 * conventions of the other top-level `<domain>Store.ts` stores.
 */
import { create } from "zustand";

import type { IssueFilter } from "@multilinear/core/api";
import type { Label, Priority, Space, StatusCategory } from "@multilinear/core/model";
import type { WorkflowProfile } from "@multilinear/core/profile";
import type { IssueSummary } from "@multilinear/core/views";

import {
  mlCommand,
  mlListIssues,
  mlListLabels,
  mlListProfiles,
  mlListSpaces,
  MultilinearApiError,
  type LabelId,
  type SpaceId,
  type TrackerCommand,
} from "./api";
import { loadViewPrefs, saveViewPrefs, type DisplayOptions } from "./viewPrefs";

export type MultilinearView = "board" | "list";

export interface MultilinearFilterState {
  spaceId: SpaceId | null;
  /** When true, only issues currently marked Agent Blocked. */
  agentBlocked: boolean;
  /** Client-side filters (MLT-48); empty selections mean "all". */
  priorities: ReadonlyArray<Priority>;
  categories: ReadonlyArray<StatusCategory>;
  labelIds: ReadonlyArray<LabelId>;
}

interface MultilinearStore {
  spaces: ReadonlyArray<Space>;
  labels: ReadonlyArray<Label>;
  issues: ReadonlyArray<IssueSummary>;
  /** Issues currently in the `triage` category across all spaces. */
  triageIssues: ReadonlyArray<IssueSummary>;
  filter: MultilinearFilterState;
  view: MultilinearView;
  loading: boolean;
  /** Last command/query failure, shown as a toastable message. */
  error: string | null;

  /** Workflow profiles loaded from the active repo; cached across the view. */
  profiles: ReadonlyArray<WorkflowProfile>;
  /** Profile load failures (`path: reason`), surfaced unobtrusively in the UI. */
  profileErrors: ReadonlyArray<string>;
  /** True once a profiles.list query has resolved (so pickers don't flicker). */
  profilesLoaded: boolean;

  /** Display options (ordering, grouping, shown properties) — persisted. */
  display: DisplayOptions;

  refresh: () => Promise<void>;
  setSpaceFilter: (spaceId: SpaceId | null) => void;
  setAgentBlockedFilter: (agentBlocked: boolean) => void;
  setPriorityFilter: (priorities: ReadonlyArray<Priority>) => void;
  setCategoryFilter: (categories: ReadonlyArray<StatusCategory>) => void;
  setLabelsFilter: (labelIds: ReadonlyArray<LabelId>) => void;
  setDisplay: (display: Partial<DisplayOptions>) => void;
  setView: (view: MultilinearView) => void;
  clearError: () => void;
  /** Load workflow profiles once and cache them (idempotent). */
  loadProfiles: () => Promise<void>;
  /** Execute a command, then refresh board data. Rethrows on failure. */
  runCommand: (command: TrackerCommand) => Promise<void>;
}

const issueFilter = (filter: MultilinearFilterState, category?: StatusCategory): IssueFilter => ({
  ...(filter.spaceId !== null ? { spaceId: filter.spaceId } : {}),
  ...(filter.agentBlocked ? { agentBlocked: true } : {}),
  ...(category !== undefined ? { category } : {}),
});

const errorMessage = (cause: unknown): string =>
  cause instanceof MultilinearApiError ? cause.message : String(cause);

const initialPrefs = loadViewPrefs();

/** Persist the view-configuration slice of the store (MLT-48). */
const persistPrefs = (state: Pick<MultilinearStore, "view" | "display" | "filter">) => {
  saveViewPrefs({
    view: state.view,
    display: state.display,
    filters: {
      priorities: state.filter.priorities,
      categories: state.filter.categories,
      labelIds: state.filter.labelIds,
    },
  });
};

export const useMultilinearStore = create<MultilinearStore>((set, get) => ({
  spaces: [],
  labels: [],
  issues: [],
  triageIssues: [],
  filter: {
    spaceId: null,
    agentBlocked: false,
    priorities: initialPrefs.filters.priorities,
    categories: initialPrefs.filters.categories,
    labelIds: initialPrefs.filters.labelIds,
  },
  view: initialPrefs.view,
  display: initialPrefs.display,
  loading: false,
  error: null,
  profiles: [],
  profileErrors: [],
  profilesLoaded: false,

  refresh: async () => {
    set({ loading: true });
    try {
      const { filter } = get();
      const [spaces, labels, issues, triage] = await Promise.all([
        mlListSpaces(),
        mlListLabels(filter.spaceId ?? undefined),
        mlListIssues(issueFilter(filter)),
        mlListIssues({ category: "triage" }),
      ]);
      set({
        spaces: spaces.spaces,
        labels: labels.labels,
        issues: issues.issues,
        triageIssues: triage.issues,
        loading: false,
        error: null,
      });
    } catch (cause) {
      set({ loading: false, error: errorMessage(cause) });
    }
  },

  setSpaceFilter: (spaceId) => {
    // Labels are per-space; a space switch invalidates the label selection.
    set((state) => ({ filter: { ...state.filter, spaceId, labelIds: [] } }));
    persistPrefs(get());
    void get().refresh();
  },

  setAgentBlockedFilter: (agentBlocked) => {
    set((state) => ({ filter: { ...state.filter, agentBlocked } }));
    void get().refresh();
  },

  // Priority/category filters are applied client-side over the already
  // fetched issues (MLT-48) — no refetch needed.
  setPriorityFilter: (priorities) => {
    set((state) => ({ filter: { ...state.filter, priorities } }));
    persistPrefs(get());
  },

  setCategoryFilter: (categories) => {
    set((state) => ({ filter: { ...state.filter, categories } }));
    persistPrefs(get());
  },

  setLabelsFilter: (labelIds) => {
    set((state) => ({ filter: { ...state.filter, labelIds } }));
    persistPrefs(get());
  },

  setDisplay: (display) => {
    set((state) => ({ display: { ...state.display, ...display } }));
    persistPrefs(get());
  },

  setView: (view) => {
    set({ view });
    persistPrefs(get());
  },

  clearError: () => set({ error: null }),

  loadProfiles: async () => {
    if (get().profilesLoaded) return;
    try {
      const result = await mlListProfiles();
      set({
        profiles: result.profiles,
        profileErrors: result.errors,
        profilesLoaded: true,
      });
    } catch (cause) {
      // Profiles are optional; surface the failure as a profile error rather
      // than blocking the board.
      set({ profileErrors: [errorMessage(cause)], profilesLoaded: true });
    }
  },

  runCommand: async (command) => {
    try {
      await mlCommand(command);
    } catch (cause) {
      set({ error: errorMessage(cause) });
      throw cause;
    }
    await get().refresh();
  },
}));
