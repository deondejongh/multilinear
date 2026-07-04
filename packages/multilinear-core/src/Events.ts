/**
 * Event schemas — the source of truth (01-ARCHITECTURE §3).
 *
 * Append-only; projections are rebuildable from these. Every event carries an
 * actor and (when caused) a `causationId` — that chain powers the activity
 * feed, rule loop-guards, and back-testing. Browser-safe (effect only).
 */
import * as Schema from "effect/Schema";

import {
  Actor,
  CommentId,
  IsoDateTime,
  IssueId,
  IssueOrigin,
  IssueType,
  LabelId,
  Priority,
  ProofId,
  RelationId,
  RelationKind,
  RunLinkId,
  RunLinkKind,
  SpaceId,
  StatusCategory,
  StatusId,
  TrackerEventId,
  TrimmedNonEmptyString,
} from "./Model.ts";
import { ProofOfWork } from "./Proof.ts";

const envelopeFields = {
  id: TrackerEventId,
  ts: IsoDateTime,
  actor: Actor,
  causationId: Schema.NullOr(TrackerEventId),
  issueId: Schema.NullOr(IssueId),
} as const;

const defineEvent = <Type extends string, PayloadFields extends Schema.Struct.Fields>(
  type: Type,
  payloadFields: PayloadFields,
) =>
  Schema.Struct({
    ...envelopeFields,
    type: Schema.Literal(type),
    payload: Schema.Struct(payloadFields),
  });

export const SpaceCreated = defineEvent("space.created", {
  spaceId: SpaceId,
  name: TrimmedNonEmptyString,
  key: Schema.String,
});

/** Space settings changed — currently just the repo mapping (MLT-47). */
export const SpaceUpdated = defineEvent("space.updated", {
  spaceId: SpaceId,
  repoPaths: Schema.Array(TrimmedNonEmptyString),
});

export const StatusCreated = defineEvent("status.created", {
  statusId: StatusId,
  spaceId: SpaceId,
  name: TrimmedNonEmptyString,
  category: StatusCategory,
  position: Schema.Int,
});

export const IssueCreated = defineEvent("issue.created", {
  issueId: IssueId,
  spaceId: SpaceId,
  title: TrimmedNonEmptyString,
  description: Schema.String,
  statusId: StatusId,
  priority: Priority,
  issueType: IssueType,
  origin: IssueOrigin,
});

export const IssueUpdated = defineEvent("issue.updated", {
  issueId: IssueId,
  title: Schema.optional(TrimmedNonEmptyString),
  description: Schema.optional(Schema.String),
  priority: Schema.optional(Priority),
  issueType: Schema.optional(IssueType),
});

export const StatusChanged = defineEvent("status.changed", {
  issueId: IssueId,
  fromStatusId: StatusId,
  toStatusId: StatusId,
});

export const LabelCreated = defineEvent("label.created", {
  labelId: LabelId,
  spaceId: SpaceId,
  name: TrimmedNonEmptyString,
  color: Schema.String,
});

export const LabelAdded = defineEvent("label.added", {
  issueId: IssueId,
  labelId: LabelId,
});

export const LabelRemoved = defineEvent("label.removed", {
  issueId: IssueId,
  labelId: LabelId,
});

export const CommentAdded = defineEvent("comment.added", {
  commentId: CommentId,
  issueId: IssueId,
  body: TrimmedNonEmptyString,
});

export const RelationAdded = defineEvent("relation.added", {
  relationId: RelationId,
  srcId: IssueId,
  kind: RelationKind,
  dstId: IssueId,
});

export const RelationRemoved = defineEvent("relation.removed", {
  relationId: RelationId,
  srcId: IssueId,
  kind: RelationKind,
  dstId: IssueId,
});

export const RunLinked = defineEvent("run.linked", {
  runLinkId: RunLinkId,
  issueId: IssueId,
  kind: RunLinkKind,
  ref: TrimmedNonEmptyString,
});

/** Proof of work attached (03-PHASE-2 §B); renders as a formatted comment. */
export const ProofAttached = defineEvent("proof.attached", {
  proofId: ProofId,
  issueId: IssueId,
  proof: ProofOfWork,
});

/**
 * An agent asked for human input (03-PHASE-2 §A `ml_request_input`). Marks
 * the issue Agent Blocked; the question itself lands as a `comment.added`
 * event in the same batch (`commentId` links them).
 */
export const InputRequested = defineEvent("input.requested", {
  issueId: IssueId,
  commentId: CommentId,
  question: TrimmedNonEmptyString,
});

/**
 * An agent proposed the issue is a duplicate (03-PHASE-2 §C): a pending flag
 * a human confirms — never a status change by the agent itself.
 */
export const DuplicateProposed = defineEvent("duplicate.proposed", {
  issueId: IssueId,
  /** The duplicate-category status the issue would move to on confirmation. */
  statusId: StatusId,
});

/** A human confirmed or rejected a pending duplicate proposal. */
export const DuplicateResolved = defineEvent("duplicate.resolved", {
  issueId: IssueId,
  accepted: Schema.Boolean,
});

/** Cost observed for work on an issue (03-PHASE-2 §A `ml_log_cost`). */
export const CostRecorded = defineEvent("cost.recorded", {
  issueId: IssueId,
  tokens: Schema.optional(Schema.Int),
  currencyAmount: Schema.optional(Schema.Number),
  note: Schema.optional(Schema.String),
});

export const TrackerEvent = Schema.Union([
  SpaceCreated,
  SpaceUpdated,
  StatusCreated,
  IssueCreated,
  IssueUpdated,
  StatusChanged,
  LabelCreated,
  LabelAdded,
  LabelRemoved,
  CommentAdded,
  RelationAdded,
  RelationRemoved,
  RunLinked,
  ProofAttached,
  InputRequested,
  DuplicateProposed,
  DuplicateResolved,
  CostRecorded,
]);
export type TrackerEvent = typeof TrackerEvent.Type;

export type TrackerEventType = TrackerEvent["type"];

/** An event as stored/exported, with its append-order sequence number. */
export const StoredTrackerEvent = Schema.Struct({
  seq: Schema.Int,
  event: TrackerEvent,
});
export type StoredTrackerEvent = typeof StoredTrackerEvent.Type;
