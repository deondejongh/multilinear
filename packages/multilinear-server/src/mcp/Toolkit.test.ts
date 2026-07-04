/**
 * MCP toolkit tests (03-PHASE-2 §A): short-id ergonomics, actor identity on
 * every mutation, the snake_case proof mapping, and — critically — that core
 * whitelist rejections surface to the calling agent as readable tool errors.
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";

import type { Actor, SpaceId, StatusCategory } from "@multilinear/core/model";
import { TrackerStore } from "@multilinear/core/store";
import { makeUlidGenerator } from "@multilinear/core/ulid";

import {
  MultilinearMcpActor,
  MultilinearToolkit,
  MultilinearToolkitHandlersLive,
} from "./Toolkit.ts";

const agentActor: Actor = { kind: "agent", id: "test-harness:agent" };
const human: Actor = { kind: "human", id: "deon" };

const makeIds = () => {
  let counter = 0;
  const generator = makeUlidGenerator((bytes) => {
    counter += 1;
    bytes.fill(0);
    bytes[8] = Math.floor(counter / 256);
    bytes[9] = counter % 256;
  });
  return { next: () => generator.next(1_700_000_000_000) };
};

type ToolName = keyof typeof MultilinearToolkit.tools & string;

const callTool = Effect.fnUntraced(function* <Name extends ToolName>(name: Name, params: unknown) {
  const built = yield* MultilinearToolkit;
  const outcome = yield* built.handle(name, params as never).pipe(
    Stream.unwrap,
    Stream.run(Sink.last()),
    Effect.flatMap((last) => Effect.fromOption(last)),
  );
  return outcome.result as unknown;
});

/** Invoke a tool that is expected to fail; returns the failure value. */
const callToolFailure = <Name extends ToolName>(name: Name, params: unknown) =>
  callTool(name, params).pipe(
    Effect.flip,
    Effect.mapError(() => "tool unexpectedly succeeded" as const),
    Effect.map((failure) => failure as { readonly reason?: string }),
  );

const layer = MultilinearToolkitHandlersLive.pipe(
  Layer.provideMerge(
    Layer.mergeAll(TrackerStore.layerMemory, MultilinearMcpActor.layerStatic(agentActor)),
  ),
);

/** One space (key MLT) with an issue per requested category. */
const seed = Effect.fnUntraced(function* (categories: ReadonlyArray<StatusCategory>) {
  const store = yield* TrackerStore;
  const ids = makeIds();
  const spaceId = ids.next() as SpaceId;
  yield* store.execute({ type: "space.create", spaceId, name: "Multilinear", key: "MLT" }, human);
  const statuses = yield* store.listStatuses(spaceId);
  for (const category of categories) {
    const status = statuses.find((candidate) => candidate.category === category);
    yield* store.execute(
      {
        type: "issue.create",
        issueId: ids.next() as never,
        spaceId,
        title: `Issue in ${category}`,
        description: "## Acceptance criteria\n\n- it works\n",
        priority: 0,
        issueType: "work",
        labelIds: [],
        statusId: status?.id as never,
      },
      human,
    );
  }
  return { store, spaceId };
});

describe("multilinear MCP toolkit", () => {
  it.effect("ml_list_ready → ml_get_issue round trip on short-ids", () =>
    Effect.gen(function* () {
      yield* seed(["ready", "backlog"]);
      const ready = (yield* callTool("ml_list_ready", { space: "MLT" })) as {
        issues: ReadonlyArray<{ id: string; title: string }>;
      };
      assert.deepStrictEqual(
        ready.issues.map((issue) => issue.title),
        ["Issue in ready"],
      );
      const shortId = ready.issues[0]?.id ?? "";
      assert.match(shortId, /^MLT-\d+$/);

      const detail = (yield* callTool("ml_get_issue", { id: shortId.toLowerCase() })) as {
        id: string;
        category: string;
        proofs_attached: number;
      };
      assert.strictEqual(detail.id, shortId);
      assert.strictEqual(detail.category, "ready");
      assert.strictEqual(detail.proofs_attached, 0);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("unknown refs come back as agent-readable errors", () =>
    Effect.gen(function* () {
      yield* seed([]);
      const failure = yield* callToolFailure("ml_get_issue", { id: "MLT-99" });
      assert.include(failure.reason ?? String(failure), 'unknown issue "MLT-99"');
    }).pipe(Effect.provide(layer)),
  );

  it.effect("the full agent loop: comment, claim, proof, review, follow-up", () =>
    Effect.gen(function* () {
      const { store } = yield* seed(["ready"]);

      yield* callTool("ml_comment", { id: "MLT-1", body: "Claiming this issue." });
      const claimed = (yield* callTool("ml_transition", {
        id: "MLT-1",
        to_status: "in_progress",
      })) as { result: string };
      assert.strictEqual(claimed.result, "transitioned");

      // needs_review before proof: the core rule surfaces through the tool.
      const early = yield* callToolFailure("ml_transition", {
        id: "MLT-1",
        to_status: "needs_review",
      });
      assert.include(early.reason ?? "", "attach proof of work");

      yield* callTool("ml_attach_proof", {
        id: "MLT-1",
        proof: {
          summary: "Did the thing.",
          not_done: ["docs"],
          diff_stat: { files_changed: 2, insertions: 40, deletions: 3 },
          tests: [{ command: "vp test run", result: "passed", detail: "12 tests" }],
          risks: ["none known"],
          followups_filed: [],
          cost: { tokens: 1200 },
        },
      });
      const reviewed = (yield* callTool("ml_transition", {
        id: "MLT-1",
        to_status: "needs_review",
      })) as { result: string };
      assert.strictEqual(reviewed.result, "transitioned");

      const followup = (yield* callTool("ml_create_issue", {
        title: "Found while working MLT-1",
        space: "mlt",
        type: "work",
        discovered_from: "MLT-1",
      })) as { id: string };
      assert.strictEqual(followup.id, "MLT-2");

      // Everything above was recorded as this agent, with provenance.
      const detail = (yield* callTool("ml_get_issue", { id: followup.id })) as {
        relations: ReadonlyArray<{ kind: string; issue: string; title: string; category: string }>;
      };
      assert.deepStrictEqual(detail.relations, [
        {
          kind: "discovered_from",
          issue: "MLT-1",
          title: "Issue in ready",
          category: "needs_review",
        },
      ]);
      const issueDetail = yield* store.getIssue((yield* store.resolveIssueId("MLT-1")) as never);
      assert.strictEqual(issueDetail.comments[0]?.actor.kind, "agent");
      assert.strictEqual(issueDetail.comments[0]?.actor.id, agentActor.id);
      assert.strictEqual(issueDetail.proofs[0]?.actor.id, agentActor.id);
      assert.strictEqual(issueDetail.proofs[0]?.proof.diffStat?.filesChanged, 2);
      assert.strictEqual(issueDetail.proofs[0]?.proof.cost?.tokens, 1200);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("the done ban reads back to the agent verbatim", () =>
    Effect.gen(function* () {
      yield* seed(["needs_review"]);
      const failure = yield* callToolFailure("ml_transition", { id: "MLT-1", to_status: "done" });
      assert.include(failure.reason ?? "", "only a human may move an issue into the done category");
    }).pipe(Effect.provide(layer)),
  );

  it.effect("ml_request_input flags the issue and ml_log_cost records", () =>
    Effect.gen(function* () {
      yield* seed(["in_progress"]);
      yield* callTool("ml_request_input", { id: "MLT-1", question: "Which retry budget?" });
      const detail = (yield* callTool("ml_get_issue", { id: "MLT-1" })) as {
        agent_blocked: boolean;
        comments: ReadonlyArray<{ body: string }>;
      };
      assert.isTrue(detail.agent_blocked);
      assert.include(detail.comments[0]?.body ?? "", "retry budget");

      yield* callTool("ml_log_cost", { id: "MLT-1", tokens: 500, note: "planning" });
      const empty = yield* callToolFailure("ml_log_cost", { id: "MLT-1" });
      assert.include(empty.reason ?? "", "nothing to record");
    }).pipe(Effect.provide(layer)),
  );
});
