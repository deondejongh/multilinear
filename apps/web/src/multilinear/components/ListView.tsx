/**
 * List view: flat rows grouped by category with sticky group headers. Selection
 * and keyboard movement are owned by the index route.
 */
import { ScrollArea } from "~/components/ui/scroll-area";
import type { IssueId } from "@multilinear/core/model";
import type { IssueSummary } from "@multilinear/core/views";

import { categoryIcon, categoryLabel } from "../presentation";
import type { CategoryGroup } from "../grouping";
import { IssueRow } from "./IssueRow";

export function ListView({
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
  const nonEmpty = groups.filter((group) => group.issues.length > 0);

  if (nonEmpty.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No issues yet.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-3">
        {nonEmpty.map((group) => {
          const Icon = categoryIcon(group.category);
          return (
            <div key={group.category} className="flex flex-col">
              <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 py-1.5 backdrop-blur">
                <Icon className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">
                  {categoryLabel(group.category)}
                </span>
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
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
