import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import type { Actor, IssueId, SpaceId } from "@multilinear/core/model";
import { CommandResponse, IssueGetResult, IssuesListResult } from "@multilinear/core/api";
import { TrackerStore } from "@multilinear/core/store";
import { makeUlidGenerator } from "@multilinear/core/ulid";

import { ProfileLoader } from "./Profiles.ts";
import { handleCommand, handleQuery } from "./Router.ts";

const human: Actor = { kind: "human", id: "deon" };

const makeIds = () => {
  let counter = 0;
  const generator = makeUlidGenerator((bytes) => {
    counter += 1;
    bytes.fill(0);
    bytes[9] = counter % 256;
    bytes[8] = Math.floor(counter / 256);
  });
  return { next: () => generator.next(1_700_000_000_000) };
};

const decodeCommandResponse = Schema.decodeUnknownEffect(CommandResponse);
const decodeIssuesList = Schema.decodeUnknownEffect(IssuesListResult);
const decodeIssueGet = Schema.decodeUnknownEffect(IssueGetResult);

const decodeUnknownJson = Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown));

/** Decode a JSON `Uint8Array` response body back into a plain value. */
const responseJson = (response: { readonly body: unknown }) => {
  const body = response.body as { readonly _tag: string; readonly body: Uint8Array };
  assert.strictEqual(body._tag, "Uint8Array");
  return decodeUnknownJson(new TextDecoder().decode(body.body));
};

describe("multilinear router handlers", () => {
  it.effect("command → query round trip over the wire schemas", () =>
    Effect.gen(function* () {
      const ids = makeIds();
      const spaceId = ids.next() as SpaceId;

      const createSpace = yield* handleCommand(
        { command: { type: "space.create", spaceId, name: "Multilinear", key: "MLT" } },
        human,
      );
      assert.strictEqual(createSpace.status, 200);
      const spaceEvents = yield* decodeCommandResponse(yield* responseJson(createSpace));
      assert.strictEqual(spaceEvents.events[0]?.type, "space.created");
      assert.strictEqual(spaceEvents.events.length, 9);

      const issueId = ids.next() as IssueId;
      const createIssue = yield* handleCommand(
        {
          command: {
            type: "issue.create",
            issueId,
            spaceId,
            title: "Wire it up",
          },
        },
        human,
      );
      assert.strictEqual(createIssue.status, 200);

      const list = yield* handleQuery({ type: "issues.list", filter: {} });
      assert.strictEqual(list.status, 200);
      const issues = yield* decodeIssuesList(yield* responseJson(list));
      assert.strictEqual(issues.issues[0]?.shortId, "MLT-1");

      const detail = yield* handleQuery({ type: "issue.get", issueId });
      const decoded = yield* decodeIssueGet(yield* responseJson(detail));
      assert.strictEqual(decoded.detail.issue.title, "Wire it up");

      // Short-ids resolve to the same issue (MLT-55).
      const byShortId = yield* handleQuery({ type: "issue.get", issueId: "MLT-1" });
      assert.strictEqual(byShortId.status, 200);
      const decodedShort = yield* decodeIssueGet(yield* responseJson(byShortId));
      assert.strictEqual(decodedShort.detail.issue.id, issueId);

      const activityByShortId = yield* handleQuery({ type: "issue.activity", issueId: "mlt-1" });
      assert.strictEqual(activityByShortId.status, 200);
    }).pipe(
      Effect.provide(Layer.mergeAll(TrackerStore.layerMemory, ProfileLoader.layerStatic([]))),
    ),
  );

  it.effect("rejected commands come back as 422 with the tagged error", () =>
    Effect.gen(function* () {
      const ids = makeIds();
      const response = yield* handleCommand(
        {
          command: {
            type: "comment.add",
            commentId: ids.next(),
            issueId: ids.next(),
            body: "ghost comment",
          },
        },
        human,
      );
      assert.strictEqual(response.status, 422);
      const body = (yield* responseJson(response)) as { error: { _tag: string } };
      assert.strictEqual(body.error._tag, "CommandRejectedError");
    }).pipe(
      Effect.provide(Layer.mergeAll(TrackerStore.layerMemory, ProfileLoader.layerStatic([]))),
    ),
  );

  it.effect("malformed command bodies fail with 400", () =>
    Effect.gen(function* () {
      const result = yield* handleCommand({ command: { type: "nonsense" } }, human).pipe(
        Effect.flip,
      );
      assert.strictEqual(result._tag, "MultilinearHttpError");
      assert.isTrue(result._tag === "MultilinearHttpError" && result.status === 400);
    }).pipe(
      Effect.provide(Layer.mergeAll(TrackerStore.layerMemory, ProfileLoader.layerStatic([]))),
    ),
  );

  it.effect("a store that failed to open answers 503, queries and commands alike", () =>
    Effect.gen(function* () {
      const ids = makeIds();
      const query = yield* handleQuery({ type: "issues.list", filter: {} });
      assert.strictEqual(query.status, 503);
      const body = (yield* responseJson(query)) as { error: { _tag: string; operation: string } };
      assert.strictEqual(body.error._tag, "TrackerStorageError");
      assert.strictEqual(body.error.operation, "unavailable");

      const command = yield* handleCommand(
        { command: { type: "space.create", spaceId: ids.next(), name: "X", key: "XXX" } },
        human,
      );
      assert.strictEqual(command.status, 503);
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(TrackerStore, TrackerStore.unavailable(new Error("disk on fire"))),
          ProfileLoader.layerStatic([]),
        ),
      ),
    ),
  );

  it.effect("unknown issues come back as 404", () =>
    Effect.gen(function* () {
      const ids = makeIds();
      const response = yield* handleQuery({ type: "issue.get", issueId: ids.next() });
      assert.strictEqual(response.status, 404);

      // Unknown short-ids too — resolution failure is a 404, not a 400.
      const byShortId = yield* handleQuery({ type: "issue.get", issueId: "MLT-999" });
      assert.strictEqual(byShortId.status, 404);
    }).pipe(
      Effect.provide(Layer.mergeAll(TrackerStore.layerMemory, ProfileLoader.layerStatic([]))),
    ),
  );
});
