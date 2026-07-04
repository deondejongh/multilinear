/**
 * The `/api/multilinear` HTTP surface (STATUS D11).
 *
 * This package imports only `effect` and `@multilinear/core` — never t3code.
 * Authentication is abstracted behind {@link MultilinearAuth}; the adapter in
 * `apps/server/src/multilinear/` (the single upstream-importing module, D14)
 * implements it with upstream's EnvironmentAuth and provides the store layer.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import type { HttpBody } from "effect/unstable/http";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

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
  TrackerQuery,
} from "@multilinear/core/api";
import type { Actor } from "@multilinear/core/model";
import { TrackerStore } from "@multilinear/core/store";

/** Access level required by an endpoint: queries read, commands operate. */
export type MultilinearAccess = "read" | "operate";

/**
 * A request was refused before reaching the tracker (auth, malformed body).
 * Carries the HTTP response to send.
 */
export class MultilinearHttpError extends Schema.TaggedErrorClass<MultilinearHttpError>()(
  "MultilinearHttpError",
  {
    status: Schema.Int,
    body: Schema.String,
  },
) {}

/**
 * Authentication boundary. The adapter authenticates the underlying HTTP
 * request against upstream auth and returns the acting {@link Actor} —
 * always the human in Phase 1.
 */
export class MultilinearAuth extends Context.Service<
  MultilinearAuth,
  {
    readonly authorize: (
      access: MultilinearAccess,
    ) => Effect.Effect<Actor, MultilinearHttpError, HttpServerRequest.HttpServerRequest>;
  }
>()("@multilinear/server/Router/MultilinearAuth") {
  /** Permit-all guard with a fixed actor — tests only. */
  static readonly layerStatic = (actor: Actor): Layer.Layer<MultilinearAuth> =>
    Layer.succeed(MultilinearAuth, {
      authorize: () => Effect.succeed(actor),
    });
}

const decodeCommandRequest = Schema.decodeUnknownEffect(CommandRequest);
const decodeQuery = Schema.decodeUnknownEffect(TrackerQuery);

const respondError = HttpServerResponse.schemaJson(ErrorResponse);
const respondCommand = HttpServerResponse.schemaJson(CommandResponse);

const badRequest = (detail: string) =>
  Effect.succeed(
    HttpServerResponse.text(`Invalid multilinear request: ${detail}`, { status: 400 }),
  );

/** Handle a decoded-from-JSON command body. Exported for direct testing. */
export const handleCommand = Effect.fnUntraced(function* (body: unknown, actor: Actor) {
  const store = yield* TrackerStore;
  const request = yield* decodeCommandRequest(body).pipe(
    Effect.mapError((error) => new MultilinearHttpError({ status: 400, body: String(error) })),
  );
  return yield* store.execute(request.command, actor).pipe(
    Effect.flatMap((events) => respondCommand({ events })),
    Effect.catchTags({
      CommandRejectedError: (error) => respondError({ error }, { status: 422 }),
      TrackerStorageError: (error) => respondError({ error }, { status: 500 }),
    }),
  );
});

/** Handle a decoded-from-JSON query body. Exported for direct testing. */
export const handleQuery = Effect.fnUntraced(function* (body: unknown) {
  const store = yield* TrackerStore;
  const query = yield* decodeQuery(body).pipe(
    Effect.mapError((error) => new MultilinearHttpError({ status: 400, body: String(error) })),
  );

  const respond = Effect.fnUntraced(function* () {
    switch (query.type) {
      case "spaces.list": {
        const spaces = yield* store.listSpaces();
        return yield* HttpServerResponse.schemaJson(SpacesListResult)({ spaces });
      }
      case "statuses.list": {
        const statuses = yield* store.listStatuses(query.spaceId);
        return yield* HttpServerResponse.schemaJson(StatusesListResult)({ statuses });
      }
      case "labels.list": {
        const labels = yield* store.listLabels(query.spaceId);
        return yield* HttpServerResponse.schemaJson(LabelsListResult)({ labels });
      }
      case "issues.list": {
        const issues = yield* store.listIssues(query.filter);
        return yield* HttpServerResponse.schemaJson(IssuesListResult)({ issues });
      }
      case "issue.get": {
        const detail = yield* store.getIssue(query.issueId);
        return yield* HttpServerResponse.schemaJson(IssueGetResult)({ detail });
      }
      case "issue.activity": {
        const entries = yield* store.listIssueEvents(query.issueId);
        return yield* HttpServerResponse.schemaJson(IssueActivityResult)({ entries });
      }
    }
  });

  return yield* respond().pipe(
    Effect.catchTags({
      IssueNotFoundError: (error) => respondError({ error }, { status: 404 }),
      TrackerStorageError: (error) => respondError({ error }, { status: 500 }),
    }),
  );
});

type RouteHandler = (
  body: unknown,
  actor: Actor,
) => Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  MultilinearHttpError | HttpBody.HttpBodyError,
  TrackerStore
>;

const routeEffect = (access: MultilinearAccess, handle: RouteHandler) =>
  Effect.gen(function* () {
    const auth = yield* MultilinearAuth;
    const actor = yield* auth.authorize(access);
    const request = yield* HttpServerRequest.HttpServerRequest;
    const body = yield* request.json.pipe(
      Effect.mapError(() => new MultilinearHttpError({ status: 400, body: "Malformed JSON body" })),
    );
    return yield* handle(body, actor);
  }).pipe(
    Effect.catchTags({
      MultilinearHttpError: (error) =>
        Effect.succeed(HttpServerResponse.text(error.body, { status: error.status })),
      HttpBodyError: () => badRequest("response encoding failed"),
    }),
  );

/**
 * The two multilinear routes. Route-handler requirements surface at
 * `HttpRouter.serve` (upstream's boundary), where our services don't exist —
 * so the adapter builds `TrackerStore` + `MultilinearAuth` once and passes
 * their context in; the handlers are pre-provided here.
 */
export const makeMultilinearRoutesLayer = (
  services: Context.Context<TrackerStore | MultilinearAuth>,
): Layer.Layer<never, never, HttpRouter.HttpRouter> =>
  Layer.mergeAll(
    HttpRouter.add(
      "POST",
      MULTILINEAR_COMMAND_PATH,
      routeEffect("operate", (body, actor) => handleCommand(body, actor)).pipe(
        Effect.provide(services),
      ),
    ),
    HttpRouter.add(
      "POST",
      MULTILINEAR_QUERY_PATH,
      routeEffect("read", (body) => handleQuery(body)).pipe(Effect.provide(services)),
    ),
  );
