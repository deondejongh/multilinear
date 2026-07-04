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

export const TrackerEvent = Schema.Union([
  SpaceCreated,
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
]);
export type TrackerEvent = typeof TrackerEvent.Type;

export type TrackerEventType = TrackerEvent["type"];

/** An event as stored/exported, with its append-order sequence number. */
export const StoredTrackerEvent = Schema.Struct({
  seq: Schema.Int,
  event: TrackerEvent,
});
export type StoredTrackerEvent = typeof StoredTrackerEvent.Type;
