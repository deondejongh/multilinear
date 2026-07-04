/**
 * Per-space status cache + helpers to move an issue to another category's
 * status. Statuses rarely change, so we memoize the `mlListStatuses` result per
 * space id for the lifetime of the tracker view. Shared by the board
 * (Shift+arrow), the triage quick actions, and the detail status select.
 */
import { useCallback, useRef } from "react";

import type { Status, StatusCategory } from "@multilinear/core/model";
import type { IssueId, SpaceId } from "@multilinear/core/model";

import { mlListStatuses } from "./api";
import { useMultilinearStore } from "./store";

export type SpaceStatuses = ReadonlyArray<Status>;

/**
 * Returns a memoized loader and a mover. `moveIssueToCategory` finds the
 * target category's status in the issue's space and runs `status.change`.
 * Returns `true` on success, `false` when rejected (e.g. done-guard) — the
 * caller surfaces a toast.
 */
export function useStatusMover() {
  const runCommand = useMultilinearStore((state) => state.runCommand);
  const cacheRef = useRef<Map<SpaceId, SpaceStatuses>>(new Map());

  const loadStatuses = useCallback(async (spaceId: SpaceId): Promise<SpaceStatuses> => {
    const cached = cacheRef.current.get(spaceId);
    if (cached) return cached;
    const result = await mlListStatuses(spaceId);
    cacheRef.current.set(spaceId, result.statuses);
    return result.statuses;
  }, []);

  const moveIssueToCategory = useCallback(
    async (input: {
      issueId: IssueId;
      spaceId: SpaceId;
      category: StatusCategory;
    }): Promise<{ ok: true } | { ok: false; error: string }> => {
      let statuses: SpaceStatuses;
      try {
        statuses = await loadStatuses(input.spaceId);
      } catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : String(cause) };
      }
      const target = statuses.find((status) => status.category === input.category);
      if (!target) {
        return { ok: false, error: `No ${input.category} status in this space` };
      }
      try {
        await runCommand({ type: "status.change", issueId: input.issueId, statusId: target.id });
        return { ok: true };
      } catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : String(cause) };
      }
    },
    [loadStatuses, runCommand],
  );

  return { loadStatuses, moveIssueToCategory };
}
