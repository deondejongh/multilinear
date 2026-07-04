/**
 * Flat list row for an issue: priority icon · shortId · title · labels ·
 * updated-at. Optional trailing slot for per-row quick actions (triage). Used
 * by the list view and the triage inbox.
 */
import type { ReactNode } from "react";

import type { IssueSummary } from "@multilinear/core/views";

import { formatRelativeTimeLabel } from "~/timestampFormat";
import { cn } from "~/lib/utils";
import { DEFAULT_DISPLAY_OPTIONS, type DisplayOptions } from "../viewPrefs";
import { hasAgentBadges, IssueBadges } from "./IssueBadges";
import { LabelChip } from "./LabelChip";
import { PriorityIcon } from "./PriorityIcon";

export function IssueRow({
  issue,
  selected,
  onSelect,
  onOpen,
  trailing,
  display = DEFAULT_DISPLAY_OPTIONS,
}: {
  issue: IssueSummary;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  trailing?: ReactNode;
  /** Shown properties (MLT-48); agent badges always render. */
  display?: DisplayOptions;
}) {
  return (
    <div
      data-issue-row={issue.id}
      onClick={onSelect}
      onDoubleClick={onOpen}
      className={cn(
        "flex cursor-default items-center gap-3 rounded-md border px-2.5 py-1.5 text-[13px] outline-none transition-colors",
        selected ? "border-primary/50 bg-accent" : "border-transparent hover:bg-accent/50",
      )}
    >
      {display.showPriority ? (
        <PriorityIcon priority={issue.priority} className="shrink-0" />
      ) : null}
      {display.showShortId ? (
        <span className="w-20 shrink-0 truncate font-mono text-[11px] text-muted-foreground">
          {issue.shortId}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-foreground">{issue.title}</span>
      {hasAgentBadges(issue) ? (
        <div className="hidden shrink-0 gap-1 sm:flex">
          <IssueBadges issue={issue} />
        </div>
      ) : null}
      {display.showLabels && issue.labels.length > 0 ? (
        <div className="hidden shrink-0 gap-1 md:flex">
          {issue.labels.slice(0, 3).map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
        </div>
      ) : null}
      <span className="w-16 shrink-0 text-right text-[11px] text-muted-foreground">
        {formatRelativeTimeLabel(issue.updatedAt)}
      </span>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
