/**
 * Read-model view schemas returned by queries and carried over the HTTP
 * surface. Browser-safe (effect only).
 */
import * as Schema from "effect/Schema";

import {
  Actor,
  Comment,
  Issue,
  IssueId,
  IssueType,
  Label,
  LabelId,
  Priority,
  ProofId,
  RelationId,
  RelationKindInput,
  RunLink,
  Space,
  SpaceId,
  Status,
  StatusCategory,
  StatusId,
} from "./Model.ts";
import { ProofOfWork } from "./Proof.ts";

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
  /** Awaiting human input (03-PHASE-2 §A) — badge + filterable. */
  agentBlocked: Schema.Boolean,
  /** An agent's duplicate proposal is pending human confirmation. */
  pendingDuplicate: Schema.Boolean,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type IssueSummary = typeof IssueSummary.Type;

/** A proof-of-work attachment as shown in the issue thread. */
export const ProofView = Schema.Struct({
  id: ProofId,
  issueId: IssueId,
  actor: Actor,
  proof: ProofOfWork,
  createdAt: Schema.String,
});
export type ProofView = typeof ProofView.Type;

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
  proofs: Schema.Array(ProofView),
});
export type IssueDetail = typeof IssueDetail.Type;

export const IssueFilter = Schema.Struct({
  spaceId: Schema.optional(SpaceId),
  category: Schema.optional(StatusCategory),
  labelId: Schema.optional(LabelId),
  /** Case-insensitive substring match on title and short-id. */
  search: Schema.optional(Schema.String),
  /** When true, only issues currently marked Agent Blocked. */
  agentBlocked: Schema.optional(Schema.Boolean),
});
export type IssueFilter = typeof IssueFilter.Type;
