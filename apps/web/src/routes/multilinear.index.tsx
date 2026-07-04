import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { STATUS_CATEGORIES, type IssueId, type StatusCategory } from "@multilinear/core/model";
import type { IssueSummary } from "@multilinear/core/views";

import { Spinner } from "~/components/ui/spinner";
import { toastManager } from "~/components/ui/toast";
import { mlGetIssue } from "../multilinear/api";
import { BoardView } from "../multilinear/components/BoardView";
import { ListView } from "../multilinear/components/ListView";
import { useReadyGateGuard } from "../multilinear/components/ReadyGateDialog";
import {
  applyViewFilters,
  groupByCategory,
  groupForList,
  orderIssues,
} from "../multilinear/grouping";
import { useMultilinearStore } from "../multilinear/store";
import { useStatusMover } from "../multilinear/statusCache";
import { useTrackerNav } from "../multilinear/useTrackerNav";
import { isTypingTarget } from "../multilinear/useTrackerKeys";

const BOARD_HIDE_WHEN_EMPTY = new Set<StatusCategory>(["duplicate", "cancelled"]);

/** Flat list of `{ category, issue }` in canonical order for keyboard nav. */
interface FlatEntry {
  category: StatusCategory;
  columnIndex: number;
  rowIndex: number;
  issue: IssueSummary;
}

function MultilinearIndex() {
  const issues = useMultilinearStore((state) => state.issues);
  const view = useMultilinearStore((state) => state.view);
  const loading = useMultilinearStore((state) => state.loading);
  const display = useMultilinearStore((state) => state.display);
  const priorities = useMultilinearStore((state) => state.filter.priorities);
  const categories = useMultilinearStore((state) => state.filter.categories);
  const { goToIssue } = useTrackerNav();
  const { moveIssueToCategory } = useStatusMover();
  const readyGate = useReadyGateGuard();

  const [selectedId, setSelectedId] = useState<IssueId | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    if (!loading) setHasLoadedOnce(true);
  }, [loading]);

  // The view pipeline (MLT-48): filter -> order -> group.
  const visibleIssues = useMemo(
    () => orderIssues(applyViewFilters(issues, { priorities, categories }), display.ordering),
    [issues, priorities, categories, display.ordering],
  );

  const groups = useMemo(() => groupByCategory(visibleIssues), [visibleIssues]);

  const listGroups = useMemo(
    () => groupForList(visibleIssues, display.listGrouping),
    [visibleIssues, display.listGrouping],
  );

  // Visible columns (board) mirror BoardView's empty-column hiding so keyboard
  // left/right traversal matches what the user sees.
  const boardColumns = useMemo(
    () =>
      groups.filter(
        (group) => group.issues.length > 0 || !BOARD_HIDE_WHEN_EMPTY.has(group.category),
      ),
    [groups],
  );

  // Keyboard traversal follows the view the user actually sees: board columns
  // or the list's visible groups (MLT-48).
  const flatEntries = useMemo<FlatEntry[]>(() => {
    const entries: FlatEntry[] = [];
    const source =
      view === "board" ? boardColumns : listGroups.map((group) => ({ issues: group.issues }));
    source.forEach((group, columnIndex) => {
      group.issues.forEach((issue, rowIndex) => {
        entries.push({ category: issue.category, columnIndex, rowIndex, issue });
      });
    });
    return entries;
  }, [view, boardColumns, listGroups]);

  // Keep the selection valid across refreshes; drop it if the issue vanished
  // (or was filtered out).
  useEffect(() => {
    if (selectedId !== null && !visibleIssues.some((issue) => issue.id === selectedId)) {
      setSelectedId(null);
    }
  }, [visibleIssues, selectedId]);

  const selectedEntry = flatEntries.find((entry) => entry.issue.id === selectedId) ?? null;

  const selectByColumnRow = useCallback(
    (columnIndex: number, rowIndex: number) => {
      const column = boardColumns[columnIndex];
      if (!column || column.issues.length === 0) return;
      const clampedRow = Math.max(0, Math.min(rowIndex, column.issues.length - 1));
      const issue = column.issues[clampedRow];
      if (issue) setSelectedId(issue.id);
    },
    [boardColumns],
  );

  const flatIndexOfSelected = selectedId
    ? flatEntries.findIndex((entry) => entry.issue.id === selectedId)
    : -1;

  const moverRef = useRef(moveIssueToCategory);
  moverRef.current = moveIssueToCategory;
  const guardRef = useRef(readyGate.guard);
  guardRef.current = readyGate.guard;

  // Shared by keyboard Shift+arrows and board drag-and-drop (MLT-49): both
  // issue the same `status.change`, behind the same ready-gate guard.
  const moveIssueTo = useCallback(async (issue: IssueSummary, target: StatusCategory) => {
    if (target === issue.category) return;

    const runMove = async () => {
      const result = await moverRef.current({
        issueId: issue.id,
        spaceId: issue.spaceId,
        category: target,
      });
      // Selection stays put — the store refresh re-renders the moved card.
      if (!result.ok) {
        toastManager.add({ type: "error", title: "Move rejected", description: result.error });
      }
    };

    // Ready-gate soft warning (03-PHASE-2 §E): fetch the description on demand
    // and confirm before moving an under-specified issue into `ready`.
    if (target === "ready") {
      let description = "";
      try {
        const { detail } = await mlGetIssue(issue.id);
        description = detail.issue.description;
      } catch {
        // Fall through: if we can't fetch the description, don't block the move.
      }
      guardRef.current(description, () => void runMove());
      return;
    }
    await runMove();
  }, []);

  const shiftIssueByCategory = useCallback(
    async (issue: IssueSummary, direction: 1 | -1) => {
      const targetIndex = STATUS_CATEGORIES.indexOf(issue.category) + direction;
      if (targetIndex < 0 || targetIndex >= STATUS_CATEGORIES.length) return;
      const target = STATUS_CATEGORIES[targetIndex];
      if (target) await moveIssueTo(issue, target);
    },
    [moveIssueTo],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (flatEntries.length === 0) return;

      const isBoard = view === "board";

      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault();
          if (isBoard && selectedEntry) {
            selectByColumnRow(selectedEntry.columnIndex, selectedEntry.rowIndex + 1);
          } else if (!isBoard) {
            const next =
              flatIndexOfSelected < 0
                ? 0
                : Math.min(flatIndexOfSelected + 1, flatEntries.length - 1);
            setSelectedId(flatEntries[next]?.issue.id ?? null);
          } else if (!selectedEntry) {
            setSelectedId(flatEntries[0]?.issue.id ?? null);
          }
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          if (isBoard && selectedEntry) {
            selectByColumnRow(selectedEntry.columnIndex, selectedEntry.rowIndex - 1);
          } else if (!isBoard) {
            const prev = flatIndexOfSelected <= 0 ? 0 : flatIndexOfSelected - 1;
            setSelectedId(flatEntries[prev]?.issue.id ?? null);
          } else if (!selectedEntry) {
            setSelectedId(flatEntries[0]?.issue.id ?? null);
          }
          break;
        }
        case "ArrowRight": {
          if (!isBoard) return;
          event.preventDefault();
          if (event.shiftKey) {
            if (selectedEntry) void shiftIssueByCategory(selectedEntry.issue, 1);
          } else if (selectedEntry) {
            selectByColumnRow(selectedEntry.columnIndex + 1, selectedEntry.rowIndex);
          }
          break;
        }
        case "ArrowLeft": {
          if (!isBoard) return;
          event.preventDefault();
          if (event.shiftKey) {
            if (selectedEntry) void shiftIssueByCategory(selectedEntry.issue, -1);
          } else if (selectedEntry) {
            selectByColumnRow(selectedEntry.columnIndex - 1, selectedEntry.rowIndex);
          }
          break;
        }
        case "Enter": {
          if (selectedEntry) {
            event.preventDefault();
            goToIssue(selectedEntry.issue.shortId);
          }
          break;
        }
        default:
          break;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    flatEntries,
    flatIndexOfSelected,
    goToIssue,
    selectByColumnRow,
    selectedEntry,
    shiftIssueByCategory,
    view,
  ]);

  const onSelect = useCallback((issue: IssueSummary) => setSelectedId(issue.id), []);
  const onOpen = useCallback((issue: IssueSummary) => goToIssue(issue.shortId), [goToIssue]);

  if (loading && !hasLoadedOnce) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {view === "board" ? (
        <BoardView
          groups={groups}
          selectedId={selectedId}
          onSelect={onSelect}
          onOpen={onOpen}
          onDropIssue={(issue, target) => void moveIssueTo(issue, target)}
          display={display}
        />
      ) : (
        <ListView
          groups={listGroups}
          selectedId={selectedId}
          onSelect={onSelect}
          onOpen={onOpen}
          display={display}
        />
      )}
      {readyGate.dialog}
    </>
  );
}

export const Route = createFileRoute("/multilinear/")({
  component: MultilinearIndex,
});
