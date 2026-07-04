/**
 * Board view: one column per status category in canonical order, headed by the
 * default status name + count. The `duplicate` / `cancelled` columns are hidden
 * while empty to keep the strip tight. The board scrolls horizontally; each
 * column scrolls independently. Selection and keyboard movement are owned by
 * the index route and passed down.
 */
import { useCallback, useRef } from "react";

import { ScrollArea } from "~/components/ui/scroll-area";
import type { IssueId } from "@multilinear/core/model";
import type { IssueSummary } from "@multilinear/core/views";

import { cn } from "~/lib/utils";
import { categoryIcon, categoryLabel } from "../presentation";
import type { CategoryGroup } from "../grouping";
import { IssueCard } from "./IssueCard";

const HIDE_WHEN_EMPTY = new Set(["duplicate", "cancelled"]);

export function BoardView({
  groups,
  selectedId,
  onSelect,
  onOpen,
}: {
  groups: ReadonlyArray<CategoryGroup>;
  selectedId: IssueId | null;
  onSelect: (issue: IssueSummary) => void;
  onOpen: (issue: IssueSummary) => void;
}) {
  const visible = groups.filter(
    (group) => group.issues.length > 0 || !HIDE_WHEN_EMPTY.has(group.category),
  );

  const rootRef = useRef<HTMLDivElement>(null);
  // The column viewports are `overscroll-contain`, which stops horizontal
  // wheel/trackpad deltas from chaining to the board's horizontal scroller
  // (MLT-45). Route dominant-horizontal deltas (and shift+wheel) to the outer
  // viewport whenever the event originates inside a column.
  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const horizontal =
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.shiftKey
          ? event.deltaY
          : 0;
    if (horizontal === 0) return;
    const outerViewport = rootRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    if (!outerViewport) return;
    const nearestViewport = (event.target as HTMLElement).closest(
      '[data-slot="scroll-area-viewport"]',
    );
    // In the gaps the outer viewport is the nearest scroller and native
    // chaining already works; only columns need the assist.
    if (nearestViewport === outerViewport) return;
    outerViewport.scrollLeft += horizontal;
  }, []);

  return (
    <div ref={rootRef} onWheel={handleWheel} className="h-full">
      <ScrollArea className="h-full" chainVerticalScroll>
        <div className="flex h-full min-h-0 gap-3 p-3">
          {visible.map((group) => {
            const Icon = categoryIcon(group.category);
            return (
              <div
                key={group.category}
                className="flex h-full w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/30"
              >
                <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                  <Icon className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">
                    {categoryLabel(group.category)}
                  </span>
                  <span className="ms-auto text-[11px] text-muted-foreground">
                    {group.issues.length}
                  </span>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                  <div className="flex flex-col gap-2 p-2">
                    {group.issues.length === 0 ? (
                      <p className="px-1 py-6 text-center text-[11px] text-muted-foreground/70">
                        No issues
                      </p>
                    ) : (
                      group.issues.map((issue) => (
                        <IssueCard
                          key={issue.id}
                          issue={issue}
                          selected={issue.id === selectedId}
                          onSelect={() => onSelect(issue)}
                          onOpen={() => onOpen(issue)}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
          {visible.length === 0 ? (
            <p className={cn("m-auto text-sm text-muted-foreground")}>No issues yet.</p>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
