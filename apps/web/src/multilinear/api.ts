/**
 * Typed client for the `/api/multilinear` HTTP surface.
 *
 * Rides the authenticated primary-environment HTTP layer (cookie auth in the
 * browser, bearer token on desktop) — the same transport upstream uses for
 * its own raw routes. Promise-returning wrappers keep React call sites plain.
 */
import * as Effect from "effect/Effect";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Schema from "effect/Schema";
import { HttpBody, HttpClient } from "effect/unstable/http";

import {
  CommandRequest,
  CommandResponse,
  ErrorResponse,
  IssueActivityResult,
  IssueGetResult,
  IssuesListResult,
  LabelsListResult,
  MULTILINEAR_COMMAND_PATH,
  MULTILINEAR_QUERY_PATH,
  SpacesListResult,
  StatusesListResult,
  type TrackerQuery,
} from "@multilinear/core/api";
import type { TrackerCommand } from "@multilinear/core/commands";
import type { IssueId, LabelId, SpaceId } from "@multilinear/core/model";
import type { IssueFilter } from "@multilinear/core/api";
import { makeUlidGenerator } from "@multilinear/core/ulid";

import { primaryEnvironmentHttpLayer } from "../environments/primary/httpLayer";
import { resolvePrimaryEnvironmentHttpUrl } from "../environments/primary/target";

const runtime = ManagedRuntime.make(primaryEnvironmentHttpLayer);

/** Raised when the tracker backend refuses or fails a request. */
export class MultilinearApiError extends Error {
  constructor(
    override readonly message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MultilinearApiError";
  }
}

const decodeErrorResponse = Schema.decodeUnknownEffect(ErrorResponse);
const encodeCommandRequest = Schema.encodeUnknownEffect(CommandRequest);

const apiFailure = Effect.fnUntraced(function* (status: number, body: unknown) {
  const decoded = yield* decodeErrorResponse(body).pipe(Effect.option);
  const message =
    decoded._tag === "Some"
      ? ((decoded.value.error as { message?: string }).message ?? decoded.value.error._tag)
      : `Multilinear request failed with status ${status}`;
  return new MultilinearApiError(message, status);
});

const postJson = Effect.fnUntraced(function* (path: string, body: unknown) {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client
    .post(resolvePrimaryEnvironmentHttpUrl(path), { body: HttpBody.jsonUnsafe(body) })
    .pipe(Effect.mapError((cause) => new MultilinearApiError(String(cause), 0)));
  const json = yield* response.json.pipe(Effect.orElseSucceed(() => null));
  if (response.status >= 400) {
    return yield* Effect.flatMap(apiFailure(response.status, json), Effect.fail);
  }
  return json;
});

const runQuery = <Result extends Schema.Top & { readonly DecodingServices: never }>(
  query: TrackerQuery,
  result: Result,
) =>
  runtime.runPromise(
    postJson(MULTILINEAR_QUERY_PATH, query).pipe(
      Effect.flatMap((json) =>
        Schema.decodeUnknownEffect(result)(json).pipe(
          Effect.mapError((cause) => new MultilinearApiError(String(cause), 0)),
        ),
      ),
    ),
  );

/** Execute a tracker command; the server derives the (human) actor. */
export const mlCommand = (command: TrackerCommand): Promise<CommandResponse> =>
  runtime.runPromise(
    encodeCommandRequest({ command }).pipe(
      Effect.mapError((cause) => new MultilinearApiError(String(cause), 0)),
      Effect.flatMap((encoded) => postJson(MULTILINEAR_COMMAND_PATH, encoded)),
      Effect.flatMap((json) =>
        Schema.decodeUnknownEffect(CommandResponse)(json).pipe(
          Effect.mapError((cause) => new MultilinearApiError(String(cause), 0)),
        ),
      ),
    ),
  );

export const mlListSpaces = () => runQuery({ type: "spaces.list" }, SpacesListResult);

export const mlListStatuses = (spaceId: SpaceId) =>
  runQuery({ type: "statuses.list", spaceId }, StatusesListResult);

export const mlListLabels = (spaceId?: SpaceId) =>
  runQuery(
    spaceId === undefined ? { type: "labels.list" } : { type: "labels.list", spaceId },
    LabelsListResult,
  );

export const mlListIssues = (filter: IssueFilter) =>
  runQuery({ type: "issues.list", filter }, IssuesListResult);

export const mlGetIssue = (issueId: IssueId) =>
  runQuery({ type: "issue.get", issueId }, IssueGetResult);

export const mlIssueActivity = (issueId: IssueId) =>
  runQuery({ type: "issue.activity", issueId }, IssueActivityResult);

const ulid = makeUlidGenerator((bytes) =>
  globalThis.crypto.getRandomValues(bytes as Uint8Array<ArrayBuffer>),
);

/** Caller-side ULIDs for new entities (01-ARCHITECTURE §3). */
export const newEntityId = <Id extends string>(): Id => ulid.next(Date.now()) as Id;

export type { IssueFilter, IssueId, LabelId, SpaceId, TrackerCommand };
