/**
 * The multilinear MCP toolkit (03-PHASE-2 §A) — the universal adapter that
 * makes any agent in any harness a first-class citizen of the board. Small
 * surface, JSON in/out; every mutating tool records `actor.kind = "agent"`
 * plus the calling session identity via {@link MultilinearMcpActor}.
 *
 * Safety note: these tools add no policy of their own. The transition
 * whitelist, the done ban, the proof-required rule, and the secret scan all
 * live in `@multilinear/core` command validation — a rejected command comes
 * back to the agent as a tool error with the server's reason.
 */
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { Tool, Toolkit } from "effect/unstable/ai";

import type {
  Actor,
  CommentId,
  IssueId,
  ProofId,
  RelationId,
  SpaceId,
  StatusCategory as StatusCategoryType,
} from "@multilinear/core/model";
import { StatusCategory, TrimmedNonEmptyString } from "@multilinear/core/model";
import { ProofOfWork } from "@multilinear/core/proof";
import { TrackerStore } from "@multilinear/core/store";
import { makeUlidGenerator } from "@multilinear/core/ulid";
import type { IssueSummary } from "@multilinear/core/views";

/** Resolves the acting agent identity for the current tool invocation. */
export class MultilinearMcpActor extends Context.Service<
  MultilinearMcpActor,
  {
    readonly resolve: Effect.Effect<Actor>;
  }
>()("@multilinear/server/mcp/Toolkit/MultilinearMcpActor") {
  /** One fixed identity for the whole server — the stdio entry point. */
  static readonly layerStatic = (actor: Actor): Layer.Layer<MultilinearMcpActor> =>
    Layer.succeed(MultilinearMcpActor, { resolve: Effect.succeed(actor) });
}

/** Tool-facing failure: the reason is written for the calling agent. */
export class MlToolError extends Schema.TaggedErrorClass<MlToolError>()("MlToolError", {
  reason: Schema.String,
}) {
  override get message(): string {
    return this.reason;
  }
}

/**
 * Build an MlToolError with a flattened stack: the MCP transport renders
 * failures with `Cause.pretty`, which prefers `stack` — the calling agent
 * should read the reason, not our internals.
 */
const mlToolError = (reason: string): MlToolError => {
  const error = new MlToolError({ reason });
  error.stack = `MlToolError: ${reason}`;
  return error;
};

const dependencies = [TrackerStore, MultilinearMcpActor];

// ── Wire schemas (snake_case: this is the public agent-facing surface) ─────

const IssueCard = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  category: StatusCategory,
  priority: Schema.Int,
  type: Schema.String,
  labels: Schema.Array(Schema.String),
  agent_blocked: Schema.Boolean,
  updated_at: Schema.String,
});

const ListReadyResult = Schema.Struct({
  issues: Schema.Array(IssueCard),
});

const IssueRelation = Schema.Struct({
  kind: Schema.String,
  issue: Schema.String,
  title: Schema.String,
  category: StatusCategory,
});

const IssueComment = Schema.Struct({
  author: Schema.String,
  body: Schema.String,
  at: Schema.String,
});

const GetIssueResult = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  description: Schema.String,
  space: Schema.String,
  status: Schema.String,
  category: StatusCategory,
  priority: Schema.Int,
  type: Schema.String,
  labels: Schema.Array(Schema.String),
  agent_blocked: Schema.Boolean,
  pending_duplicate: Schema.Boolean,
  relations: Schema.Array(IssueRelation),
  /** Oldest first, capped at the most recent 20. */
  comments: Schema.Array(IssueComment),
  proofs_attached: Schema.Int,
});

const TransitionResult = Schema.Struct({
  id: Schema.String,
  result: Schema.Literals(["transitioned", "duplicate_proposed"]),
  category: StatusCategory,
});

const McpDiffStat = Schema.Struct({
  files_changed: Schema.Int,
  insertions: Schema.Int,
  deletions: Schema.Int,
});

const McpTestReport = Schema.Struct({
  command: TrimmedNonEmptyString,
  result: Schema.Literals(["passed", "failed", "not_run"]),
  detail: Schema.optional(Schema.String),
});

const McpCost = Schema.Struct({
  tokens: Schema.optional(Schema.Int),
  currency_amount: Schema.optional(Schema.Number),
  note: Schema.optional(Schema.String),
});

/** Proof-of-work v0 as documented in docs/proof-of-work.md. */
const McpProof = Schema.Struct({
  summary: TrimmedNonEmptyString,
  not_done: Schema.optional(Schema.Array(Schema.String)),
  diff_stat: Schema.optional(McpDiffStat),
  tests: Schema.optional(Schema.Array(McpTestReport)),
  risks: Schema.optional(Schema.Array(Schema.String)),
  followups_filed: Schema.optional(Schema.Array(Schema.String)),
  cost: Schema.optional(McpCost),
});

const Ack = Schema.Struct({ ok: Schema.Literal(true) });

const CreateIssueResult = Schema.Struct({ id: Schema.String });

// ── Tools ───────────────────────────────────────────────────────────────────

export const MlListReady = Tool.make("ml_list_ready", {
  description:
    "List issues that are ready to pick up: category `ready` with no open blockers. Pass a space key (e.g. `MLT`) to filter to one space. Returned `id`s are short-ids usable with every other ml_ tool.",
  parameters: Schema.Struct({
    space: Schema.optional(Schema.String),
  }),
  success: ListReadyResult,
  failure: MlToolError,
  dependencies,
})
  .annotate(Tool.Title, "List ready issues")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.Destructive, false);

export const MlGetIssue = Tool.make("ml_get_issue", {
  description:
    "Get one issue in full: description, status, relations (blockers, parent, discovered-from provenance), recent comments, and how many proofs of work are attached. `id` is a short-id like `MLT-7`.",
  parameters: Schema.Struct({
    id: TrimmedNonEmptyString,
  }),
  success: GetIssueResult,
  failure: MlToolError,
  dependencies,
})
  .annotate(Tool.Title, "Get issue")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.Destructive, false);

export const MlComment = Tool.make("ml_comment", {
  description:
    "Post a markdown comment on an issue as this agent. Use it to claim an issue before starting, report progress, or leave findings. Never paste secret values — comments are scanned and rejected if they contain credential-shaped strings.",
  parameters: Schema.Struct({
    id: TrimmedNonEmptyString,
    body: TrimmedNonEmptyString,
  }),
  success: Ack,
  failure: MlToolError,
  dependencies,
})
  .annotate(Tool.Title, "Comment on issue")
  .annotate(Tool.Destructive, false);

export const MlTransition = Tool.make("ml_transition", {
  description:
    "Move an issue to another status category. Agent-allowed transitions (enforced server-side): triage->backlog, backlog->ready (needs acceptance criteria in the description), ready->in_progress, in_progress->needs_review (needs proof of work attached first). A move to `duplicate` files a proposal a human confirms. Moves to `done` or `cancelled` are human-only and will be rejected.",
  parameters: Schema.Struct({
    id: TrimmedNonEmptyString,
    to_status: StatusCategory,
  }),
  success: TransitionResult,
  failure: MlToolError,
  dependencies,
})
  .annotate(Tool.Title, "Transition issue")
  .annotate(Tool.Destructive, false);

export const MlCreateIssue = Tool.make("ml_create_issue", {
  description:
    "Create a new issue (it lands in triage). When filing work you discovered while working another issue, you MUST pass discovered_from with that issue's id — provenance is how humans trust agent-filed work. `space` is the space key, e.g. `MLT`.",
  parameters: Schema.Struct({
    title: TrimmedNonEmptyString,
    body: Schema.optional(Schema.String),
    space: TrimmedNonEmptyString,
    type: Schema.optional(Schema.Literals(["work", "idea", "spike", "config"])),
    discovered_from: Schema.optional(Schema.String),
  }),
  success: CreateIssueResult,
  failure: MlToolError,
  dependencies,
})
  .annotate(Tool.Title, "Create issue")
  .annotate(Tool.Destructive, false);

export const MlAttachProof = Tool.make("ml_attach_proof", {
  description:
    "Attach structured proof of work to an issue: summary (what changed and why), not_done (explicitly out of scope or skipped), diff_stat, tests (what ran and results), risks, followups_filed (issue ids), cost. Required before an agent can transition in_progress->needs_review. Proofs are scanned for secrets — describe credentials, never paste values.",
  parameters: Schema.Struct({
    id: TrimmedNonEmptyString,
    proof: McpProof,
  }),
  success: Ack,
  failure: MlToolError,
  dependencies,
})
  .annotate(Tool.Title, "Attach proof of work")
  .annotate(Tool.Destructive, false);

export const MlRequestInput = Tool.make("ml_request_input", {
  description:
    "Ask the human a question you cannot answer yourself and mark the issue Agent Blocked (badged and filterable on the board). The question is posted as a comment; the flag clears when a human replies. Use this instead of guessing at product decisions.",
  parameters: Schema.Struct({
    id: TrimmedNonEmptyString,
    question: TrimmedNonEmptyString,
  }),
  success: Ack,
  failure: MlToolError,
  dependencies,
})
  .annotate(Tool.Title, "Request human input")
  .annotate(Tool.Destructive, false);

export const MlLogCost = Tool.make("ml_log_cost", {
  description:
    "Record the cost of work on an issue: tokens used, a currency amount, or a free-form note. At least one field is required.",
  parameters: Schema.Struct({
    id: TrimmedNonEmptyString,
    tokens: Schema.optional(Schema.Int),
    currency_amount: Schema.optional(Schema.Number),
    note: Schema.optional(Schema.String),
  }),
  success: Ack,
  failure: MlToolError,
  dependencies,
})
  .annotate(Tool.Title, "Log cost")
  .annotate(Tool.Destructive, false);

export const MultilinearToolkit = Toolkit.make(
  MlListReady,
  MlGetIssue,
  MlComment,
  MlTransition,
  MlCreateIssue,
  MlAttachProof,
  MlRequestInput,
  MlLogCost,
);

// ── Handlers ────────────────────────────────────────────────────────────────

const fail = (reason: string) => Effect.fail(mlToolError(reason));

const toToolError = <A, E extends { message: string }, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.mapError((error) => mlToolError(error.message)));

const cardOf = (summary: IssueSummary) => ({
  id: summary.shortId,
  title: summary.title,
  category: summary.category,
  priority: summary.priority,
  type: summary.issueType,
  labels: summary.labels.map((label) => label.name),
  agent_blocked: summary.agentBlocked,
  updated_at: summary.updatedAt,
});

const decodeProof = Schema.decodeUnknownEffect(ProofOfWork);

export const MultilinearToolkitHandlersLive = MultilinearToolkit.toLayer(
  Effect.gen(function* () {
    const store = yield* TrackerStore;
    const actorService = yield* MultilinearMcpActor;
    const ulid = makeUlidGenerator((bytes) => {
      globalThis.crypto.getRandomValues(bytes as Uint8Array<ArrayBuffer>);
    });

    const nextId = Effect.gen(function* () {
      const nowMs = yield* Clock.currentTimeMillis;
      return ulid.next(nowMs);
    });

    const resolveIssue = Effect.fnUntraced(function* (ref: string) {
      const issueId = yield* toToolError(store.resolveIssueId(ref));
      if (issueId === undefined) {
        return yield* fail(
          `unknown issue "${ref}" — pass a short-id like MLT-7 (see ml_list_ready) or a full issue id`,
        );
      }
      return issueId;
    });

    const resolveSpace = Effect.fnUntraced(function* (key: string) {
      const spaces = yield* toToolError(store.listSpaces());
      const space = spaces.find(
        (candidate) => candidate.key.toUpperCase() === key.trim().toUpperCase(),
      );
      if (space === undefined) {
        const known = spaces.map((candidate) => candidate.key).join(", ");
        return yield* fail(`unknown space "${key}" — known space keys: ${known}`);
      }
      return space;
    });

    const statusFor = Effect.fnUntraced(function* (spaceId: SpaceId, category: StatusCategoryType) {
      const statuses = yield* toToolError(store.listStatuses(spaceId));
      const status = statuses.find((candidate) => candidate.category === category);
      if (status === undefined) {
        return yield* fail(`this space has no status in category "${category}"`);
      }
      return status;
    });

    const actor = actorService.resolve;

    return {
      ml_list_ready: Effect.fnUntraced(function* (input) {
        const spaceId =
          input.space === undefined ? undefined : (yield* resolveSpace(input.space)).id;
        const issues = yield* toToolError(store.listReadyIssues(spaceId));
        return { issues: issues.map(cardOf) };
      }),

      ml_get_issue: Effect.fnUntraced(function* (input) {
        const issueId = yield* resolveIssue(input.id);
        const detail = yield* toToolError(store.getIssue(issueId));
        return {
          id: detail.shortId,
          title: detail.issue.title,
          description: detail.issue.description,
          space: detail.space.key,
          status: detail.status.name,
          category: detail.status.category,
          priority: detail.issue.priority,
          type: detail.issue.type,
          labels: detail.labels.map((label) => label.name),
          agent_blocked: detail.issue.agentBlocked,
          pending_duplicate: detail.issue.pendingDuplicateStatusId !== null,
          relations: detail.relations.map((relation) => ({
            kind: relation.outgoing ? relation.kind : `${relation.kind} (inverse)`,
            issue: relation.otherShortId,
            title: relation.otherTitle,
            category: relation.otherCategory,
          })),
          comments: detail.comments.slice(-20).map((comment) => ({
            author: `${comment.actor.kind}:${comment.actor.id}`,
            body: comment.body,
            at: comment.createdAt,
          })),
          proofs_attached: detail.proofs.length,
        };
      }),

      ml_comment: Effect.fnUntraced(function* (input) {
        const issueId = yield* resolveIssue(input.id);
        const commentId = (yield* nextId) as CommentId;
        yield* toToolError(
          store.execute(
            { type: "comment.add", commentId, issueId, body: input.body },
            yield* actor,
          ),
        );
        return { ok: true as const };
      }),

      ml_transition: Effect.fnUntraced(function* (input) {
        const issueId = yield* resolveIssue(input.id);
        const detail = yield* toToolError(store.getIssue(issueId));
        const status = yield* statusFor(detail.issue.spaceId, input.to_status);
        const events = yield* toToolError(
          store.execute({ type: "status.change", issueId, statusId: status.id }, yield* actor),
        );
        const proposed = events.some((event) => event.type === "duplicate.proposed");
        return {
          id: detail.shortId,
          result: proposed ? ("duplicate_proposed" as const) : ("transitioned" as const),
          category: input.to_status,
        };
      }),

      ml_create_issue: Effect.fnUntraced(function* (input) {
        const space = yield* resolveSpace(input.space);
        const discoveredFrom =
          input.discovered_from === undefined
            ? undefined
            : yield* resolveIssue(input.discovered_from);
        const issueId = (yield* nextId) as IssueId;
        const who = yield* actor;
        yield* toToolError(
          store.execute(
            {
              type: "issue.create",
              issueId,
              spaceId: space.id,
              title: input.title,
              description: input.body ?? "",
              priority: 0,
              issueType: input.type ?? "work",
              labelIds: [],
            },
            who,
          ),
        );
        if (discoveredFrom !== undefined) {
          const relationId = (yield* nextId) as RelationId;
          yield* toToolError(
            store.execute(
              {
                type: "relation.add",
                relationId,
                issueId,
                kind: "discovered_from",
                targetId: discoveredFrom,
              },
              who,
            ),
          );
        }
        const detail = yield* toToolError(store.getIssue(issueId));
        return { id: detail.shortId };
      }),

      ml_attach_proof: Effect.fnUntraced(function* (input) {
        const issueId = yield* resolveIssue(input.id);
        const proof = yield* decodeProof({
          summary: input.proof.summary,
          notDone: input.proof.not_done ?? [],
          ...(input.proof.diff_stat === undefined
            ? {}
            : {
                diffStat: {
                  filesChanged: input.proof.diff_stat.files_changed,
                  insertions: input.proof.diff_stat.insertions,
                  deletions: input.proof.diff_stat.deletions,
                },
              }),
          tests: input.proof.tests ?? [],
          risks: input.proof.risks ?? [],
          followupsFiled: input.proof.followups_filed ?? [],
          ...(input.proof.cost === undefined
            ? {}
            : {
                cost: {
                  ...(input.proof.cost.tokens === undefined
                    ? {}
                    : { tokens: input.proof.cost.tokens }),
                  ...(input.proof.cost.currency_amount === undefined
                    ? {}
                    : { currencyAmount: input.proof.cost.currency_amount }),
                  ...(input.proof.cost.note === undefined ? {} : { note: input.proof.cost.note }),
                },
              }),
        }).pipe(Effect.mapError((error) => mlToolError(String(error))));
        const proofId = (yield* nextId) as ProofId;
        yield* toToolError(
          store.execute({ type: "proof.attach", proofId, issueId, proof }, yield* actor),
        );
        return { ok: true as const };
      }),

      ml_request_input: Effect.fnUntraced(function* (input) {
        const issueId = yield* resolveIssue(input.id);
        const commentId = (yield* nextId) as CommentId;
        yield* toToolError(
          store.execute(
            { type: "input.request", issueId, commentId, question: input.question },
            yield* actor,
          ),
        );
        return { ok: true as const };
      }),

      ml_log_cost: Effect.fnUntraced(function* (input) {
        const issueId = yield* resolveIssue(input.id);
        yield* toToolError(
          store.execute(
            {
              type: "cost.log",
              issueId,
              ...(input.tokens === undefined ? {} : { tokens: input.tokens }),
              ...(input.currency_amount === undefined
                ? {}
                : { currencyAmount: input.currency_amount }),
              ...(input.note === undefined ? {} : { note: input.note }),
            },
            yield* actor,
          ),
        );
        return { ok: true as const };
      }),
    };
  }),
);
