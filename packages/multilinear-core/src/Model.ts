/**
 * Core entity schemas for the multilinear tracker (01-ARCHITECTURE §3).
 *
 * Browser-safe: this module imports only `effect`. Vocabulary is binding
 * (01 §5): issues, spaces, rules — never tasks, projects, automations.
 */
import * as Schema from "effect/Schema";

import { isUlid } from "./Ulid.ts";

export const TrimmedNonEmptyString = Schema.String.check(Schema.isNonEmpty());

export const IsoDateTime = Schema.String;
export type IsoDateTime = typeof IsoDateTime.Type;

const ulidFilter = Schema.makeFilter(
  (value: string) => isUlid(value) || "Expected a 26-character Crockford base32 ULID",
);

const makeEntityId = <Brand extends string>(brand: Brand) =>
  Schema.String.check(ulidFilter).pipe(Schema.brand(brand));

export const SpaceId = makeEntityId("SpaceId");
export type SpaceId = typeof SpaceId.Type;
export const IssueId = makeEntityId("IssueId");
export type IssueId = typeof IssueId.Type;
export const StatusId = makeEntityId("StatusId");
export type StatusId = typeof StatusId.Type;
export const LabelId = makeEntityId("LabelId");
export type LabelId = typeof LabelId.Type;
export const CommentId = makeEntityId("CommentId");
export type CommentId = typeof CommentId.Type;
export const RelationId = makeEntityId("RelationId");
export type RelationId = typeof RelationId.Type;
export const RunLinkId = makeEntityId("RunLinkId");
export type RunLinkId = typeof RunLinkId.Type;
export const ProofId = makeEntityId("ProofId");
export type ProofId = typeof ProofId.Type;
export const TrackerEventId = makeEntityId("TrackerEventId");
export type TrackerEventId = typeof TrackerEventId.Type;

/**
 * Fixed status categories the machine reasons over (01 §3). Statuses are
 * user-customizable names; categories never change. Order here is the
 * canonical board/column order.
 */
export const STATUS_CATEGORIES = [
  "triage",
  "backlog",
  "ready",
  "in_progress",
  "needs_review",
  "done",
  "cancelled",
  "duplicate",
] as const;

export const StatusCategory = Schema.Literals(STATUS_CATEGORIES);
export type StatusCategory = typeof StatusCategory.Type;

export const IssueType = Schema.Literals(["work", "idea", "spike", "config"]);
export type IssueType = typeof IssueType.Type;

/** 0 = none, 1 = urgent, 2 = high, 3 = medium, 4 = low (Linear convention). */
export const Priority = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 4 }));
export type Priority = typeof Priority.Type;

/** External origin ⇒ lower trust tier (01 §7 invariant 6). */
export const IssueOrigin = Schema.Literals(["local", "github"]);
export type IssueOrigin = typeof IssueOrigin.Type;

export const ActorKind = Schema.Literals(["human", "agent", "rule", "system"]);
export type ActorKind = typeof ActorKind.Type;

export const Actor = Schema.Struct({
  kind: ActorKind,
  id: TrimmedNonEmptyString,
});
export type Actor = typeof Actor.Type;

/**
 * Canonical relation kinds as stored. `blocked_by` and `child` are derived
 * inverse views (STATUS D15): src blocks dst · src's parent is dst ·
 * src duplicates dst · src was discovered while working dst.
 */
export const RelationKind = Schema.Literals([
  "blocks",
  "parent",
  "relates_to",
  "duplicate_of",
  "discovered_from",
]);
export type RelationKind = typeof RelationKind.Type;

/** All six relation kinds accepted at the API surface (02 §A). */
export const RelationKindInput = Schema.Literals([
  "blocks",
  "blocked_by",
  "parent",
  "child",
  "relates_to",
  "duplicate_of",
  "discovered_from",
]);
export type RelationKindInput = typeof RelationKindInput.Type;

/** Run links reference upstream executions as opaque strings (02 §A). */
export const RunLinkKind = Schema.Literals(["thread", "worktree", "pr"]);
export type RunLinkKind = typeof RunLinkKind.Type;

export const Space = Schema.Struct({
  id: SpaceId,
  name: TrimmedNonEmptyString,
  /** Short uppercase prefix for issue short-ids, e.g. `MLT` → `MLT-42`. */
  key: Schema.String.check(Schema.isPattern(/^[A-Z][A-Z0-9]{1,5}$/)),
  /**
   * Absolute repo-root paths this space maps to (01-ARCHITECTURE §5: a space
   * maps to ≥1 repos). Consumed by Start-agent project matching and profile
   * loading, and — later — the Phase 3 dispatcher (MLT-47/MLT-51).
   */
  repoPaths: Schema.Array(TrimmedNonEmptyString),
  createdAt: IsoDateTime,
});
export type Space = typeof Space.Type;

export const Status = Schema.Struct({
  id: StatusId,
  spaceId: SpaceId,
  name: TrimmedNonEmptyString,
  category: StatusCategory,
  position: Schema.Int,
});
export type Status = typeof Status.Type;

export const Label = Schema.Struct({
  id: LabelId,
  spaceId: SpaceId,
  name: TrimmedNonEmptyString,
  /** Hex color, e.g. `#5e6ad2`. */
  color: Schema.String.check(Schema.isPattern(/^#[0-9a-fA-F]{6}$/)),
});
export type Label = typeof Label.Type;

export const Issue = Schema.Struct({
  id: IssueId,
  spaceId: SpaceId,
  /** Per-space sequential number; `shortId` = `${space.key}-${number}` (D16). */
  number: Schema.Int,
  title: TrimmedNonEmptyString,
  /** Markdown. */
  description: Schema.String,
  statusId: StatusId,
  priority: Priority,
  type: IssueType,
  /** Always the human for now (00-VISION: agents act, humans are accountable). */
  assignee: Schema.String,
  /** Profile id — Phase 2+; always null in Phase 1. */
  delegate: Schema.NullOr(Schema.String),
  origin: IssueOrigin,
  /** An agent asked for human input (03-PHASE-2 §A `ml_request_input`); cleared by a human comment or a status change. */
  agentBlocked: Schema.Boolean,
  /** An agent proposed this issue is a duplicate; the human confirms or rejects (03-PHASE-2 §C). */
  pendingDuplicateStatusId: Schema.NullOr(StatusId),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type Issue = typeof Issue.Type;

export const Comment = Schema.Struct({
  id: CommentId,
  issueId: IssueId,
  body: TrimmedNonEmptyString,
  actor: Actor,
  createdAt: IsoDateTime,
});
export type Comment = typeof Comment.Type;

export const Relation = Schema.Struct({
  id: RelationId,
  srcId: IssueId,
  kind: RelationKind,
  dstId: IssueId,
  createdAt: IsoDateTime,
});
export type Relation = typeof Relation.Type;

export const RunLink = Schema.Struct({
  id: RunLinkId,
  issueId: IssueId,
  kind: RunLinkKind,
  /** Opaque reference: t3code thread id, worktree path, or PR URL. */
  ref: TrimmedNonEmptyString,
  createdAt: IsoDateTime,
});
export type RunLink = typeof RunLink.Type;

/** Default status names seeded 1:1 with categories on space creation. */
export const DEFAULT_STATUS_NAMES: Readonly<Record<StatusCategory, string>> = {
  triage: "Triage",
  backlog: "Backlog",
  ready: "Ready",
  in_progress: "In Progress",
  needs_review: "Needs Review",
  done: "Done",
  cancelled: "Cancelled",
  duplicate: "Duplicate",
};

export const shortIdOf = (spaceKey: string, issueNumber: number): string =>
  `${spaceKey}-${issueNumber}`;

/**
 * Resolve one of the six surface relation kinds into its canonical stored
 * direction (D15). Returns the canonical kind plus src/dst given the issue
 * the caller is acting from and the related target issue.
 */
export const canonicalRelation = (
  issueId: IssueId,
  kind: RelationKindInput,
  targetId: IssueId,
): { srcId: IssueId; kind: RelationKind; dstId: IssueId } => {
  switch (kind) {
    case "blocked_by":
      return { srcId: targetId, kind: "blocks", dstId: issueId };
    case "child":
      return { srcId: targetId, kind: "parent", dstId: issueId };
    case "blocks":
    case "parent":
    case "relates_to":
    case "duplicate_of":
    case "discovered_from":
      return { srcId: issueId, kind, dstId: targetId };
  }
};

/**
 * Express a canonical relation from the point of view of one of its two
 * issues, restoring the six-kind surface vocabulary.
 */
export const relationKindFor = (
  relation: { srcId: IssueId; kind: RelationKind; dstId: IssueId },
  viewpointIssueId: IssueId,
): RelationKindInput => {
  if (relation.srcId === viewpointIssueId) return relation.kind;
  switch (relation.kind) {
    case "blocks":
      return "blocked_by";
    case "parent":
      return "child";
    case "relates_to":
      return "relates_to";
    // Inverse reads of one-directional kinds fall back to the canonical name;
    // the UI labels the direction explicitly.
    case "duplicate_of":
    case "discovered_from":
      return relation.kind;
  }
};
