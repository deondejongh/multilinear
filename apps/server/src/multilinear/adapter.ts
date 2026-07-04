// @effect-diagnostics nodeBuiltinImport:off
/**
 * The single multilinear ↔ t3code adapter module (01-ARCHITECTURE §1.3,
 * STATUS D14). Nothing else of ours may import t3code internals; when
 * upstream renames something, this is the one file to fix.
 *
 * Wires three things into the upstream server:
 * - the `/api/multilinear` routes (packages/multilinear-server), authed with
 *   `EnvironmentAuth` — human actor;
 * - the multilinear MCP toolkit onto upstream's `/mcp` server, so every
 *   t3code agent session is a citizen of the board — agent actor derived
 *   from the session's `McpInvocationContext`;
 * - the workflow-profile loader (`.multilinear/profiles/`, found by walking
 *   up from the server's cwd; `MULTILINEAR_PROFILES_DIR` overrides).
 *
 * Data lives at `~/.multilinear/tracker.db` (STATUS D3 — outside upstream's
 * state dirs). The routes and the MCP registration each hold a SQLite
 * connection; WAL makes that safe (the standalone stdio server is a third).
 */
import * as NodeOS from "node:os";

import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { McpServer } from "effect/unstable/ai";
import { HttpServerRequest } from "effect/unstable/http";

import { AuthOrchestrationOperateScope, AuthOrchestrationReadScope } from "@t3tools/contracts";
import type { Actor } from "@multilinear/core/model";
import { TrackerStore } from "@multilinear/core/store";
import { resolveMultilinearDbPath } from "@multilinear/server/db-path";
import {
  MultilinearMcpActor,
  MultilinearToolkit,
  MultilinearToolkitHandlersLive,
} from "@multilinear/server/mcp";
import { ProfileLoader } from "@multilinear/server/profiles";
import {
  makeMultilinearRoutesLayer,
  MultilinearAuth,
  MultilinearHttpError,
} from "@multilinear/server/router";

import * as McpInvocationContext from "../mcp/McpInvocationContext.ts";
import * as EnvironmentAuth from "../auth/EnvironmentAuth.ts";

export { resolveMultilinearDbPath };

/**
 * Locate `.multilinear/profiles`: explicit override, else walk up from cwd
 * (the server usually runs in `apps/server`; the profiles live at repo root).
 */
const resolveProfilesDir = Effect.fnUntraced(function* () {
  const path = yield* Path.Path;
  const fileSystem = yield* FileSystem.FileSystem;
  const override = yield* Config.string("MULTILINEAR_PROFILES_DIR").pipe(Config.withDefault(""));
  if (override.trim() !== "") return override;
  let current = path.resolve(process.cwd());
  while (true) {
    const candidate = path.join(current, ".multilinear", "profiles");
    if (yield* fileSystem.exists(candidate).pipe(Effect.orElseSucceed(() => false))) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) return path.join(process.cwd(), ".multilinear", "profiles");
    current = parent;
  }
});

const trackerStoreLayer = Layer.unwrap(
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const dbPath = yield* resolveMultilinearDbPath();
    yield* fileSystem.makeDirectory(path.dirname(dbPath), { recursive: true });
    return TrackerStore.layer({ dbPath });
  }),
);

const multilinearAuthLayer = Layer.effect(
  MultilinearAuth,
  Effect.gen(function* () {
    const serverAuth = yield* EnvironmentAuth.EnvironmentAuth;
    // Single-user: every authenticated HTTP session acts as the human.
    const actor: Actor = { kind: "human", id: NodeOS.userInfo().username || "local" };
    return MultilinearAuth.of({
      authorize: (access) =>
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const session = yield* serverAuth
            .authenticateHttpRequest(request)
            .pipe(
              Effect.mapError(
                () => new MultilinearHttpError({ status: 401, body: "Unauthorized" }),
              ),
            );
          const scope =
            access === "operate" ? AuthOrchestrationOperateScope : AuthOrchestrationReadScope;
          if (!session.scopes.includes(scope)) {
            return yield* new MultilinearHttpError({ status: 403, body: "Forbidden" });
          }
          return actor;
        }),
    });
  }),
);

const profileLoaderLayer = Layer.unwrap(
  Effect.gen(function* () {
    const directory = yield* resolveProfilesDir();
    return ProfileLoader.layer({ directory });
  }),
);

/** Registered in `server.ts` `makeRoutesLayer` — mount point, see MOUNTPOINTS.md. */
export const multilinearRouteLayer = Layer.unwrap(
  Effect.gen(function* () {
    // Built once, scoped to this layer's lifetime (DB closes on shutdown).
    const services = yield* Layer.build(
      Layer.mergeAll(trackerStoreLayer, multilinearAuthLayer, profileLoaderLayer),
    );
    return makeMultilinearRoutesLayer(services);
  }),
);

/**
 * Agent identity for tool calls arriving through upstream's `/mcp` server:
 * the per-session bearer credential resolves to an `McpInvocationContext`,
 * and the thread id becomes the recorded actor (03-PHASE-2 §A).
 */
const hostedActorLayer = Layer.succeed(MultilinearMcpActor, {
  resolve: Effect.withFiber((fiber) => {
    const scope = Context.getOption(fiber.context, McpInvocationContext.McpInvocationContext);
    const actor: Actor =
      scope._tag === "Some"
        ? { kind: "agent", id: `t3code:thread/${scope.value.threadId}` }
        : { kind: "agent", id: "t3code:unknown-session" };
    return Effect.succeed(actor);
  }),
});

/**
 * Registers the `ml_*` toolkit on upstream's MCP server. Composed next to
 * upstream's own toolkits in `McpHttpServer.ts` — mount point, see
 * MOUNTPOINTS.md.
 */
export const multilinearMcpLayer = McpServer.toolkit(MultilinearToolkit).pipe(
  Layer.provide(MultilinearToolkitHandlersLive),
  Layer.provide(trackerStoreLayer),
  Layer.provide(hostedActorLayer),
);
