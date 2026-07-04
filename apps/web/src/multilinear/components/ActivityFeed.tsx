/**
 * Activity feed rendered from real `StoredTrackerEvent`s. Each entry maps its
 * event type to an icon and a human sentence ("deon created this issue",
 * "codex moved Triage → In Progress", "added label perf"…), an actor-kind badge
 * when the actor is not human, and a relative timestamp. Status ids in
 * `status.changed` events are resolved to names via the space's statuses.
 */
import type { ComponentType } from "react";
import {
  ArrowRightIcon,
  CircleDotIcon,
  FilePlusIcon,
  LinkIcon,
  MessageSquareIcon,
  PencilIcon,
  TagIcon,
} from "lucide-react";

import type { Label, Status } from "@multilinear/core/model";
import type { StoredTrackerEvent, TrackerEvent } from "@multilinear/core/events";

import { Badge } from "~/components/ui/badge";
import { formatRelativeTimeLabel } from "~/timestampFormat";

function statusName(statuses: ReadonlyArray<Status>, id: string): string {
  return statuses.find((status) => status.id === id)?.name ?? "a status";
}

function labelName(labels: ReadonlyArray<Label>, id: string): string {
  return labels.find((label) => label.id === id)?.name ?? "a label";
}

interface Rendered {
  icon: ComponentType<{ className?: string }>;
  sentence: string;
}

function renderEvent(
  event: TrackerEvent,
  statuses: ReadonlyArray<Status>,
  labels: ReadonlyArray<Label>,
): Rendered | null {
  const actor = event.actor.id;
  switch (event.type) {
    case "issue.created":
      return { icon: FilePlusIcon, sentence: `${actor} created this issue` };
    case "issue.updated": {
      const fields: string[] = [];
      if (event.payload.title !== undefined) fields.push("title");
      if (event.payload.description !== undefined) fields.push("description");
      if (event.payload.priority !== undefined) fields.push("priority");
      if (event.payload.issueType !== undefined) fields.push("type");
      const what = fields.length > 0 ? fields.join(", ") : "the issue";
      return { icon: PencilIcon, sentence: `${actor} updated ${what}` };
    }
    case "status.changed":
      return {
        icon: CircleDotIcon,
        sentence: `${actor} moved ${statusName(statuses, event.payload.fromStatusId)} → ${statusName(
          statuses,
          event.payload.toStatusId,
        )}`,
      };
    case "label.added":
      return {
        icon: TagIcon,
        sentence: `${actor} added label ${labelName(labels, event.payload.labelId)}`,
      };
    case "label.removed":
      return {
        icon: TagIcon,
        sentence: `${actor} removed label ${labelName(labels, event.payload.labelId)}`,
      };
    case "comment.added":
      return { icon: MessageSquareIcon, sentence: `${actor} commented` };
    case "relation.added":
      return { icon: ArrowRightIcon, sentence: `${actor} added a relation` };
    case "relation.removed":
      return { icon: ArrowRightIcon, sentence: `${actor} removed a relation` };
    case "run.linked":
      return { icon: LinkIcon, sentence: `${actor} linked a ${event.payload.kind}` };
    // Space/status/label creation events are not issue-scoped narratives.
    default:
      return null;
  }
}

export function ActivityFeed({
  entries,
  statuses,
  labels,
}: {
  entries: ReadonlyArray<StoredTrackerEvent>;
  statuses: ReadonlyArray<Status>;
  labels: ReadonlyArray<Label>;
}) {
  const rendered = entries
    .map((entry) => ({ entry, view: renderEvent(entry.event, statuses, labels) }))
    .filter((item): item is { entry: StoredTrackerEvent; view: Rendered } => item.view !== null);

  if (rendered.length === 0) {
    return <p className="text-xs text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ul className="space-y-2.5">
      {rendered.map(({ entry, view }) => {
        const Icon = view.icon;
        const kind = entry.event.actor.kind;
        return (
          <li key={entry.event.id} className="flex items-start gap-2 text-xs">
            <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              <span className="text-foreground/90">{view.sentence}</span>
              {kind !== "human" ? (
                <Badge variant="secondary" size="sm" className="font-normal">
                  {kind}
                </Badge>
              ) : null}
              <span className="text-muted-foreground">
                · {formatRelativeTimeLabel(entry.event.ts)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
