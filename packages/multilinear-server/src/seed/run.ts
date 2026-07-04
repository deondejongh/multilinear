// @effect-diagnostics nodeBuiltinImport:off
/**
 * Seed entry point (02-PHASE-1 §E). Run from the repo root:
 *
 *   node packages/multilinear-server/src/seed/run.ts
 *
 * Env:
 *   MULTILINEAR_DB_PATH        override the DB (default ~/.multilinear/tracker.db)
 *   MULTILINEAR_SEED_SYNTHETIC seed N synthetic issues into a SANDBOX space
 *                              instead of the real backlog (jank testing)
 */
import * as NodeOS from "node:os";

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { TrackerStore } from "@multilinear/core/store";

import { runSeed, runSyntheticSeed } from "./seed.ts";

const program = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const dbOverride = yield* Config.string("MULTILINEAR_DB_PATH").pipe(Config.withDefault(""));
  const dbPath =
    dbOverride.trim() !== ""
      ? dbOverride
      : path.join(NodeOS.homedir(), ".multilinear", "tracker.db");
  yield* fileSystem.makeDirectory(path.dirname(dbPath), { recursive: true });

  const synthetic = yield* Config.string("MULTILINEAR_SEED_SYNTHETIC").pipe(Config.withDefault(""));

  const seed = Effect.gen(function* () {
    if (synthetic.trim() !== "") {
      const count = Number.parseInt(synthetic, 10);
      const summary = yield* runSyntheticSeed(count);
      yield* Console.log(`Seeded ${summary.issues} synthetic issues into SBX (db: ${dbPath})`);
      return;
    }
    const futureIdeasPath = path.resolve("multilinear-plan/06-FUTURE-IDEAS.md");
    const markdown = yield* fileSystem.readFileString(futureIdeasPath);
    const summary = yield* runSeed({ futureIdeasMarkdown: markdown });
    yield* Console.log(
      `Seeded the multilinear backlog: ${summary.issues} issues in space MLT (db: ${dbPath})`,
    );
  });

  yield* seed.pipe(Effect.provide(TrackerStore.layer({ dbPath })));
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
