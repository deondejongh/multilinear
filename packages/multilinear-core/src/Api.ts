/**
 * HTTP transport schemas for the `/api/multilinear` surface (STATUS D11).
 *
 * One command endpoint, one query endpoint; both sides validate with these
 * schemas. Browser-safe (effect only) — the web client imports this module.
 */
import * as Schema from "effect/Schema";

import { CommandRejectedError, TrackerCommand } from "./Commands.ts";
import { ImportRejectedError, IssueNotFoundError, TrackerStorageError } from "./Errors.ts";
import { StoredTrackerEvent, TrackerEvent } from "./Events.ts";
import { IssueId, Label, Space, SpaceId, Status } from "./Model.ts";
import { IssueDetail, IssueFilter, IssueSummary } from "./Views.ts";

export const MULTILINEAR_API_PREFIX = "/api/multilinear";
export const MULTILINEAR_COMMAND_PATH = `${MULTILINEAR_API_PREFIX}/command`;
export const MULTILINEAR_QUERY_PATH = `${MULTILINEAR_API_PREFIX}/query`;

export const CommandRequest = Schema.Struct({
  command: TrackerCommand,
});
export type CommandRequest = typeof CommandRequest.Type;

export const CommandResponse = Schema.Struct({
  events: Schema.Array(TrackerEvent),
});
export type CommandResponse = typeof CommandResponse.Type;

export const SpacesListQuery = Schema.Struct({
  type: Schema.Literal("spaces.list"),
});
export const SpacesListResult = Schema.Struct({
  spaces: Schema.Array(Space),
});

export const StatusesListQuery = Schema.Struct({
  type: Schema.Literal("statuses.list"),
  spaceId: SpaceId,
});
export const StatusesListResult = Schema.Struct({
  statuses: Schema.Array(Status),
});

export const LabelsListQuery = Schema.Struct({
  type: Schema.Literal("labels.list"),
  spaceId: Schema.optional(SpaceId),
});
export const LabelsListResult = Schema.Struct({
  labels: Schema.Array(Label),
});

export const IssuesListQuery = Schema.Struct({
  type: Schema.Literal("issues.list"),
  filter: IssueFilter,
});
export const IssuesListResult = Schema.Struct({
  issues: Schema.Array(IssueSummary),
});

export const IssueGetQuery = Schema.Struct({
  type: Schema.Literal("issue.get"),
  issueId: IssueId,
});
export const IssueGetResult = Schema.Struct({
  detail: IssueDetail,
});

export const IssueActivityQuery = Schema.Struct({
  type: Schema.Literal("issue.activity"),
  issueId: IssueId,
});
export const IssueActivityResult = Schema.Struct({
  entries: Schema.Array(StoredTrackerEvent),
});

export const TrackerQuery = Schema.Union([
  SpacesListQuery,
  StatusesListQuery,
  LabelsListQuery,
  IssuesListQuery,
  IssueGetQuery,
  IssueActivityQuery,
]);
export type TrackerQuery = typeof TrackerQuery.Type;

/** Wire shape for errors: `{ error: <tagged error> }` with an HTTP status. */
export const ErrorResponse = Schema.Struct({
  error: Schema.Union([
    CommandRejectedError,
    IssueNotFoundError,
    ImportRejectedError,
    TrackerStorageError,
  ]),
});
export type ErrorResponse = typeof ErrorResponse.Type;
