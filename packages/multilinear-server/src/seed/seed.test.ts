// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFSP from "node:fs/promises";

import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { TrackerStore } from "@multilinear/core/store";

import { runSeed } from "./seed.ts";

const realFutureIdeas = () =>
  NodeFSP.readFile(
    new URL("../../../../multilinear-plan/06-FUTURE-IDEAS.md", import.meta.url),
    "utf8",
  );

describe("runSeed", () => {
  it.effect("seeds the real backlog into an empty store", () =>
    Effect.gen(function* () {
      const markdown = yield* Effect.promise(realFutureIdeas);
      const store = yield* TrackerStore;
      const summary = yield* runSeed({ futureIdeasMarkdown: markdown });

      const spaces = yield* store.listSpaces();
      assert.deepStrictEqual(
        spaces.map((space) => space.key),
        ["MLT"],
      );

      const issues = yield* store.listIssues({});
      assert.strictEqual(issues.length, summary.issues);
      // Parking lot + 3 phases + 4 workstreams + 1 decision.
      assert.isAtLeast(issues.length, 35);

      // Phase 2 sits in ready; the license decision in triage; ideas in backlog.
      const phase2 = issues.find((issue) => issue.title.startsWith("Phase 2"));
      assert.strictEqual(phase2?.category, "ready");
      const license = issues.find((issue) => issue.title.startsWith("Decide the license"));
      assert.strictEqual(license?.category, "triage");
      assert.isTrue(
        issues
          .filter((issue) => issue.issueType === "idea")
          .every((issue) => issue.category === "backlog"),
      );

      // Dependency chain: phase 3 blocked by phase 2; workstreams parent phase 4.
      const phase3 = issues.find((issue) => issue.title.startsWith("Phase 3"));
      assert.isDefined(phase3);
      const phase3Detail = yield* store.getIssue(phase3!.id);
      assert.isTrue(
        phase3Detail.relations.some(
          (relation) => relation.kind === "blocked_by" && relation.otherShortId === phase2?.shortId,
        ),
      );

      // Seed actor is visible in the event history (system, not human).
      const feed = yield* store.listIssueEvents(phase3!.id);
      assert.strictEqual(feed[0]?.event.actor.kind, "system");

      // Idempotency: running again aborts without touching the store.
      const again = yield* runSeed({ futureIdeasMarkdown: markdown }).pipe(Effect.flip);
      assert.strictEqual(again._tag, "SeedAbortedError");
      const issuesAfter = yield* store.listIssues({});
      assert.strictEqual(issuesAfter.length, issues.length);
    }).pipe(Effect.provide(TrackerStore.layerMemory)),
  );
});
