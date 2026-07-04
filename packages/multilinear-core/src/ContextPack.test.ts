import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { buildContextPack } from "./ContextPack.ts";
import type { CommentId, IssueId, LabelId, RelationId, SpaceId } from "./Model.ts";
import { TrackerStore } from "./Store.ts";
import { makeUlidGenerator } from "./Ulid.ts";

const human = { kind: "human", id: "deon" } as const;

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

describe("buildContextPack", () => {
  it.effect("renders the full pack from a real issue detail", () =>
    Effect.gen(function* () {
      const store = yield* TrackerStore;
      const ids = makeIds();
      const spaceId = ids.next() as SpaceId;
      yield* store.execute(
        { type: "space.create", spaceId, name: "Multilinear", key: "MLT" },
        human,
      );
      const labelId = ids.next() as LabelId;
      yield* store.execute(
        { type: "label.create", labelId, spaceId, name: "core", color: "#5e6ad2" },
        human,
      );
      const blockerId = ids.next() as IssueId;
      yield* store.execute(
        {
          type: "issue.create",
          issueId: blockerId,
          spaceId,
          title: "Ship the store",
          description: "",
          priority: 0,
          issueType: "work",
          labelIds: [],
        },
        human,
      );
      const issueId = ids.next() as IssueId;
      yield* store.execute(
        {
          type: "issue.create",
          issueId,
          spaceId,
          title: "Build the board",
          description: "Columns follow category order.",
          priority: 2,
          issueType: "work",
          labelIds: [labelId],
        },
        human,
      );
      yield* store.execute(
        {
          type: "relation.add",
          relationId: ids.next() as RelationId,
          issueId,
          kind: "blocked_by",
          targetId: blockerId,
        },
        human,
      );
      yield* store.execute(
        {
          type: "comment.add",
          commentId: ids.next() as CommentId,
          issueId,
          body: "Use the upstream UI kit.",
        },
        human,
      );

      const detail = yield* store.getIssue(issueId);
      const pack = buildContextPack(detail);

      assert.include(pack, "# Issue MLT-2: Build the board");
      assert.include(pack, "Space: Multilinear · Priority: High · Labels: core");
      assert.include(pack, "## Description\nColumns follow category order.");
      assert.include(pack, "## Relevant relations");
      assert.include(pack, "- Blocked by: MLT-1 — Ship the store");
      assert.include(pack, "## Recent discussion");
      assert.include(pack, "- human:deon — Use the upstream UI kit.");
      assert.include(pack, "Work only on this issue.");
    }).pipe(Effect.provide(TrackerStore.layerMemory)),
  );

  it.effect("omits empty sections and caps comments", () =>
    Effect.gen(function* () {
      const store = yield* TrackerStore;
      const ids = makeIds();
      const spaceId = ids.next() as SpaceId;
      yield* store.execute({ type: "space.create", spaceId, name: "Solo", key: "SOL" }, human);
      const issueId = ids.next() as IssueId;
      yield* store.execute(
        {
          type: "issue.create",
          issueId,
          spaceId,
          title: "Lonely issue",
          description: "",
          priority: 0,
          issueType: "work",
          labelIds: [],
        },
        human,
      );
      for (let index = 0; index < 5; index++) {
        yield* store.execute(
          {
            type: "comment.add",
            commentId: ids.next() as CommentId,
            issueId,
            body: `comment ${index}`,
          },
          human,
        );
      }

      const detail = yield* store.getIssue(issueId);
      const pack = buildContextPack(detail, { maxComments: 2 });

      assert.include(pack, "Labels: none");
      assert.include(pack, "(no description)");
      assert.notInclude(pack, "## Relevant relations");
      // Newest last, capped at two.
      assert.notInclude(pack, "comment 2");
      assert.include(pack, "comment 3\n- human:deon — comment 4");
    }).pipe(Effect.provide(TrackerStore.layerMemory)),
  );
});
