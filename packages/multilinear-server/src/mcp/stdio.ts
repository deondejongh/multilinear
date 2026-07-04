// @effect-diagnostics nodeBuiltinImport:off
/**
 * Standalone multilinear MCP server over stdio — the universal adapter
 * (03-PHASE-2 §A, first-class). Lets a raw `claude` / `codex` session in any
 * repo work the board:
 *
 *   claude mcp add multilinear -- node --experimental-transform-types \
 *     <this repo>/packages/multilinear-server/src/mcp/stdio.ts
 *
 * Identity: every mutating call records `actor.kind = "agent"` with id from
 * `MULTILINEAR_ACTOR` (e.g. `claude-code:deon`), defaulting to
 * `stdio:<os user>`. Data: the shared tracker DB (`MULTILINEAR_DB_PATH`
 * override honored; WAL handles cross-process sharing with the t3code
 * server). Logs go to stderr — stdout carries the protocol.
 */
import * as NodeOS from "node:os";

import { NodeFileSystem, NodePath, NodeRuntime, NodeStdio } from "@effect/platform-node";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Path from "effect/Path";
import { McpServer } from "effect/unstable/ai";

import type { Actor } from "@multilinear/core/model";
import { TrackerStore } from "@multilinear/core/store";

import { resolveMultilinearDbPath } from "../DbPath.ts";
import {
  MultilinearMcpActor,
  MultilinearToolkit,
  MultilinearToolkitHandlersLive,
} from "./Toolkit.ts";

const platform = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const registration = Layer.unwrap(
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const dbPath = yield* resolveMultilinearDbPath();
    yield* fileSystem
      .makeDirectory(path.dirname(dbPath), { recursive: true })
      .pipe(Effect.orElseSucceed(() => undefined));

    const actorId = yield* Config.string("MULTILINEAR_ACTOR").pipe(
      Config.withDefault(`stdio:${NodeOS.userInfo().username || "unknown"}`),
    );
    const actor: Actor = { kind: "agent", id: actorId };

    return McpServer.toolkit(MultilinearToolkit).pipe(
      Layer.provide(MultilinearToolkitHandlersLive),
      Layer.provide(TrackerStore.layer({ dbPath })),
      Layer.provide(MultilinearMcpActor.layerStatic(actor)),
    );
  }),
);

const main = registration.pipe(
  Layer.provide(McpServer.layerStdio({ name: "multilinear", version: "0.1.0" })),
  Layer.provide(NodeStdio.layer),
  Layer.provide(platform),
  // stdout is the JSON-RPC channel; all logging must go to stderr.
  Layer.provide(Layer.succeed(Logger.LogToStderr)(true)),
);

NodeRuntime.runMain(Layer.launch(main));
