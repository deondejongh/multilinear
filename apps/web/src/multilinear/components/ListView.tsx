/**
 * List view: flat rows with sticky group headers. Groups come from the view
 * pipeline (status / priority / none — MLT-48); selection and keyboard
 * movement are owned by the index route.
 */
import { ScrollArea } from "~/components/ui/scroll-area";
import type { IssueId } from "@multilinear/core/model";
import type { IssueSummary } from "@multilinear/core/views";

import { categoryIcon } from "../presentation";
import type { ListGroup } from "../grouping";
import type { DisplayOptions } from "../viewPrefs";
import { IssueRow } from "./IssueRow";
import { PriorityIcon } from "./PriorityIcon";

function GroupIcon({ group }: { group: ListGroup }) {
  if (group.category !== undefined) {
    const Icon = categoryIcon(group.category);
    return <Icon className="size-3.5 text-muted-foreground" />;
  }
  if (group.priority !== undefined) {
    return <PriorityIcon priority={group.priority} />;
  }
  return null;
}

export function ListView({
  groups,
  selectedId,
  onSelect,
  onOpen,
  display,
}: {
  groups: ReadonlyArray<ListGroup>;
  selectedId: IssueId | null;
  onSelect: (issue: IssueSummary) => void;
  onOpen: (issue: IssueSummary) => void;
  display: DisplayOptions;
}) {
  const nonEmpty = display.showEmptyGroups
    ? groups
    : groups.filter((group) => group.issues.length > 0);

  if (nonEmpty.every((group) => group.issues.length === 0)) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No issues yet.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-3">
        {nonEmpty.map((group) => (
          <div key={group.key} className="flex flex-col">
            <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 py-1.5 backdrop-blur">
              <GroupIcon group={group} />
              <span className="text-xs font-medium text-foreground">{group.label}</span>
              <span className="text-[11px] text-muted-foreground">{group.issues.length}</span>
            </div>
            <div className="flex flex-col">
              {group.issues.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  selected={issue.id === selectedId}
                  onSelect={() => onSelect(issue)}
                  onOpen={() => onOpen(issue)}
                  display={display}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
