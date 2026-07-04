/**
 * Board card for a single issue: shortId, title (2-line clamp), priority
 * indicator, label chips, and a non-`work` type badge. Selection renders an
 * accent ring. Click selects; double-click / Enter (handled by the board)
 * opens detail.
 */
import type { IssueSummary } from "@multilinear/core/views";

import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { ISSUE_TYPE_LABELS } from "../presentation";
import { hasAgentBadges, IssueBadges } from "./IssueBadges";
import { LabelChip } from "./LabelChip";
import { PriorityIcon } from "./PriorityIcon";

export function IssueCard({
  issue,
  selected,
  onSelect,
  onOpen,
}: {
  issue: IssueSummary;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      data-issue-card={issue.id}
      onClick={onSelect}
      onDoubleClick={onOpen}
      className={cn(
        "flex w-full flex-col gap-2 rounded-lg border bg-card p-2.5 text-left outline-none transition-shadow",
        "hover:border-foreground/20",
        selected ? "border-primary/60 ring-2 ring-primary/40" : "border-border",
      )}
    >
      <div className="flex items-center gap-2">
        <PriorityIcon priority={issue.priority} />
        <span className="font-mono text-[11px] text-muted-foreground">{issue.shortId}</span>
        {issue.issueType !== "work" ? (
          <Badge variant="secondary" size="sm" className="ms-auto font-normal">
            {ISSUE_TYPE_LABELS[issue.issueType]}
          </Badge>
        ) : null}
      </div>
      <p className="line-clamp-2 text-[13px] leading-snug text-foreground">{issue.title}</p>
      {hasAgentBadges(issue) ? (
        <div className="flex flex-wrap gap-1">
          <IssueBadges issue={issue} />
        </div>
      ) : null}
      {issue.labels.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {issue.labels.map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
        </div>
      ) : null}
    </button>
  );
}
