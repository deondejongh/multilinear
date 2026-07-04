import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import type { CommentId, IssueId, LabelId, RelationId, RunLinkId, SpaceId } from "./Model.ts";
import { TrackerStore } from "./Store.ts";
import { agent, createIssue, human, provided, setup } from "./TestSupport.ts";

describe("TrackerStore", () => {
  describe("command validation", () => {
    it.effect("seeds one status per category on space creation", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const statuses = yield* fixture.store.listStatuses(fixture.spaceId);
          assert.deepStrictEqual(
            statuses.map((status) => status.category),
            [
              "triage",
              "backlog",
              "ready",
              "in_progress",
              "needs_review",
              "done",
              "cancelled",
              "duplicate",
            ],
          );
        }),
      ),
    );

    it.effect("rejects a duplicate space key", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const result = yield* fixture.store
            .execute(
              {
                type: "space.create",
                spaceId: fixture.ids.next() as SpaceId,
                name: "Other",
                key: "MLT",
              },
              human,
            )
            .pipe(Effect.flip);
          assert.strictEqual(result._tag, "CommandRejectedError");
        }),
      ),
    );

    it.effect("defaults new issues to the triage status", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const issueId = yield* createIssue(fixture);
          const detail = yield* fixture.store.getIssue(issueId);
          assert.strictEqual(detail.status.category, "triage");
          assert.strictEqual(detail.shortId, "MLT-1");
        }),
      ),
    );

    it.effect("rejects issue creation into a status of another space", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const otherSpaceId = fixture.ids.next() as SpaceId;
          yield* fixture.store.execute(
            { type: "space.create", spaceId: otherSpaceId, name: "Other", key: "OTH" },
            human,
          );
          const otherStatuses = yield* fixture.store.listStatuses(otherSpaceId);
          const result = yield* createIssue(fixture, {
            statusId: otherStatuses[0]?.id,
          }).pipe(Effect.flip);
          assert.strictEqual(result._tag, "CommandRejectedError");
        }),
      ),
    );

    it.effect("only a human may move an issue into the done category", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const issueId = yield* createIssue(fixture);
          const doneStatusId = fixture.statusIdFor("done");

          const rejection = yield* fixture.store
            .execute({ type: "status.change", issueId, statusId: doneStatusId }, agent)
            .pipe(Effect.flip);
          assert.strictEqual(rejection._tag, "CommandRejectedError");
          assert.isTrue(
            rejection._tag === "CommandRejectedError" && rejection.reason.includes("human"),
          );

          // The same transition as a human is allowed.
          yield* fixture.store.execute(
            { type: "status.change", issueId, statusId: doneStatusId },
            human,
          );
          const detail = yield* fixture.store.getIssue(issueId);
          assert.strictEqual(detail.status.category, "done");
        }),
      ),
    );

    it.effect("agents may make whitelisted transitions", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const issueId = yield* createIssue(fixture);
          yield* fixture.store.execute(
            { type: "status.change", issueId, statusId: fixture.statusIdFor("backlog") },
            agent,
          );
          const detail = yield* fixture.store.getIssue(issueId);
          assert.strictEqual(detail.status.category, "backlog");
        }),
      ),
    );

    it.effect("rejects a no-op status change", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const issueId = yield* createIssue(fixture);
          const result = yield* fixture.store
            .execute({ type: "status.change", issueId, statusId: fixture.triageStatusId }, human)
            .pipe(Effect.flip);
          assert.strictEqual(result._tag, "CommandRejectedError");
        }),
      ),
    );

    it.effect("rejects labels from another space and duplicate label adds", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const issueId = yield* createIssue(fixture);
          const otherSpaceId = fixture.ids.next() as SpaceId;
          yield* fixture.store.execute(
            { type: "space.create", spaceId: otherSpaceId, name: "Other", key: "OTH" },
            human,
          );
          const foreignLabelId = fixture.ids.next() as LabelId;
          yield* fixture.store.execute(
            {
              type: "label.create",
              labelId: foreignLabelId,
              spaceId: otherSpaceId,
              name: "bug",
              color: "#ff0000",
            },
            human,
          );
          const crossSpace = yield* fixture.store
            .execute({ type: "label.add", issueId, labelId: foreignLabelId }, human)
            .pipe(Effect.flip);
          assert.strictEqual(crossSpace._tag, "CommandRejectedError");

          const labelId = fixture.ids.next() as LabelId;
          yield* fixture.store.execute(
            {
              type: "label.create",
              labelId,
              spaceId: fixture.spaceId,
              name: "bug",
              color: "#ff0000",
            },
            human,
          );
          yield* fixture.store.execute({ type: "label.add", issueId, labelId }, human);
          const duplicate = yield* fixture.store
            .execute({ type: "label.add", issueId, labelId }, human)
            .pipe(Effect.flip);
          assert.strictEqual(duplicate._tag, "CommandRejectedError");
        }),
      ),
    );

    it.effect("rejects self-relations and duplicate relations", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const issueA = yield* createIssue(fixture);
          const issueB = yield* createIssue(fixture);

          const selfRelation = yield* fixture.store
            .execute(
              {
                type: "relation.add",
                relationId: fixture.ids.next() as RelationId,
                issueId: issueA,
                kind: "blocks",
                targetId: issueA,
              },
              human,
            )
            .pipe(Effect.flip);
          assert.strictEqual(selfRelation._tag, "CommandRejectedError");

          yield* fixture.store.execute(
            {
              type: "relation.add",
              relationId: fixture.ids.next() as RelationId,
              issueId: issueA,
              kind: "blocks",
              targetId: issueB,
            },
            human,
          );
          // Same edge expressed from the other side is the same canonical row.
          const duplicate = yield* fixture.store
            .execute(
              {
                type: "relation.add",
                relationId: fixture.ids.next() as RelationId,
                issueId: issueB,
                kind: "blocked_by",
                targetId: issueA,
              },
              human,
            )
            .pipe(Effect.flip);
          assert.strictEqual(duplicate._tag, "CommandRejectedError");
        }),
      ),
    );

    it.effect("rejects an empty update", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const issueId = yield* createIssue(fixture);
          const result = yield* fixture.store
            .execute({ type: "issue.update", issueId }, human)
            .pipe(Effect.flip);
          assert.strictEqual(result._tag, "CommandRejectedError");
        }),
      ),
    );

    it.effect("rejects commands against unknown issues", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const ghost = fixture.ids.next() as IssueId;
          const result = yield* fixture.store
            .execute(
              {
                type: "comment.add",
                commentId: fixture.ids.next() as CommentId,
                issueId: ghost,
                body: "hello?",
              },
              human,
            )
            .pipe(Effect.flip);
          assert.strictEqual(result._tag, "CommandRejectedError");
        }),
      ),
    );

    it.effect("a rejected command appends nothing", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const before = yield* fixture.store.listAllEvents();
          yield* fixture.store
            .execute(
              {
                type: "comment.add",
                commentId: fixture.ids.next() as CommentId,
                issueId: fixture.ids.next() as IssueId,
                body: "into the void",
              },
              human,
            )
            .pipe(Effect.flip);
          const after = yield* fixture.store.listAllEvents();
          assert.strictEqual(after.length, before.length);
        }),
      ),
    );
  });

  describe("projection correctness", () => {
    it.effect("issue lifecycle is reflected in projections and views", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const labelId = fixture.ids.next() as LabelId;
          yield* fixture.store.execute(
            {
              type: "label.create",
              labelId,
              spaceId: fixture.spaceId,
              name: "perf",
              color: "#00ff00",
            },
            human,
          );
          const issueId = yield* createIssue(fixture, {
            title: "Make it fast",
            description: "Profile the board render.",
            priority: 2,
            labelIds: [labelId],
          });
          yield* fixture.store.execute(
            { type: "issue.update", issueId, title: "Make it very fast", priority: 1 },
            human,
          );
          yield* fixture.store.execute(
            {
              type: "comment.add",
              commentId: fixture.ids.next() as CommentId,
              issueId,
              body: "Measured 45ms; target 16ms.",
            },
            human,
          );
          yield* fixture.store.execute(
            {
              type: "run-link.add",
              runLinkId: fixture.ids.next() as RunLinkId,
              issueId,
              kind: "pr",
              ref: "https://github.com/example/repo/pull/7",
            },
            human,
          );

          const detail = yield* fixture.store.getIssue(issueId);
          assert.strictEqual(detail.issue.title, "Make it very fast");
          assert.strictEqual(detail.issue.priority, 1);
          assert.strictEqual(detail.issue.description, "Profile the board render.");
          assert.deepStrictEqual(
            detail.labels.map((label) => label.name),
            ["perf"],
          );
          assert.strictEqual(detail.comments.length, 1);
          assert.deepStrictEqual(detail.comments[0]?.actor, human);
          assert.strictEqual(detail.runLinks[0]?.kind, "pr");

          const summaries = yield* fixture.store.listIssues({ labelId });
          assert.deepStrictEqual(
            summaries.map((summary) => summary.id),
            [issueId],
          );
        }),
      ),
    );

    it.effect("issue numbers are sequential per space", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const first = yield* createIssue(fixture);
          const otherSpaceId = fixture.ids.next() as SpaceId;
          yield* fixture.store.execute(
            { type: "space.create", spaceId: otherSpaceId, name: "Other", key: "OTH" },
            human,
          );
          const foreign = fixture.ids.next() as IssueId;
          yield* fixture.store.execute(
            {
              type: "issue.create",
              issueId: foreign,
              spaceId: otherSpaceId,
              title: "Foreign",
              description: "",
              priority: 0,
              issueType: "work",
              labelIds: [],
            },
            human,
          );
          const second = yield* createIssue(fixture);

          const firstDetail = yield* fixture.store.getIssue(first);
          const secondDetail = yield* fixture.store.getIssue(second);
          const foreignDetail = yield* fixture.store.getIssue(foreign);
          assert.strictEqual(firstDetail.shortId, "MLT-1");
          assert.strictEqual(secondDetail.shortId, "MLT-2");
          assert.strictEqual(foreignDetail.shortId, "OTH-1");
        }),
      ),
    );

    it.effect("relations resolve to the six-kind view from both sides", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const blocker = yield* createIssue(fixture, { title: "Blocker" });
          const blocked = yield* createIssue(fixture, { title: "Blocked" });
          yield* fixture.store.execute(
            {
              type: "relation.add",
              relationId: fixture.ids.next() as RelationId,
              issueId: blocked,
              kind: "blocked_by",
              targetId: blocker,
            },
            human,
          );

          const blockedDetail = yield* fixture.store.getIssue(blocked);
          assert.strictEqual(blockedDetail.relations[0]?.kind, "blocked_by");
          assert.strictEqual(blockedDetail.relations[0]?.otherIssueId, blocker);

          const blockerDetail = yield* fixture.store.getIssue(blocker);
          assert.strictEqual(blockerDetail.relations[0]?.kind, "blocks");
          assert.strictEqual(blockerDetail.relations[0]?.otherIssueId, blocked);
        }),
      ),
    );

    it.effect("discovered_from provenance links are supported", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const original = yield* createIssue(fixture, { title: "Original work" });
          const discovered = yield* createIssue(fixture, { title: "Follow-up" });
          yield* fixture.store.execute(
            {
              type: "relation.add",
              relationId: fixture.ids.next() as RelationId,
              issueId: discovered,
              kind: "discovered_from",
              targetId: original,
            },
            human,
          );
          const detail = yield* fixture.store.getIssue(discovered);
          assert.strictEqual(detail.relations[0]?.kind, "discovered_from");
          assert.strictEqual(detail.relations[0]?.outgoing, true);
        }),
      ),
    );

    it.effect("cost.recorded aggregates into detail totals without the log (MLT-53)", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const issueId = yield* createIssue(fixture);
          yield* fixture.store.execute(
            { type: "cost.log", issueId, tokens: 1200, note: "planning" },
            agent,
          );
          yield* fixture.store.execute(
            { type: "cost.log", issueId, tokens: 800, currencyAmount: 0.42 },
            agent,
          );
          const detail = yield* fixture.store.getIssue(issueId);
          assert.deepStrictEqual(detail.costs, {
            entries: 2,
            tokens: 2000,
            currencyAmount: 0.42,
          });

          // Rebuild replays the costs projection identically.
          yield* fixture.store.rebuild();
          const replayed = yield* fixture.store.getIssue(issueId);
          assert.deepStrictEqual(replayed.costs, detail.costs);

          const untouched = yield* createIssue(fixture, { title: "No cost" });
          const empty = yield* fixture.store.getIssue(untouched);
          assert.deepStrictEqual(empty.costs, { entries: 0, tokens: 0, currencyAmount: 0 });
        }),
      ),
    );

    it.effect("triage filter finds issues across spaces", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          yield* createIssue(fixture, { title: "In triage" });
          const moved = yield* createIssue(fixture, { title: "Moved on" });
          yield* fixture.store.execute(
            { type: "status.change", issueId: moved, statusId: fixture.statusIdFor("backlog") },
            human,
          );
          const otherSpaceId = fixture.ids.next() as SpaceId;
          yield* fixture.store.execute(
            { type: "space.create", spaceId: otherSpaceId, name: "Other", key: "OTH" },
            human,
          );
          yield* fixture.store.execute(
            {
              type: "issue.create",
              issueId: fixture.ids.next() as IssueId,
              spaceId: otherSpaceId,
              title: "Other-space triage",
              description: "",
              priority: 0,
              issueType: "work",
              labelIds: [],
            },
            human,
          );

          const triage = yield* fixture.store.listIssues({ category: "triage" });
          assert.deepStrictEqual(triage.map((issue) => issue.title).toSorted(), [
            "In triage",
            "Other-space triage",
          ]);
        }),
      ),
    );

    it.effect("the activity feed carries the true event history with actors", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const issueId = yield* createIssue(fixture);
          yield* fixture.store.execute(
            { type: "status.change", issueId, statusId: fixture.statusIdFor("backlog") },
            agent,
          );
          yield* fixture.store.execute(
            {
              type: "comment.add",
              commentId: fixture.ids.next() as CommentId,
              issueId,
              body: "Working on it.",
            },
            agent,
          );

          const feed = yield* fixture.store.listIssueEvents(issueId);
          assert.deepStrictEqual(
            feed.map((entry) => entry.event.type),
            ["issue.created", "status.changed", "comment.added"],
          );
          assert.deepStrictEqual(feed[0]?.event.actor, human);
          assert.deepStrictEqual(feed[1]?.event.actor, agent);
        }),
      ),
    );

    it.effect("relation events appear in both issues' feeds", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const issueA = yield* createIssue(fixture);
          const issueB = yield* createIssue(fixture);
          yield* fixture.store.execute(
            {
              type: "relation.add",
              relationId: fixture.ids.next() as RelationId,
              issueId: issueA,
              kind: "blocks",
              targetId: issueB,
            },
            human,
          );
          const feedA = yield* fixture.store.listIssueEvents(issueA);
          const feedB = yield* fixture.store.listIssueEvents(issueB);
          assert.isTrue(feedA.some((entry) => entry.event.type === "relation.added"));
          assert.isTrue(feedB.some((entry) => entry.event.type === "relation.added"));
        }),
      ),
    );

    it.effect("batch events chain causation to the batch root", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const labelId = fixture.ids.next() as LabelId;
          yield* fixture.store.execute(
            {
              type: "label.create",
              labelId,
              spaceId: fixture.spaceId,
              name: "bug",
              color: "#ff0000",
            },
            human,
          );
          const events = yield* fixture.store.execute(
            {
              type: "issue.create",
              issueId: fixture.ids.next() as IssueId,
              spaceId: fixture.spaceId,
              title: "With label",
              description: "",
              priority: 0,
              issueType: "work",
              labelIds: [labelId],
            },
            human,
          );
          assert.strictEqual(events[0]?.type, "issue.created");
          assert.strictEqual(events[0]?.causationId, null);
          assert.strictEqual(events[1]?.type, "label.added");
          assert.strictEqual(events[1]?.causationId, events[0]?.id);
        }),
      ),
    );
  });

  describe("rebuild determinism", () => {
    it.effect("rebuild reproduces identical projections", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const labelId = fixture.ids.next() as LabelId;
          yield* fixture.store.execute(
            {
              type: "label.create",
              labelId,
              spaceId: fixture.spaceId,
              name: "bug",
              color: "#ff0000",
            },
            human,
          );
          const issueA = yield* createIssue(fixture, { title: "A", labelIds: [labelId] });
          const issueB = yield* createIssue(fixture, { title: "B", priority: 3 });
          yield* fixture.store.execute(
            { type: "status.change", issueId: issueA, statusId: fixture.statusIdFor("ready") },
            human,
          );
          yield* fixture.store.execute(
            {
              type: "relation.add",
              relationId: fixture.ids.next() as RelationId,
              issueId: issueB,
              kind: "discovered_from",
              targetId: issueA,
            },
            human,
          );
          yield* fixture.store.execute(
            {
              type: "comment.add",
              commentId: fixture.ids.next() as CommentId,
              issueId: issueA,
              body: "note",
            },
            human,
          );
          const removeTarget = fixture.ids.next() as LabelId;
          yield* fixture.store.execute(
            {
              type: "label.create",
              labelId: removeTarget,
              spaceId: fixture.spaceId,
              name: "temp",
              color: "#0000ff",
            },
            human,
          );
          yield* fixture.store.execute(
            { type: "label.add", issueId: issueB, labelId: removeTarget },
            human,
          );
          yield* fixture.store.execute(
            { type: "label.remove", issueId: issueB, labelId: removeTarget },
            human,
          );

          const before = yield* fixture.store.dumpProjections();
          yield* fixture.store.rebuild();
          const after = yield* fixture.store.dumpProjections();
          assert.deepStrictEqual(after, before);
        }),
      ),
    );
  });

  describe("export → import round-trip", () => {
    it.effect("export, wipe (fresh store), import yields identical projections", () =>
      Effect.gen(function* () {
        const source = yield* Effect.gen(function* () {
          const fixture = yield* setup();
          const labelId = fixture.ids.next() as LabelId;
          yield* fixture.store.execute(
            {
              type: "label.create",
              labelId,
              spaceId: fixture.spaceId,
              name: "bug",
              color: "#ff0000",
            },
            human,
          );
          const issueA = yield* createIssue(fixture, { title: "A", labelIds: [labelId] });
          const issueB = yield* createIssue(fixture, { title: "B" });
          yield* fixture.store.execute(
            { type: "status.change", issueId: issueA, statusId: fixture.statusIdFor("done") },
            human,
          );
          yield* fixture.store.execute(
            {
              type: "relation.add",
              relationId: fixture.ids.next() as RelationId,
              issueId: issueA,
              kind: "blocks",
              targetId: issueB,
            },
            human,
          );
          const jsonl = yield* fixture.store.exportJsonl();
          const projections = yield* fixture.store.dumpProjections();
          const events = yield* fixture.store.listAllEvents();
          return { jsonl, projections, events };
        }).pipe(Effect.provide(TrackerStore.layerMemory));

        // A brand-new empty store stands in for "wipe DB".
        yield* Effect.gen(function* () {
          const store = yield* TrackerStore;
          const imported = yield* store.importJsonl(source.jsonl);
          assert.strictEqual(imported.imported, source.events.length);
          const projections = yield* store.dumpProjections();
          assert.deepStrictEqual(projections, source.projections);
          const events = yield* store.listAllEvents();
          assert.deepStrictEqual(events, source.events);
          // Exporting again reproduces the same JSONL byte for byte.
          const reexported = yield* store.exportJsonl();
          assert.strictEqual(reexported, source.jsonl);
        }).pipe(Effect.provide(TrackerStore.layerMemory));
      }),
    );

    it.effect("import refuses to run over a non-empty store", () =>
      provided(
        Effect.gen(function* () {
          const fixture = yield* setup();
          const jsonl = yield* fixture.store.exportJsonl();
          const result = yield* fixture.store.importJsonl(jsonl).pipe(Effect.flip);
          assert.strictEqual(result._tag, "ImportRejectedError");
        }),
      ),
    );

    it.effect("import rejects corrupt lines with the line number", () =>
      provided(
        Effect.gen(function* () {
          const store = yield* TrackerStore;
          const result = yield* store.importJsonl('{"not":"an event"}\n').pipe(Effect.flip);
          assert.strictEqual(result._tag, "ImportRejectedError");
          assert.strictEqual((result as { line: number }).line, 1);
        }),
      ),
    );
  });

  describe("degraded mode", () => {
    it.effect("the unavailable store fails every operation with the sentinel", () =>
      Effect.gen(function* () {
        const store = TrackerStore.unavailable(new Error("disk on fire"));
        const read = yield* store.listIssues({}).pipe(Effect.flip);
        assert.strictEqual(read._tag, "TrackerStorageError");
        assert.strictEqual(read.operation, "unavailable");

        const write = yield* store
          .execute(
            { type: "comment.add", commentId: "x" as never, issueId: "y" as never, body: "hi" },
            human,
          )
          .pipe(Effect.flip);
        assert.strictEqual(write._tag, "TrackerStorageError");
        assert.strictEqual((write as { operation?: string }).operation, "unavailable");
      }),
    );
  });
});
