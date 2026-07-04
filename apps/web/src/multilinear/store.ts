/**
 * Zustand store for the multilinear tracker views: filters, cached board
 * data, and command execution with refresh-on-mutation. Follows the
 * conventions of the other top-level `<domain>Store.ts` stores.
 */
import { create } from "zustand";

import type { IssueFilter } from "@multilinear/core/api";
import type { Label, Space, StatusCategory } from "@multilinear/core/model";
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

export type MultilinearView = "board" | "list";

export interface MultilinearFilterState {
  spaceId: SpaceId | null;
  labelId: LabelId | null;
  /** When true, only issues currently marked Agent Blocked. */
  agentBlocked: boolean;
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

  refresh: () => Promise<void>;
  setSpaceFilter: (spaceId: SpaceId | null) => void;
  setLabelFilter: (labelId: LabelId | null) => void;
  setAgentBlockedFilter: (agentBlocked: boolean) => void;
  setView: (view: MultilinearView) => void;
  clearError: () => void;
  /** Load workflow profiles once and cache them (idempotent). */
  loadProfiles: () => Promise<void>;
  /** Execute a command, then refresh board data. Rethrows on failure. */
  runCommand: (command: TrackerCommand) => Promise<void>;
}

const issueFilter = (filter: MultilinearFilterState, category?: StatusCategory): IssueFilter => ({
  ...(filter.spaceId !== null ? { spaceId: filter.spaceId } : {}),
  ...(filter.labelId !== null ? { labelId: filter.labelId } : {}),
  ...(filter.agentBlocked ? { agentBlocked: true } : {}),
  ...(category !== undefined ? { category } : {}),
});

const errorMessage = (cause: unknown): string =>
  cause instanceof MultilinearApiError ? cause.message : String(cause);

export const useMultilinearStore = create<MultilinearStore>((set, get) => ({
  spaces: [],
  labels: [],
  issues: [],
  triageIssues: [],
  filter: { spaceId: null, labelId: null, agentBlocked: false },
  view: "board",
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
    set((state) => ({ filter: { ...state.filter, spaceId, labelId: null } }));
    void get().refresh();
  },

  setLabelFilter: (labelId) => {
    set((state) => ({ filter: { ...state.filter, labelId } }));
    void get().refresh();
  },

  setAgentBlockedFilter: (agentBlocked) => {
    set((state) => ({ filter: { ...state.filter, agentBlocked } }));
    void get().refresh();
  },

  setView: (view) => set({ view }),

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
