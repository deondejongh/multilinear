/**
 * Command schemas — the only write surface (01-ARCHITECTURE §3).
 *
 * Commands are validated against current projections and produce events.
 * Entity IDs are ULIDs generated caller-side. Browser-safe (effect only).
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  CommentId,
  IssueId,
  IssueType,
  LabelId,
  Priority,
  ProofId,
  RelationId,
  RelationKindInput,
  RunLinkId,
  RunLinkKind,
  SpaceId,
  StatusId,
  TrimmedNonEmptyString,
} from "./Model.ts";
import { ProofOfWork } from "./Proof.ts";

export const CreateSpace = Schema.Struct({
  type: Schema.Literal("space.create"),
  spaceId: SpaceId,
  name: TrimmedNonEmptyString,
  key: Schema.String.check(Schema.isPattern(/^[A-Z][A-Z0-9]{1,5}$/)),
});

export const CreateIssue = Schema.Struct({
  type: Schema.Literal("issue.create"),
  issueId: IssueId,
  spaceId: SpaceId,
  title: TrimmedNonEmptyString,
  description: Schema.String.pipe(Schema.withDecodingDefault(Effect.succeed(""))),
  priority: Priority.pipe(Schema.withDecodingDefault(Effect.succeed(0))),
  issueType: IssueType.pipe(Schema.withDecodingDefault(Effect.succeed("work" as const))),
  /** Defaults to the space's `triage` status. */
  statusId: Schema.optional(StatusId),
  labelIds: Schema.Array(LabelId).pipe(
    Schema.withDecodingDefault(Effect.succeed([] as ReadonlyArray<LabelId>)),
  ),
});

export const UpdateIssue = Schema.Struct({
  type: Schema.Literal("issue.update"),
  issueId: IssueId,
  title: Schema.optional(TrimmedNonEmptyString),
  description: Schema.optional(Schema.String),
  priority: Schema.optional(Priority),
  issueType: Schema.optional(IssueType),
});

export const ChangeStatus = Schema.Struct({
  type: Schema.Literal("status.change"),
  issueId: IssueId,
  statusId: StatusId,
});

export const CreateLabel = Schema.Struct({
  type: Schema.Literal("label.create"),
  labelId: LabelId,
  spaceId: SpaceId,
  name: TrimmedNonEmptyString,
  color: Schema.String.check(Schema.isPattern(/^#[0-9a-fA-F]{6}$/)),
});

export const AddLabel = Schema.Struct({
  type: Schema.Literal("label.add"),
  issueId: IssueId,
  labelId: LabelId,
});

export const RemoveLabel = Schema.Struct({
  type: Schema.Literal("label.remove"),
  issueId: IssueId,
  labelId: LabelId,
});

export const AddComment = Schema.Struct({
  type: Schema.Literal("comment.add"),
  commentId: CommentId,
  issueId: IssueId,
  body: TrimmedNonEmptyString,
});

export const AddRelation = Schema.Struct({
  type: Schema.Literal("relation.add"),
  relationId: RelationId,
  /** The issue the caller is acting from; direction is canonicalized (D15). */
  issueId: IssueId,
  kind: RelationKindInput,
  targetId: IssueId,
});

export const RemoveRelation = Schema.Struct({
  type: Schema.Literal("relation.remove"),
  relationId: RelationId,
});

export const AddRunLink = Schema.Struct({
  type: Schema.Literal("run-link.add"),
  runLinkId: RunLinkId,
  issueId: IssueId,
  kind: RunLinkKind,
  ref: TrimmedNonEmptyString,
});

/** Attach proof of work (03-PHASE-2 §B). */
export const AttachProof = Schema.Struct({
  type: Schema.Literal("proof.attach"),
  proofId: ProofId,
  issueId: IssueId,
  proof: ProofOfWork,
});

/**
 * Ask for human input (03-PHASE-2 §A): posts the question as a comment and
 * marks the issue Agent Blocked. Agent actors only.
 */
export const RequestInput = Schema.Struct({
  type: Schema.Literal("input.request"),
  issueId: IssueId,
  commentId: CommentId,
  question: TrimmedNonEmptyString,
});

/** Confirm or reject a pending duplicate proposal. Human actors only. */
export const ResolveDuplicate = Schema.Struct({
  type: Schema.Literal("duplicate.resolve"),
  issueId: IssueId,
  accept: Schema.Boolean,
});

/** Record cost for work on an issue (03-PHASE-2 §A `ml_log_cost`). */
export const LogCost = Schema.Struct({
  type: Schema.Literal("cost.log"),
  issueId: IssueId,
  tokens: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  currencyAmount: Schema.optional(Schema.Number.check(Schema.isGreaterThanOrEqualTo(0))),
  note: Schema.optional(Schema.String),
});

export const TrackerCommand = Schema.Union([
  CreateSpace,
  CreateIssue,
  UpdateIssue,
  ChangeStatus,
  CreateLabel,
  AddLabel,
  RemoveLabel,
  AddComment,
  AddRelation,
  RemoveRelation,
  AddRunLink,
  AttachProof,
  RequestInput,
  ResolveDuplicate,
  LogCost,
]);
export type TrackerCommand = typeof TrackerCommand.Type;

export type TrackerCommandType = TrackerCommand["type"];

/** A command was refused by domain validation; nothing was appended. */
export class CommandRejectedError extends Schema.TaggedErrorClass<CommandRejectedError>()(
  "CommandRejectedError",
  {
    command: Schema.String,
    reason: Schema.String,
  },
) {
  override get message(): string {
    return `${this.command} rejected: ${this.reason}`;
  }
}
