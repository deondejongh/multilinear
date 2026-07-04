/**
 * Board view: one column per status category in canonical order, headed by the
 * default status name + count. Column visibility (empty-column hiding) is
 * owned by the index route (MLT-48 "Show empty columns"). The board scrolls
 * horizontally; each column scrolls independently. Selection and keyboard
 * movement are owned by the index route and passed down.
 *
 * Cards drag between columns with the pointer (MLT-49); a drop issues the
 * same `status.change` command as Shift+arrows, via `onDropIssue`. The
 * 6px activation distance keeps plain clicks and double-clicks intact.
 */
import { useCallback, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { ScrollArea } from "~/components/ui/scroll-area";
import type { IssueId, StatusCategory } from "@multilinear/core/model";
import type { IssueSummary } from "@multilinear/core/views";

import { cn } from "~/lib/utils";
import { categoryIcon, categoryLabel } from "../presentation";
import type { CategoryGroup } from "../grouping";
import type { DisplayOptions } from "../viewPrefs";
import { IssueCard } from "./IssueCard";

function DraggableCard({
  issue,
  selected,
  onSelect,
  onOpen,
  display,
}: {
  issue: IssueSummary;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  display: DisplayOptions;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: issue.id,
    data: { issue },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn(isDragging && "opacity-40")}>
      <IssueCard
        issue={issue}
        selected={selected}
        onSelect={onSelect}
        onOpen={onOpen}
        display={display}
      />
    </div>
  );
}

function DroppableColumn({ group, children }: { group: CategoryGroup; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: group.category });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        // Recessed column tint that stays visible against the canvas in both
        // modes — bg-muted/30 was a ~1% tint, indistinguishable from the
        // background (MLT-64).
        "flex h-full w-72 shrink-0 flex-col rounded-lg border transition-colors",
        isOver
          ? "border-primary/50 bg-primary/10"
          : "border-border bg-foreground/[0.04] dark:bg-black/25",
      )}
    >
      {children}
    </div>
  );
}

export function BoardView({
  groups,
  selectedId,
  onSelect,
  onOpen,
  onDropIssue,
  display,
}: {
  groups: ReadonlyArray<CategoryGroup>;
  selectedId: IssueId | null;
  onSelect: (issue: IssueSummary) => void;
  onOpen: (issue: IssueSummary) => void;
  onDropIssue: (issue: IssueSummary, target: StatusCategory) => void;
  display: DisplayOptions;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [draggingIssue, setDraggingIssue] = useState<IssueSummary | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const issue = event.active.data.current?.issue as IssueSummary | undefined;
    setDraggingIssue(issue ?? null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggingIssue(null);
      const issue = event.active.data.current?.issue as IssueSummary | undefined;
      const target = event.over?.id as StatusCategory | undefined;
      if (issue && target !== undefined && target !== issue.category) {
        onDropIssue(issue, target);
      }
    },
    [onDropIssue],
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
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <ScrollArea className="h-full" chainVerticalScroll>
          <div className="flex h-full min-h-0 gap-3 p-3">
            {groups.map((group) => {
              const Icon = categoryIcon(group.category);
              return (
                <DroppableColumn key={group.category} group={group}>
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
                          <DraggableCard
                            key={issue.id}
                            issue={issue}
                            selected={issue.id === selectedId}
                            onSelect={() => onSelect(issue)}
                            onOpen={() => onOpen(issue)}
                            display={display}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </DroppableColumn>
              );
            })}
            {groups.length === 0 ? (
              <p className={cn("m-auto text-sm text-muted-foreground")}>No issues yet.</p>
            ) : null}
          </div>
        </ScrollArea>
        <DragOverlay>
          {draggingIssue ? (
            <div className="w-[272px] cursor-grabbing">
              <IssueCard
                issue={draggingIssue}
                selected
                onSelect={() => undefined}
                onOpen={() => undefined}
                display={display}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
