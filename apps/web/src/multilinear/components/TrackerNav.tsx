/**
 * Slim tracker nav column (its own column, mirroring the settings sub-nav):
 * Board, Triage (with a count badge), a Spaces section (click filters; "All
 * spaces" resets), and a New space button. Space filtering flows through the
 * store; navigation uses the tracker nav helpers.
 */
import { useLocation } from "@tanstack/react-router";
import { LayoutGridIcon, InboxIcon, PlusIcon } from "lucide-react";

import type { SpaceId } from "@multilinear/core/model";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { cn } from "~/lib/utils";
import { useMultilinearStore } from "../store";
import { useTrackerNav } from "../useTrackerNav";

function NavButton({
  active,
  icon: Icon,
  label,
  onClick,
  trailing,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] outline-none transition-colors",
        active
          ? "bg-accent font-medium text-foreground"
          : "text-muted-foreground/80 hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <Icon
        className={cn("size-4 shrink-0", active ? "text-foreground" : "text-muted-foreground/60")}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

export function TrackerNav({ onNewSpace }: { onNewSpace: () => void }) {
  const location = useLocation();
  const spaces = useMultilinearStore((state) => state.spaces);
  const triageIssues = useMultilinearStore((state) => state.triageIssues);
  const filterSpaceId = useMultilinearStore((state) => state.filter.spaceId);
  const setSpaceFilter = useMultilinearStore((state) => state.setSpaceFilter);
  const { goToBoard, goToTriage } = useTrackerNav();

  const isBoard = location.pathname === "/multilinear";
  const isTriage = location.pathname.startsWith("/multilinear/triage");

  const selectSpace = (spaceId: SpaceId | null) => {
    setSpaceFilter(spaceId);
    if (!isBoard) goToBoard();
  };

  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-background">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 p-2">
          <NavButton active={isBoard} icon={LayoutGridIcon} label="Board" onClick={goToBoard} />
          <NavButton
            active={isTriage}
            icon={InboxIcon}
            label="Triage"
            onClick={goToTriage}
            trailing={
              triageIssues.length > 0 ? (
                <Badge variant="secondary" size="sm" className="font-normal">
                  {triageIssues.length}
                </Badge>
              ) : null
            }
          />

          <div className="mt-3 flex items-center justify-between px-2.5 pb-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
              Spaces
            </span>
            <button
              type="button"
              onClick={onNewSpace}
              aria-label="New space"
              className="text-muted-foreground/70 hover:text-foreground"
            >
              <PlusIcon className="size-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => selectSpace(null)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] outline-none transition-colors",
              filterSpaceId === null
                ? "bg-accent font-medium text-foreground"
                : "text-muted-foreground/80 hover:bg-accent/50 hover:text-foreground",
            )}
          >
            All spaces
          </button>
          {spaces.map((space) => (
            <button
              key={space.id}
              type="button"
              onClick={() => selectSpace(space.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] outline-none transition-colors",
                filterSpaceId === space.id
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground/80 hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <span className="font-mono text-[11px] text-muted-foreground">{space.key}</span>
              <span className="min-w-0 flex-1 truncate">{space.name}</span>
            </button>
          ))}
          {spaces.length === 0 ? (
            <Button variant="outline" size="sm" className="mt-1 justify-start" onClick={onNewSpace}>
              <PlusIcon className="size-3.5" />
              Create a space
            </Button>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
