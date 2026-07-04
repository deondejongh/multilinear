/**
 * Triage inbox list: all issues in the `triage` category across spaces. Same
 * list-row UI; Enter opens; per-row quick actions move the issue to another
 * category's status in its own space.
 */
import { useCallback, useEffect, useState } from "react";
import { MoreHorizontalIcon } from "lucide-react";

import type { IssueId, StatusCategory } from "@multilinear/core/model";
import type { IssueSummary } from "@multilinear/core/views";

import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { InboxIcon } from "lucide-react";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { ScrollArea } from "~/components/ui/scroll-area";
import { toastManager } from "~/components/ui/toast";
import { useStatusMover } from "../statusCache";
import { useTrackerNav } from "../useTrackerNav";
import { IssueRow } from "./IssueRow";

const QUICK_ACTIONS: ReadonlyArray<{ label: string; category: StatusCategory }> = [
  { label: "Move to Backlog", category: "backlog" },
  { label: "Move to Ready", category: "ready" },
  { label: "Cancel", category: "cancelled" },
];

export function TriageList({ issues }: { issues: ReadonlyArray<IssueSummary> }) {
  const { goToIssue } = useTrackerNav();
  const { moveIssueToCategory } = useStatusMover();
  const [selectedId, setSelectedId] = useState<IssueId | null>(null);

  useEffect(() => {
    if (selectedId !== null && !issues.some((issue) => issue.id === selectedId)) {
      setSelectedId(null);
    }
  }, [issues, selectedId]);

  const move = useCallback(
    async (issue: IssueSummary, category: StatusCategory) => {
      const result = await moveIssueToCategory({
        issueId: issue.id,
        spaceId: issue.spaceId,
        category,
      });
      if (!result.ok) {
        toastManager.add({ type: "error", title: "Move rejected", description: result.error });
      }
    },
    [moveIssueToCategory],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable)
          return;
        if (target.closest("[role='dialog'], [data-slot='dialog-popup']")) return;
      }
      if (issues.length === 0) return;
      const index = selectedId ? issues.findIndex((issue) => issue.id === selectedId) : -1;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = index < 0 ? 0 : Math.min(index + 1, issues.length - 1);
        setSelectedId(issues[next]?.id ?? null);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        const prev = index <= 0 ? 0 : index - 1;
        setSelectedId(issues[prev]?.id ?? null);
      } else if (event.key === "Enter" && selectedId) {
        event.preventDefault();
        goToIssue(selectedId);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [goToIssue, issues, selectedId]);

  if (issues.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>Triage is clear</EmptyTitle>
          <EmptyDescription>New issues land here until you sort them.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-0.5 p-3">
        {issues.map((issue) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            selected={issue.id === selectedId}
            onSelect={() => setSelectedId(issue.id)}
            onOpen={() => goToIssue(issue.id)}
            trailing={
              <Menu>
                <MenuTrigger
                  render={<Button variant="ghost" size="icon-xs" aria-label="Triage actions" />}
                >
                  <MoreHorizontalIcon className="size-4" />
                </MenuTrigger>
                <MenuPopup align="end">
                  {QUICK_ACTIONS.map((action) => (
                    <MenuItem
                      key={action.category}
                      onClick={() => void move(issue, action.category)}
                    >
                      {action.label}
                    </MenuItem>
                  ))}
                </MenuPopup>
              </Menu>
            }
          />
        ))}
      </div>
    </ScrollArea>
  );
}
