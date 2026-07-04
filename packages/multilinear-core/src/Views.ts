/**
 * Read-model view schemas returned by queries and carried over the HTTP
 * surface. Browser-safe (effect only).
 */
import * as Schema from "effect/Schema";

import {
  Comment,
  Issue,
  IssueId,
  IssueType,
  Label,
  LabelId,
  Priority,
  RelationId,
  RelationKindInput,
  RunLink,
  Space,
  SpaceId,
  Status,
  StatusCategory,
  StatusId,
} from "./Model.ts";

export const IssueSummary = Schema.Struct({
  id: IssueId,
  spaceId: SpaceId,
  spaceKey: Schema.String,
  number: Schema.Int,
  shortId: Schema.String,
  title: Schema.String,
  statusId: StatusId,
  category: StatusCategory,
  priority: Priority,
  issueType: IssueType,
  labels: Schema.Array(Label),
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type IssueSummary = typeof IssueSummary.Type;

/** A relation seen from one issue's point of view (six-kind vocabulary). */
export const RelationView = Schema.Struct({
  id: RelationId,
  kind: RelationKindInput,
  /** True when this issue is the canonical `src` of the stored relation. */
  outgoing: Schema.Boolean,
  otherIssueId: IssueId,
  otherShortId: Schema.String,
  otherTitle: Schema.String,
  otherCategory: StatusCategory,
});
export type RelationView = typeof RelationView.Type;

export const IssueDetail = Schema.Struct({
  issue: Issue,
  shortId: Schema.String,
  space: Space,
  status: Status,
  labels: Schema.Array(Label),
  comments: Schema.Array(Comment),
  relations: Schema.Array(RelationView),
  runLinks: Schema.Array(RunLink),
});
export type IssueDetail = typeof IssueDetail.Type;

export const IssueFilter = Schema.Struct({
  spaceId: Schema.optional(SpaceId),
  category: Schema.optional(StatusCategory),
  labelId: Schema.optional(LabelId),
  /** Case-insensitive substring match on title and short-id. */
  search: Schema.optional(Schema.String),
});
export type IssueFilter = typeof IssueFilter.Type;
