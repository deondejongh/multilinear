// @effect-diagnostics nodeBuiltinImport:off globalDate:off
/**
 * Projection-schema migration: a store whose `PRAGMA user_version` predates
 * the current build drops its projection tables and replays the event log on
 * open (projections are disposable; events are the source of truth).
 */
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeSqlite from "node:sqlite";

import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { TrackerStore } from "./Store.ts";
import { createIssue, setup } from "./TestSupport.ts";

// Computed outside Effect code: uniqueness per test process is all we need.
const dbPath = NodePath.join(
  NodeOS.tmpdir(),
  `multilinear-migration-test-${process.pid}-${Date.now()}.db`,
);
const driftDbPath = NodePath.join(
  NodeOS.tmpdir(),
  `multilinear-migration-drift-test-${process.pid}-${Date.now()}.db`,
);

describe("projection-schema migration", () => {
  it.effect("an outdated user_version triggers a full projection replay", () =>
    Effect.gen(function* () {
      // Populate a store, remembering what its projections look like.
      const before = yield* Effect.gen(function* () {
        const fixture = yield* setup();
        yield* createIssue(fixture, { title: "Survives migration" });
        return yield* fixture.store.dumpProjections();
      }).pipe(Effect.provide(TrackerStore.layer({ dbPath })), Effect.scoped);

      // Simulate an old build's on-disk state: stale version marker and a
      // projection shape that has drifted from the event log.
      const raw = new NodeSqlite.DatabaseSync(dbPath);
      raw.exec("PRAGMA user_version = 0");
      raw.exec("DELETE FROM issues");
      raw.exec("ALTER TABLE issues DROP COLUMN agent_blocked");
      raw.close();

      // Re-opening migrates: tables are rebuilt from events.
      const after = yield* Effect.gen(function* () {
        const store = yield* TrackerStore;
        return yield* store.dumpProjections();
      }).pipe(Effect.provide(TrackerStore.layer({ dbPath })), Effect.scoped);

      assert.deepStrictEqual(after, before);

      const versioned = new NodeSqlite.DatabaseSync(dbPath);
      const version = versioned.prepare("PRAGMA user_version").get() as {
        user_version: number;
      };
      versioned.close();
      assert.isAbove(version.user_version, 0);
    }),
  );

  it.effect("shape drift is healed on open even when user_version is current", () =>
    Effect.gen(function* () {
      // A concurrent old-code process can recreate a projection table with a
      // stale shape between a migration's DROP and CREATE (its open-time
      // `CREATE TABLE IF NOT EXISTS`), leaving the version marker current
      // but a column missing — seen live with `spaces.repo_paths` (MLT-47).
      const before = yield* Effect.gen(function* () {
        const fixture = yield* setup();
        yield* fixture.store.execute(
          { type: "space.update", spaceId: fixture.spaceId, repoPaths: ["/repos/multilinear"] },
          { kind: "human", id: "test" },
        );
        return yield* fixture.store.dumpProjections();
      }).pipe(Effect.provide(TrackerStore.layer({ dbPath: driftDbPath })), Effect.scoped);

      // Old shape, current version — exactly the corrupted live state.
      const raw = new NodeSqlite.DatabaseSync(driftDbPath);
      raw.exec("DROP TABLE spaces");
      raw.exec(
        "CREATE TABLE spaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL)",
      );
      raw.close();

      const after = yield* Effect.gen(function* () {
        const store = yield* TrackerStore;
        return yield* store.dumpProjections();
      }).pipe(Effect.provide(TrackerStore.layer({ dbPath: driftDbPath })), Effect.scoped);

      assert.deepStrictEqual(after, before);
    }),
  );
});
