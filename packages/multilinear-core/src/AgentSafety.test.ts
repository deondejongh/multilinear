/**
 * Phase 2 safety properties (03-PHASE-2 §B/§C/§E, 01-ARCHITECTURE §7
 * invariants 2/3/5): the agent transition whitelist, the `done` ban, the
 * proof-required rule, the Ready gate, duplicate proposals, Agent Blocked,
 * and the secret-pattern scan — all enforced in Store command validation
 * keyed on actor kind. These tests are the proof that safety does not live
 * in prompt politeness.
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import type { Actor, CommentId, IssueId, ProofId, RelationId, StatusCategory } from "./Model.ts";
import type { ProofOfWork } from "./Proof.ts";
import { ISSUE_TEMPLATE } from "./ReadyGate.ts";
import { agent, createIssue, type Fixture, human, provided, setup } from "./TestSupport.ts";

const rule: Actor = { kind: "rule", id: "auto-triage" };
const system: Actor = { kind: "system", id: "phase2-test" };

const SPECIFIED_DESCRIPTION = `## Acceptance criteria

- The gate passes

## Affected area

- core
`;

const minimalProof: ProofOfWork = {
  summary: "Implemented the thing and tested it.",
  notDone: [],
  tests: [],
  risks: [],
  followupsFiled: [],
};

const changeStatus = (fixture: Fixture, issueId: IssueId, category: StatusCategory, actor: Actor) =>
  fixture.store.execute(
    { type: "status.change", issueId, statusId: fixture.statusIdFor(category) },
    actor,
  );

const expectRejection = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  reasonIncludes: string,
): Effect.Effect<void, A, R> =>
  Effect.gen(function* () {
    const failure = yield* effect.pipe(Effect.flip);
    const rejection = failure as { _tag?: string; reason?: string };
    assert.strictEqual(rejection._tag, "CommandRejectedError");
    assert.include(rejection.reason ?? "", reasonIncludes);
  });

const attachProof = (fixture: Fixture, issueId: IssueId, actor: Actor, proof?: ProofOfWork) =>
  fixture.store.execute(
    {
      type: "proof.attach",
      proofId: fixture.ids.next() as ProofId,
      issueId,
      proof: proof ?? minimalProof,
    },
    actor,
  );

describe("agent transition whitelist (invariant 3)", () => {
  it.effect("the whitelisted path works end to end for an agent", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture, { description: SPECIFIED_DESCRIPTION });
        yield* changeStatus(fixture, issueId, "backlog", agent);
        yield* changeStatus(fixture, issueId, "ready", agent);
        yield* changeStatus(fixture, issueId, "in_progress", agent);
        yield* attachProof(fixture, issueId, agent);
        yield* changeStatus(fixture, issueId, "needs_review", agent);
        const detail = yield* fixture.store.getIssue(issueId);
        assert.strictEqual(detail.status.category, "needs_review");
      }),
    ),
  );

  it.effect("off-whitelist transitions are rejected server-side", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture);
        // triage → in_progress: skipping the specification pipeline.
        yield* expectRejection(
          changeStatus(fixture, issueId, "in_progress", agent),
          "agent actors may not transition",
        );
        // triage → cancelled: agents never cancel.
        yield* expectRejection(
          changeStatus(fixture, issueId, "cancelled", agent),
          "agent actors may not transition",
        );
        yield* changeStatus(fixture, issueId, "backlog", agent);
        // backlog → triage: no going backwards.
        yield* expectRejection(
          changeStatus(fixture, issueId, "triage", agent),
          "agent actors may not transition",
        );
        const detail = yield* fixture.store.getIssue(issueId);
        assert.strictEqual(detail.status.category, "backlog");
      }),
    ),
  );

  it.effect("the done ban holds for every non-human actor kind", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture);
        for (const actor of [agent, rule, system]) {
          yield* expectRejection(
            changeStatus(fixture, issueId, "done", actor),
            "only a human may move an issue into the done category",
          );
        }
        // needs_review → done as an agent: banned even from the airlock.
        yield* changeStatus(fixture, issueId, "needs_review", human);
        yield* expectRejection(
          changeStatus(fixture, issueId, "done", agent),
          "only a human may move an issue into the done category",
        );
        // The human is allowed through.
        yield* changeStatus(fixture, issueId, "done", human);
        const detail = yield* fixture.store.getIssue(issueId);
        assert.strictEqual(detail.status.category, "done");
      }),
    ),
  );

  it.effect("humans are not restricted by the agent whitelist", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture);
        yield* changeStatus(fixture, issueId, "in_progress", human);
        yield* changeStatus(fixture, issueId, "cancelled", human);
        const detail = yield* fixture.store.getIssue(issueId);
        assert.strictEqual(detail.status.category, "cancelled");
      }),
    ),
  );
});

describe("proof-required rule (03 §B)", () => {
  it.effect("agent in_progress → needs_review without proof is rejected", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture, { description: SPECIFIED_DESCRIPTION });
        yield* changeStatus(fixture, issueId, "backlog", agent);
        yield* changeStatus(fixture, issueId, "ready", agent);
        yield* changeStatus(fixture, issueId, "in_progress", agent);
        yield* expectRejection(
          changeStatus(fixture, issueId, "needs_review", agent),
          "attach proof of work",
        );
        yield* attachProof(fixture, issueId, agent);
        yield* changeStatus(fixture, issueId, "needs_review", agent);
        const detail = yield* fixture.store.getIssue(issueId);
        assert.strictEqual(detail.status.category, "needs_review");
        assert.strictEqual(detail.proofs.length, 1);
        assert.strictEqual(detail.proofs[0]?.proof.summary, minimalProof.summary);
      }),
    ),
  );

  it.effect("a proof from a previous in_progress stint does not count", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture, { description: SPECIFIED_DESCRIPTION });
        yield* changeStatus(fixture, issueId, "in_progress", human);
        yield* attachProof(fixture, issueId, agent);
        yield* changeStatus(fixture, issueId, "needs_review", agent);
        // Review bounced: the human sends it back to in_progress.
        yield* changeStatus(fixture, issueId, "in_progress", human);
        yield* expectRejection(
          changeStatus(fixture, issueId, "needs_review", agent),
          "attach proof of work",
        );
        yield* attachProof(fixture, issueId, agent);
        yield* changeStatus(fixture, issueId, "needs_review", agent);
      }),
    ),
  );

  it.effect("humans may move to needs_review without proof", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture);
        yield* changeStatus(fixture, issueId, "in_progress", human);
        yield* changeStatus(fixture, issueId, "needs_review", human);
        const detail = yield* fixture.store.getIssue(issueId);
        assert.strictEqual(detail.status.category, "needs_review");
      }),
    ),
  );
});

describe("Ready gate (03 §E)", () => {
  it.effect("agent backlog → ready is rejected without acceptance criteria", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture, { description: "just a title, no spec" });
        yield* changeStatus(fixture, issueId, "backlog", agent);
        yield* expectRejection(changeStatus(fixture, issueId, "ready", agent), "Ready gate failed");
        // An empty checklist section is as good as no section.
        yield* fixture.store.execute(
          { type: "issue.update", issueId, description: ISSUE_TEMPLATE },
          human,
        );
        yield* expectRejection(changeStatus(fixture, issueId, "ready", agent), "Ready gate failed");
        yield* fixture.store.execute(
          { type: "issue.update", issueId, description: SPECIFIED_DESCRIPTION },
          human,
        );
        yield* changeStatus(fixture, issueId, "ready", agent);
        const detail = yield* fixture.store.getIssue(issueId);
        assert.strictEqual(detail.status.category, "ready");
      }),
    ),
  );

  it.effect("humans may override the gate (soft lint)", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture, { description: "" });
        yield* changeStatus(fixture, issueId, "backlog", human);
        yield* changeStatus(fixture, issueId, "ready", human);
        const detail = yield* fixture.store.getIssue(issueId);
        assert.strictEqual(detail.status.category, "ready");
      }),
    ),
  );
});

describe("duplicate proposals (03 §C)", () => {
  it.effect("an agent move to duplicate becomes a pending proposal", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture);
        yield* changeStatus(fixture, issueId, "duplicate", agent);
        const detail = yield* fixture.store.getIssue(issueId);
        assert.strictEqual(detail.status.category, "triage");
        assert.strictEqual(detail.issue.pendingDuplicateStatusId, fixture.statusIdFor("duplicate"));
        // Proposing twice is rejected.
        yield* expectRejection(
          changeStatus(fixture, issueId, "duplicate", agent),
          "already pending",
        );
        const feed = yield* fixture.store.listIssueEvents(issueId);
        assert.include(
          feed.map((entry) => entry.event.type),
          "duplicate.proposed",
        );
      }),
    ),
  );

  it.effect("a human confirms the proposal into the duplicate status", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture);
        yield* changeStatus(fixture, issueId, "duplicate", agent);
        yield* fixture.store.execute({ type: "duplicate.resolve", issueId, accept: true }, human);
        const detail = yield* fixture.store.getIssue(issueId);
        assert.strictEqual(detail.status.category, "duplicate");
        assert.isNull(detail.issue.pendingDuplicateStatusId);
      }),
    ),
  );

  it.effect("a human rejects the proposal and the issue stays put", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture);
        yield* changeStatus(fixture, issueId, "duplicate", agent);
        yield* fixture.store.execute({ type: "duplicate.resolve", issueId, accept: false }, human);
        const detail = yield* fixture.store.getIssue(issueId);
        assert.strictEqual(detail.status.category, "triage");
        assert.isNull(detail.issue.pendingDuplicateStatusId);
      }),
    ),
  );

  it.effect("only humans resolve proposals; none pending is an error", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture);
        yield* expectRejection(
          fixture.store.execute({ type: "duplicate.resolve", issueId, accept: true }, human),
          "no duplicate proposal is pending",
        );
        yield* changeStatus(fixture, issueId, "duplicate", agent);
        yield* expectRejection(
          fixture.store.execute({ type: "duplicate.resolve", issueId, accept: true }, agent),
          "only a human",
        );
      }),
    ),
  );
});

describe("Agent Blocked (03 §A ml_request_input)", () => {
  it.effect("request_input posts the question and flags the issue", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture);
        yield* fixture.store.execute(
          {
            type: "input.request",
            issueId,
            commentId: fixture.ids.next() as CommentId,
            question: "Should the retry budget be per-issue or global?",
          },
          agent,
        );
        const detail = yield* fixture.store.getIssue(issueId);
        assert.isTrue(detail.issue.agentBlocked);
        assert.strictEqual(detail.comments.length, 1);
        assert.include(detail.comments[0]?.body ?? "", "retry budget");

        const blocked = yield* fixture.store.listIssues({ agentBlocked: true });
        assert.deepStrictEqual(
          blocked.map((issue) => issue.id),
          [issueId],
        );
      }),
    ),
  );

  it.effect("a human comment answers and clears the flag", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture);
        yield* fixture.store.execute(
          {
            type: "input.request",
            issueId,
            commentId: fixture.ids.next() as CommentId,
            question: "Which one?",
          },
          agent,
        );
        // Another agent comment does not clear it.
        yield* fixture.store.execute(
          {
            type: "comment.add",
            commentId: fixture.ids.next() as CommentId,
            issueId,
            body: "Still waiting.",
          },
          agent,
        );
        assert.isTrue((yield* fixture.store.getIssue(issueId)).issue.agentBlocked);
        yield* fixture.store.execute(
          {
            type: "comment.add",
            commentId: fixture.ids.next() as CommentId,
            issueId,
            body: "Per-issue.",
          },
          human,
        );
        assert.isFalse((yield* fixture.store.getIssue(issueId)).issue.agentBlocked);
      }),
    ),
  );

  it.effect("only agent actors may request input", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture);
        yield* expectRejection(
          fixture.store.execute(
            {
              type: "input.request",
              issueId,
              commentId: fixture.ids.next() as CommentId,
              question: "May I?",
            },
            human,
          ),
          "only agent actors",
        );
      }),
    ),
  );
});

describe("secret-pattern scan (invariant 5)", () => {
  it.effect("an agent comment containing a token is rejected, nothing persists", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture);
        const body = "Use ghp_0123456789abcdefghijklmnopqrstuv123456 to authenticate.";
        yield* expectRejection(
          fixture.store.execute(
            { type: "comment.add", commentId: fixture.ids.next() as CommentId, issueId, body },
            agent,
          ),
          "possible secret detected",
        );
        const detail = yield* fixture.store.getIssue(issueId);
        assert.strictEqual(detail.comments.length, 0);
        // The same body from the accountable human is not blocked.
        yield* fixture.store.execute(
          { type: "comment.add", commentId: fixture.ids.next() as CommentId, issueId, body },
          human,
        );
      }),
    ),
  );

  it.effect("secrets nested inside a proof payload are caught", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture);
        yield* expectRejection(
          attachProof(fixture, issueId, agent, {
            ...minimalProof,
            tests: [
              {
                command: "vp test run",
                result: "passed",
                detail: "ran with AKIAIOSFODNN7EXAMPLE in env",
              },
            ],
          }),
          "possible secret detected",
        );
        const detail = yield* fixture.store.getIssue(issueId);
        assert.strictEqual(detail.proofs.length, 0);
      }),
    ),
  );

  it.effect("an agent question containing a secret is rejected", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture);
        yield* expectRejection(
          fixture.store.execute(
            {
              type: "input.request",
              issueId,
              commentId: fixture.ids.next() as CommentId,
              question:
                "Is sk-ant-api03-averyveryverylongsecretkeyvalue the right key to configure?",
            },
            agent,
          ),
          "possible secret detected",
        );
      }),
    ),
  );
});

describe("cost log (03 §A ml_log_cost)", () => {
  it.effect("records a cost event; an empty record is rejected", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture);
        yield* fixture.store.execute(
          { type: "cost.log", issueId, tokens: 12_500, note: "spike run" },
          agent,
        );
        const feed = yield* fixture.store.listIssueEvents(issueId);
        const cost = feed.find((entry) => entry.event.type === "cost.recorded");
        assert.isDefined(cost);
        yield* expectRejection(
          fixture.store.execute({ type: "cost.log", issueId }, agent),
          "nothing to record",
        );
      }),
    ),
  );
});

describe("ready queries and short-id resolution", () => {
  it.effect("listReadyIssues excludes issues with open blockers", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const blocked = yield* createIssue(fixture, { title: "Blocked work" });
        const blocker = yield* createIssue(fixture, { title: "The blocker" });
        const free = yield* createIssue(fixture, { title: "Free work" });
        yield* changeStatus(fixture, blocked, "ready", human);
        yield* changeStatus(fixture, free, "ready", human);
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
        const before = yield* fixture.store.listReadyIssues(fixture.spaceId);
        assert.deepStrictEqual(
          before.map((issue) => issue.id),
          [free],
        );
        // Blocker reaches done: the blocked issue becomes ready to pick up.
        yield* changeStatus(fixture, blocker, "done", human);
        const after = yield* fixture.store.listReadyIssues(fixture.spaceId);
        assert.deepStrictEqual(new Set(after.map((issue) => issue.id)), new Set([free, blocked]));
      }),
    ),
  );

  it.effect("resolveIssueId accepts short-ids (case-insensitive) and ULIDs", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture);
        assert.strictEqual(yield* fixture.store.resolveIssueId("MLT-1"), issueId);
        assert.strictEqual(yield* fixture.store.resolveIssueId("mlt-1"), issueId);
        assert.strictEqual(yield* fixture.store.resolveIssueId(issueId), issueId);
        assert.isUndefined(yield* fixture.store.resolveIssueId("MLT-999"));
        assert.isUndefined(yield* fixture.store.resolveIssueId("not-an-id"));
      }),
    ),
  );
});

describe("rebuild determinism with Phase 2 events", () => {
  it.effect("projections match after replaying a log with the new event types", () =>
    provided(
      Effect.gen(function* () {
        const fixture = yield* setup();
        const issueId = yield* createIssue(fixture, { description: SPECIFIED_DESCRIPTION });
        yield* changeStatus(fixture, issueId, "in_progress", human);
        yield* attachProof(fixture, issueId, agent);
        yield* fixture.store.execute(
          {
            type: "input.request",
            issueId,
            commentId: fixture.ids.next() as CommentId,
            question: "Anything else in scope?",
          },
          agent,
        );
        yield* fixture.store.execute({ type: "cost.log", issueId, tokens: 42 }, agent);
        const other = yield* createIssue(fixture);
        yield* changeStatus(fixture, other, "duplicate", agent);

        const before = yield* fixture.store.dumpProjections();
        yield* fixture.store.rebuild();
        const after = yield* fixture.store.dumpProjections();
        assert.deepStrictEqual(after, before);
      }),
    ),
  );
});
