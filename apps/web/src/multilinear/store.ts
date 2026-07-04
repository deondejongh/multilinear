/**
 * Zustand store for the multilinear tracker views: filters, cached board
 * data, and command execution with refresh-on-mutation. Follows the
 * conventions of the other top-level `<domain>Store.ts` stores.
 */
import { create } from "zustand";

import type { IssueFilter } from "@multilinear/core/api";
import type { Label, Space, StatusCategory } from "@multilinear/core/model";
import type { IssueSummary } from "@multilinear/core/views";

import {
  mlCommand,
  mlListIssues,
  mlListLabels,
  mlListSpaces,
  MultilinearApiError,
  type LabelId,
  type SpaceId,
  type TrackerCommand,
} from "./api";

export type MultilinearView = "board" | "list";

export interface MultilinearFilterState {
  spaceId: SpaceId | null;
  labelId: LabelId | null;
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

  refresh: () => Promise<void>;
  setSpaceFilter: (spaceId: SpaceId | null) => void;
  setLabelFilter: (labelId: LabelId | null) => void;
  setView: (view: MultilinearView) => void;
  clearError: () => void;
  /** Execute a command, then refresh board data. Rethrows on failure. */
  runCommand: (command: TrackerCommand) => Promise<void>;
}

const issueFilter = (filter: MultilinearFilterState, category?: StatusCategory): IssueFilter => ({
  ...(filter.spaceId !== null ? { spaceId: filter.spaceId } : {}),
  ...(filter.labelId !== null ? { labelId: filter.labelId } : {}),
  ...(category !== undefined ? { category } : {}),
});

const errorMessage = (cause: unknown): string =>
  cause instanceof MultilinearApiError ? cause.message : String(cause);

export const useMultilinearStore = create<MultilinearStore>((set, get) => ({
  spaces: [],
  labels: [],
  issues: [],
  triageIssues: [],
  filter: { spaceId: null, labelId: null },
  view: "board",
  loading: false,
  error: null,

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
    set((state) => ({ filter: { ...state.filter, spaceId, labelId: null } }));
    void get().refresh();
  },

  setLabelFilter: (labelId) => {
    set((state) => ({ filter: { ...state.filter, labelId } }));
    void get().refresh();
  },

  setView: (view) => set({ view }),

  clearError: () => set({ error: null }),

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
