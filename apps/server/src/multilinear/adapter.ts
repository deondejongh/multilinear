// @effect-diagnostics nodeBuiltinImport:off
/**
 * The single multilinear ↔ t3code adapter module (01-ARCHITECTURE §1.3,
 * STATUS D14). Nothing else of ours may import t3code internals; when
 * upstream renames something, this is the one file to fix.
 *
 * Wires the `/api/multilinear` routes (packages/multilinear-server) into the
 * upstream server: authenticates requests with `EnvironmentAuth` (same
 * pattern as the raw routes in ../http.ts) and hosts the tracker store at
 * `~/.multilinear/tracker.db` (STATUS D3 — outside upstream's state dirs).
 */
import * as NodeOS from "node:os";

import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { HttpServerRequest } from "effect/unstable/http";

import { AuthOrchestrationOperateScope, AuthOrchestrationReadScope } from "@t3tools/contracts";
import type { Actor } from "@multilinear/core/model";
import { TrackerStore } from "@multilinear/core/store";
import {
  makeMultilinearRoutesLayer,
  MultilinearAuth,
  MultilinearHttpError,
} from "@multilinear/server/router";

import * as EnvironmentAuth from "../auth/EnvironmentAuth.ts";

export const resolveMultilinearDbPath = Effect.fnUntraced(function* () {
  const path = yield* Path.Path;
  return path.join(NodeOS.homedir(), ".multilinear", "tracker.db");
});

const multilinearAuthLayer = Layer.effect(
  MultilinearAuth,
  Effect.gen(function* () {
    const serverAuth = yield* EnvironmentAuth.EnvironmentAuth;
    // Phase 1 is single-user: every authenticated session acts as the human.
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

/** Registered in `server.ts` `makeRoutesLayer` — mount point, see MOUNTPOINTS.md. */
export const multilinearRouteLayer = Layer.unwrap(
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const dbPath = yield* resolveMultilinearDbPath();
    yield* fileSystem.makeDirectory(path.dirname(dbPath), { recursive: true });
    // Built once, scoped to this layer's lifetime (DB closes on shutdown).
    const services = yield* Layer.build(
      Layer.mergeAll(TrackerStore.layer({ dbPath }), multilinearAuthLayer),
    );
    return makeMultilinearRoutesLayer(services);
  }),
);
