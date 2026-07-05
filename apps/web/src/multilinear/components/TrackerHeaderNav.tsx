/**
 * Compact header nav cluster (MLT-50): replaces the tracker's second nav
 * column. A space switcher menu (All spaces / each space / Repositories… /
 * New space) plus Issues and Triage tabs. Space filtering flows through the
 * store; navigation uses the tracker nav helpers. Zero upstream mounts —
 * the app sidebar keeps its existing two-line entry.
 */
import { useLocation } from "@tanstack/react-router";
import {
  CheckIcon,
  ChevronDownIcon,
  FolderIcon,
  InboxIcon,
  LayersIcon,
  PlusIcon,
} from "lucide-react";
import { useState } from "react";

import type { Space, SpaceId } from "@multilinear/core/model";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "~/components/ui/menu";
import { cn } from "~/lib/utils";
import { useMultilinearStore } from "../store";
import { useTrackerNav } from "../useTrackerNav";
import { SpaceReposDialog } from "./SpaceReposDialog";

function NavTab({
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
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] outline-none transition-colors",
        active
          ? "bg-accent font-medium text-foreground"
          : "text-muted-foreground/80 hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <Icon className={cn("size-3.5", active ? "text-foreground" : "text-muted-foreground/60")} />
      {label}
      {trailing}
    </button>
  );
}

export function TrackerHeaderNav({ onNewSpace }: { onNewSpace: () => void }) {
  const location = useLocation();
  const spaces = useMultilinearStore((state) => state.spaces);
  const triageIssues = useMultilinearStore((state) => state.triageIssues);
  const filterSpaceId = useMultilinearStore((state) => state.filter.spaceId);
  const setSpaceFilter = useMultilinearStore((state) => state.setSpaceFilter);
  const { goToBoard, goToTriage } = useTrackerNav();
  const [reposSpace, setReposSpace] = useState<Space | null>(null);

  const isIssues = location.pathname === "/multilinear";
  const isTriage = location.pathname.startsWith("/multilinear/triage");

  const activeSpace = spaces.find((space) => space.id === filterSpaceId);

  const selectSpace = (spaceId: SpaceId | null) => {
    setSpaceFilter(spaceId);
    if (!isIssues) goToBoard();
  };

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Menu>
        <MenuTrigger
          render={<Button variant="ghost" size="sm" className="max-w-56" aria-label="Space" />}
        >
          {activeSpace ? (
            <>
              <span className="font-mono text-[11px] text-muted-foreground">{activeSpace.key}</span>
              <span className="min-w-0 truncate">{activeSpace.name}</span>
            </>
          ) : (
            "All spaces"
          )}
          <ChevronDownIcon className="size-3.5 text-muted-foreground/70" />
        </MenuTrigger>
        <MenuPopup align="start" className="min-w-52">
          <MenuItem onClick={() => selectSpace(null)}>
            <span className="min-w-0 flex-1 truncate">All spaces</span>
            {filterSpaceId === null ? <CheckIcon className="size-3.5" /> : null}
          </MenuItem>
          {spaces.map((space) => (
            <MenuItem key={space.id} onClick={() => selectSpace(space.id)}>
              <span className="font-mono text-[11px] text-muted-foreground">{space.key}</span>
              <span className="min-w-0 flex-1 truncate">{space.name}</span>
              {filterSpaceId === space.id ? <CheckIcon className="size-3.5" /> : null}
            </MenuItem>
          ))}
          <MenuSeparator />
          {activeSpace ? (
            <MenuItem onClick={() => setReposSpace(activeSpace)}>
              <FolderIcon className="size-3.5 text-muted-foreground" />
              Repositories…
            </MenuItem>
          ) : null}
          <MenuItem onClick={onNewSpace}>
            <PlusIcon className="size-3.5 text-muted-foreground" />
            New space
          </MenuItem>
        </MenuPopup>
      </Menu>

      <NavTab active={isIssues} icon={LayersIcon} label="Issues" onClick={goToBoard} />
      <NavTab
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

      <SpaceReposDialog
        space={reposSpace}
        onOpenChange={(open) => {
          if (!open) setReposSpace(null);
        }}
      />
    </div>
  );
}
