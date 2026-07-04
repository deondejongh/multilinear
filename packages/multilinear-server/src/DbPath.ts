// @effect-diagnostics nodeBuiltinImport:off
/**
 * Where the tracker database lives (STATUS D3): `~/.multilinear/tracker.db`,
 * outside upstream's state dirs, overridable with `MULTILINEAR_DB_PATH` for
 * tests and sandboxing. Shared by the t3code adapter and the standalone MCP
 * stdio entry point — both open the same file (WAL handles the sharing).
 */
import * as NodeOS from "node:os";

import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";

export const resolveMultilinearDbPath = Effect.fnUntraced(function* () {
  const path = yield* Path.Path;
  const override = yield* Config.string("MULTILINEAR_DB_PATH").pipe(Config.withDefault(""));
  if (override.trim() !== "") {
    return override;
  }
  return path.join(NodeOS.homedir(), ".multilinear", "tracker.db");
});
