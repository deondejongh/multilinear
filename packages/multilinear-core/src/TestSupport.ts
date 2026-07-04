/**
 * Shared test fixture for store-level tests. Not part of the package's
 * public exports — imported by `*.test.ts` files only.
 */
import * as Effect from "effect/Effect";

import type { TrackerCommand } from "./Commands.ts";
import type { Actor, IssueId, SpaceId, StatusCategory, StatusId } from "./Model.ts";
import { TrackerStore } from "./Store.ts";
import { makeUlidGenerator } from "./Ulid.ts";

export const human: Actor = { kind: "human", id: "deon" };
export const agent: Actor = { kind: "agent", id: "codex-profile" };

/** Deterministic caller-side id factory (ids are ULIDs, unique per call). */
export const makeIds = () => {
  let counter = 0;
  const generator = makeUlidGenerator((bytes) => {
    counter += 1;
    bytes.fill(0);
    bytes[8] = Math.floor(counter / 256);
    bytes[9] = counter % 256;
  });
  return { next: () => generator.next(1_700_000_000_000) };
};

export interface Fixture {
  readonly store: TrackerStore["Service"];
  readonly ids: ReturnType<typeof makeIds>;
  readonly spaceId: SpaceId;
  readonly triageStatusId: StatusId;
  readonly statusIdFor: (category: StatusCategory) => StatusId;
}

/** Create a store with one space (statuses seeded 1:1 with categories). */
export const setup = Effect.fnUntraced(function* () {
  const store = yield* TrackerStore;
  const ids = makeIds();
  const spaceId = ids.next() as SpaceId;
  yield* store.execute({ type: "space.create", spaceId, name: "Multilinear", key: "MLT" }, human);
  const statuses = yield* store.listStatuses(spaceId);
  const statusIdFor = (category: StatusCategory): StatusId => {
    const status = statuses.find((candidate) => candidate.category === category);
    if (status === undefined) throw new Error(`no status for category ${category}`);
    return status.id;
  };
  return {
    store,
    ids,
    spaceId,
    triageStatusId: statusIdFor("triage"),
    statusIdFor,
  } satisfies Fixture;
});

export const createIssue = (
  fixture: Fixture,
  overrides?: Partial<Extract<TrackerCommand, { type: "issue.create" }>>,
) => {
  const issueId = fixture.ids.next() as IssueId;
  return fixture.store
    .execute(
      {
        type: "issue.create",
        issueId,
        spaceId: fixture.spaceId,
        title: "An issue",
        description: "",
        priority: 0,
        issueType: "work",
        labelIds: [],
        ...overrides,
      },
      human,
    )
    .pipe(Effect.map(() => issueId));
};

export const provided = <A, E>(effect: Effect.Effect<A, E, TrackerStore>) =>
  effect.pipe(Effect.provide(TrackerStore.layerMemory));
