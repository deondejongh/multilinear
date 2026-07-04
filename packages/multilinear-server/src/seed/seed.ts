/**
 * Phase 1 seed (02-PHASE-1 §E, the dogfood moment): imports the
 * `06-FUTURE-IDEAS.md` parking lot and the upcoming phases' open items as
 * issues in the `multilinear` space, so the project's backlog lives in the
 * project from day one.
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import type { TrackerCommand } from "@multilinear/core/commands";
import type {
  Actor,
  IssueId,
  LabelId,
  SpaceId,
  StatusCategory,
  StatusId,
} from "@multilinear/core/model";
import { TrackerStore } from "@multilinear/core/store";
import { makeUlidGenerator } from "@multilinear/core/ulid";

import { parseFutureIdeas, type FutureIdeaSection } from "./parseFutureIdeas.ts";

export class SeedAbortedError extends Schema.TaggedErrorClass<SeedAbortedError>()(
  "SeedAbortedError",
  {
    reason: Schema.String,
  },
) {
  override get message(): string {
    return `Seed aborted: ${this.reason}`;
  }
}

const SEED_ACTOR: Actor = { kind: "system", id: "phase1-seed" };

const IDEA_LABELS: Record<FutureIdeaSection, { name: string; color: string }> = {
  near: { name: "near", color: "#5e6ad2" },
  later: { name: "later", color: "#8b5cf6" },
  "team-edition": { name: "team-edition", color: "#64748b" },
};

const PHASE_LABEL = { name: "phase", color: "#059669" };
const DECISIONS_LABEL = { name: "decisions", color: "#eab308" };

const provenance = (source: string): string =>
  `\n\n—\nImported from \`${source}\` by the Phase 1 seed script.`;

export interface SeedSummary {
  readonly spaceId: SpaceId;
  readonly issues: number;
}

/** Seed the real backlog. Refuses to run twice (space key must be free). */
export const runSeed = Effect.fnUntraced(function* (options: {
  readonly futureIdeasMarkdown: string;
}) {
  const store = yield* TrackerStore;
  const nowMs = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
  const ulid = makeUlidGenerator((bytes) =>
    globalThis.crypto.getRandomValues(bytes as Uint8Array<ArrayBuffer>),
  );
  const nextId = <Id extends string>(): Id => ulid.next(nowMs) as Id;

  const existing = yield* store.listSpaces();
  if (existing.some((space) => space.key === "MLT")) {
    return yield* new SeedAbortedError({
      reason: "space MLT already exists — the backlog has already been seeded",
    });
  }

  const run = (command: TrackerCommand) => store.execute(command, SEED_ACTOR);

  const spaceId = nextId<SpaceId>();
  yield* run({ type: "space.create", spaceId, name: "multilinear", key: "MLT" });

  const statuses = yield* store.listStatuses(spaceId);
  const statusId = (category: StatusCategory): StatusId => {
    const status = statuses.find((candidate) => candidate.category === category);
    if (status === undefined) throw new Error(`seeded space missing category ${category}`);
    return status.id;
  };

  const labelIds = new Map<string, LabelId>();
  for (const label of [...Object.values(IDEA_LABELS), PHASE_LABEL, DECISIONS_LABEL]) {
    const labelId = nextId<LabelId>();
    yield* run({ type: "label.create", labelId, spaceId, name: label.name, color: label.color });
    labelIds.set(label.name, labelId);
  }

  let issueCount = 0;
  const createIssue = Effect.fnUntraced(function* (draft: {
    readonly title: string;
    readonly description: string;
    readonly category: StatusCategory;
    readonly priority: 0 | 1 | 2 | 3 | 4;
    readonly issueType: "work" | "idea" | "spike" | "config";
    readonly labels: ReadonlyArray<string>;
  }) {
    const issueId = nextId<IssueId>();
    yield* run({
      type: "issue.create",
      issueId,
      spaceId,
      title: draft.title,
      description: draft.description,
      priority: draft.priority,
      issueType: draft.issueType,
      statusId: statusId(draft.category),
      labelIds: draft.labels.flatMap((name) => {
        const labelId = labelIds.get(name);
        return labelId === undefined ? [] : [labelId];
      }),
    });
    issueCount += 1;
    return issueId;
  });

  // 1. The parking lot: every future idea, as an idea-typed backlog issue.
  const ideas = parseFutureIdeas(options.futureIdeasMarkdown);
  if (ideas.length < 20) {
    return yield* new SeedAbortedError({
      reason: `06-FUTURE-IDEAS.md parsed into only ${ideas.length} ideas — parser drift?`,
    });
  }
  for (const idea of ideas) {
    yield* createIssue({
      title: idea.title,
      description: idea.body + provenance("multilinear-plan/06-FUTURE-IDEAS.md"),
      category: "backlog",
      priority: idea.section === "near" ? 3 : 4,
      issueType: "idea",
      labels: [IDEA_LABELS[idea.section].name],
    });
  }

  // 2. The phase plan: upcoming phases as work issues, dependency-chained.
  const phase2 = yield* createIssue({
    title: "Phase 2 — agent hands: MCP server, transition whitelist, proof-of-work",
    description:
      "Make agents citizens of the board: the multilinear MCP server (standalone stdio entry point included), the transition whitelist enforced server-side with tests, proof-of-work v0, workflow profiles v0, the Ready gate lint, Agent Blocked state, context pack v2, secret-pattern scan. Spec: `multilinear-plan/03-PHASE-2-AGENT-HANDS.md`; kickoff prompt in `PROMPTS.md`." +
      provenance("multilinear-plan/03-PHASE-2-AGENT-HANDS.md"),
    category: "ready",
    priority: 1,
    issueType: "work",
    labels: [PHASE_LABEL.name],
  });
  const phase3 = yield* createIssue({
    title: "Phase 3 — policy brain: dispatcher, caps, reconciliation",
    description:
      "Dispatch through upstream's orchestrator MCP via the adapter: claim → context pack → dispatch → run link; completion loop with watchdog and single retry; caps and budgets; DAG auto-flow; estimates-vs-actuals; weekly upstream-recon janitor. **Gated on upstream PR #2829 landing in main** (check at session start). Spec: `multilinear-plan/04-PHASE-3-POLICY-BRAIN.md`." +
      provenance("multilinear-plan/04-PHASE-3-POLICY-BRAIN.md"),
    category: "backlog",
    priority: 2,
    issueType: "work",
    labels: [PHASE_LABEL.name],
  });
  const phase4 = yield* createIssue({
    title: "Phase 4 — rules and the world",
    description:
      "Four independently shippable workstreams (see child issues): rules engine with back-testing, GitHub sync, idea-issues, configurer. Spec: `multilinear-plan/05-PHASE-4-RULES-AND-WORLD.md`." +
      provenance("multilinear-plan/05-PHASE-4-RULES-AND-WORLD.md"),
    category: "backlog",
    priority: 3,
    issueType: "work",
    labels: [PHASE_LABEL.name],
  });
  yield* run({
    type: "relation.add",
    relationId: nextId(),
    issueId: phase3,
    kind: "blocked_by",
    targetId: phase2,
  });
  yield* run({
    type: "relation.add",
    relationId: nextId(),
    issueId: phase4,
    kind: "blocked_by",
    targetId: phase3,
  });

  const workstreams: ReadonlyArray<{ title: string; description: string }> = [
    {
      title: "Phase 4a — rules engine (event-triggered, back-testable)",
      description:
        "Rules bind to categories/labels (never status names); causation loop-guard, cooldowns, budgets, kill switch, dry-run; back-testing against the event log is the star feature. Starter rules ship disabled.",
    },
    {
      title: "Phase 4b — GitHub sync (three narrow one-directional flows)",
      description:
        "Polling only; the tracker is the boss; nothing ever posts publicly. External-origin issues are untrusted input, enforced server-side with tests.",
    },
    {
      title: "Phase 4c — idea-issues (the type exists, build the behavior)",
      description:
        "Idea-typed issues get discussion-first flow before graduating to work. See spec for the elicitation loop.",
    },
    {
      title: "Phase 4d — configurer agent (config is files)",
      description:
        "Schema-validated workspace config editable by a configurer agent through conversation; UI-editor-over-files principle.",
    },
  ];
  for (const workstream of workstreams) {
    const child = yield* createIssue({
      title: workstream.title,
      description:
        workstream.description + provenance("multilinear-plan/05-PHASE-4-RULES-AND-WORLD.md"),
      category: "backlog",
      priority: 3,
      issueType: "work",
      labels: [PHASE_LABEL.name],
    });
    yield* run({
      type: "relation.add",
      relationId: nextId(),
      issueId: child,
      kind: "parent",
      targetId: phase4,
    });
  }

  // 3. Open decisions that need a human.
  yield* createIssue({
    title: "Decide the license (STATUS D2)",
    description:
      "Leaning MIT (matches upstream, maximizes adoption); AGPL considered to deter cloud clones. Decide before first outside contribution." +
      provenance("multilinear-plan/STATUS.md"),
    category: "triage",
    priority: 3,
    issueType: "config",
    labels: [DECISIONS_LABEL.name],
  });

  return { spaceId, issues: issueCount } satisfies SeedSummary;
});

/** Synthetic issues in a SANDBOX space — for the 200-issue jank check. */
export const runSyntheticSeed = Effect.fnUntraced(function* (count: number) {
  const store = yield* TrackerStore;
  const nowMs = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
  const ulid = makeUlidGenerator((bytes) =>
    globalThis.crypto.getRandomValues(bytes as Uint8Array<ArrayBuffer>),
  );
  const nextId = <Id extends string>(): Id => ulid.next(nowMs) as Id;
  const run = (command: TrackerCommand) => store.execute(command, SEED_ACTOR);

  const existing = yield* store.listSpaces();
  if (existing.some((space) => space.key === "SBX")) {
    return yield* new SeedAbortedError({ reason: "space SBX already exists" });
  }
  const spaceId = nextId<SpaceId>();
  yield* run({ type: "space.create", spaceId, name: "Sandbox", key: "SBX" });
  const statuses = yield* store.listStatuses(spaceId);
  const labelIds: LabelId[] = [];
  for (const [index, color] of ["#ef4444", "#22c55e", "#3b82f6", "#f59e0b"].entries()) {
    const labelId = nextId<LabelId>();
    yield* run({
      type: "label.create",
      labelId,
      spaceId,
      name: `synthetic-${index}`,
      color,
    });
    labelIds.push(labelId);
  }
  const categories: ReadonlyArray<StatusCategory> = [
    "triage",
    "backlog",
    "ready",
    "in_progress",
    "needs_review",
  ];
  for (let index = 0; index < count; index++) {
    const category = categories[index % categories.length] ?? "backlog";
    const status = statuses.find((candidate) => candidate.category === category);
    yield* run({
      type: "issue.create",
      issueId: nextId(),
      spaceId,
      title: `Synthetic issue ${index + 1} — board latency probe with a realistically long title`,
      description: `Synthetic issue #${index + 1} for the 200-issue jank check.`,
      priority: (index % 5) as 0 | 1 | 2 | 3 | 4,
      issueType: "work",
      ...(status !== undefined ? { statusId: status.id } : {}),
      labelIds: index % 3 === 0 ? [labelIds[index % labelIds.length] ?? []].flat() : [],
    });
  }
  return { spaceId, issues: count } satisfies SeedSummary;
});
