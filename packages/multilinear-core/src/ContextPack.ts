/**
 * Context pack v2 — the markdown briefing handed to an agent picking up an
 * issue (03-PHASE-2 §F). Assembled from the workflow-profile prompt template
 * + issue + relations + compacted discussion: the last N comments verbatim,
 * one-line summaries of older ones (a naive stub for the Beads-style
 * memory-decay idea). Pure function over the issue detail view; runs in the
 * browser (the web client compiles the pack client-side).
 */
import type { WorkflowProfile } from "./Profile.ts";
import type { IssueDetail } from "./Views.ts";

const PRIORITY_LABELS = ["No priority", "Urgent", "High", "Medium", "Low"] as const;

const RELATION_SECTION_KINDS = ["blocks", "blocked_by", "parent", "discovered_from"] as const;

const RELATION_HEADINGS: Record<(typeof RELATION_SECTION_KINDS)[number], string> = {
  blocks: "Blocks",
  blocked_by: "Blocked by",
  parent: "Parent",
  discovered_from: "Discovered from",
};

/** Marker a profile body may use to position the briefing explicitly. */
export const CONTEXT_PACK_PLACEHOLDER = "{{CONTEXT_PACK}}";

export interface ContextPackOptions {
  /** Profile whose prompt template wraps the briefing (v2). */
  readonly profile?: WorkflowProfile;
  /** Number of most-recent comments included verbatim. */
  readonly maxVerbatimComments?: number;
}

const summarizeLine = (text: string, maxLength = 100): string => {
  const firstLine = (text.split("\n").find((line) => line.trim() !== "") ?? "").trim();
  return firstLine.length <= maxLength ? firstLine : `${firstLine.slice(0, maxLength - 1)}…`;
};

/** The issue briefing: everything an agent needs to start, minus the prompt. */
const buildIssueBriefing = (detail: IssueDetail, maxVerbatimComments: number): string => {
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

  if (detail.comments.length > 0) {
    lines.push("", "## Discussion");
    const older = detail.comments.slice(
      0,
      Math.max(0, detail.comments.length - maxVerbatimComments),
    );
    const recent = detail.comments.slice(-maxVerbatimComments);
    if (older.length > 0) {
      lines.push(`Earlier discussion, summarized (${older.length} comments):`);
      for (const comment of older) {
        lines.push(`- ${comment.actor.kind}:${comment.actor.id} — ${summarizeLine(comment.body)}`);
      }
      lines.push("", "Most recent comments, verbatim:");
    }
    for (const comment of recent) {
      lines.push("", `> **${comment.actor.kind}:${comment.actor.id}**`);
      for (const bodyLine of comment.body.split("\n")) {
        lines.push(`> ${bodyLine}`);
      }
    }
  }

  lines.push(
    "",
    "## Instructions",
    "Work only on this issue. When done, summarize what you did and what you did",
    "not do. File any discovered follow-up work as a note at the end.",
    "",
    "Track your work with the multilinear MCP tools (`ml_*`, served by the",
    "`t3-code` MCP server). If they are not in your visible tool list, discover",
    'them first (e.g. run `tool_search` for "multilinear") before concluding',
    "they are unavailable.",
    "",
  );

  return lines.join("\n");
};

/**
 * Build the context pack. With a profile, its prompt-template body wraps the
 * briefing — either at the `{{CONTEXT_PACK}}` placeholder or appended after
 * a separator when the placeholder is absent.
 */
export const buildContextPack = (detail: IssueDetail, options?: ContextPackOptions): string => {
  const briefing = buildIssueBriefing(detail, options?.maxVerbatimComments ?? 5);
  const profile = options?.profile;
  if (profile === undefined) return briefing;
  const body = profile.body.trim();
  if (body.includes(CONTEXT_PACK_PLACEHOLDER)) {
    return `${body.split(CONTEXT_PACK_PLACEHOLDER).join(briefing)}\n`;
  }
  return `${body}\n\n---\n\n${briefing}`;
};
