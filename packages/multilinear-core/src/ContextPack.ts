/**
 * Context pack — the markdown briefing handed to an agent picking up an
 * issue (02-PHASE-1 §D). Pure function over the issue detail view; runs in
 * the browser (the web client compiles the pack client-side).
 */
import type { IssueDetail } from "./Views.ts";

const PRIORITY_LABELS = ["No priority", "Urgent", "High", "Medium", "Low"] as const;

const RELATION_SECTION_KINDS = ["blocks", "blocked_by", "parent", "discovered_from"] as const;

const RELATION_HEADINGS: Record<(typeof RELATION_SECTION_KINDS)[number], string> = {
  blocks: "Blocks",
  blocked_by: "Blocked by",
  parent: "Parent",
  discovered_from: "Discovered from",
};

export interface ContextPackOptions {
  /** Number of most-recent comments to include. */
  readonly maxComments?: number;
}

export const buildContextPack = (detail: IssueDetail, options?: ContextPackOptions): string => {
  const maxComments = options?.maxComments ?? 10;
  const lines: string[] = [];

  lines.push(`# Issue ${detail.shortId}: ${detail.issue.title}`);
  const labels =
    detail.labels.length > 0 ? detail.labels.map((label) => label.name).join(", ") : "none";
  lines.push(
    `Space: ${detail.space.name} · Priority: ${PRIORITY_LABELS[detail.issue.priority] ?? "Unknown"} · Labels: ${labels}`,
  );

  lines.push("", "## Description");
  lines.push(
    detail.issue.description.trim() === "" ? "(no description)" : detail.issue.description.trim(),
  );

  const relationLines: string[] = [];
  for (const kind of RELATION_SECTION_KINDS) {
    const matches = detail.relations.filter((relation) => relation.kind === kind);
    for (const relation of matches) {
      relationLines.push(
        `- ${RELATION_HEADINGS[kind]}: ${relation.otherShortId} — ${relation.otherTitle}`,
      );
    }
  }
  if (relationLines.length > 0) {
    lines.push("", "## Relevant relations", ...relationLines);
  }

  const comments = detail.comments.slice(-maxComments);
  if (comments.length > 0) {
    lines.push("", "## Recent discussion");
    for (const comment of comments) {
      lines.push(`- ${comment.actor.kind}:${comment.actor.id} — ${comment.body}`);
    }
  }

  lines.push(
    "",
    "## Instructions",
    "Work only on this issue. When done, summarize what you did and what you did",
    "not do. File any discovered follow-up work as a note at the end.",
    "",
  );

  return lines.join("\n");
};
