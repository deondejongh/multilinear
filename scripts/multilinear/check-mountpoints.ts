/**
 * Merge-guard check for MOUNTPOINTS.md (multilinear fork hygiene).
 *
 * Parses the mount-point table at the repo root and fails if any entry
 * references a file, line range, or anchor substring that no longer exists —
 * the signal that an upstream merge broke a registered mount point.
 *
 * Run as `node scripts/multilinear/check-mountpoints.ts` (CI: the merge-guard
 * workflow). Parsing and verification are pure; only `main` touches the disk.
 */
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

export class MountpointCheckError extends Schema.TaggedErrorClass<MountpointCheckError>()(
  "MountpointCheckError",
  {
    failureCount: Schema.Int,
    total: Schema.Int,
  },
) {
  override get message(): string {
    return `MOUNTPOINTS.md references stale files or anchors (${this.failureCount} of ${this.total}).`;
  }
}

export interface MountPoint {
  readonly file: string;
  readonly ref: string;
  readonly purpose: string;
  readonly date: string;
}

const stripBackticks = (cell: string): string => cell.replace(/^`([\s\S]*)`$/, "$1").trim();

/** Extracts data rows from the first markdown table in the document. */
export function parseMountpoints(markdown: string): MountPoint[] {
  const rows = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));
  // rows[0] is the header, rows[1] the separator; the rest are entries.
  return rows.slice(2).map((row) => {
    const cells = row
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    return {
      file: stripBackticks(cells[0] ?? ""),
      ref: cells[1] ?? "",
      purpose: cells[2] ?? "",
      date: cells[3] ?? "",
    };
  });
}

/**
 * Returns a failure reason, or null if the mount point still resolves.
 * `content` is the target file's text, or null if the file does not exist.
 */
export function verifyMountpoint(mountPoint: MountPoint, content: string | null): string | null {
  if (content === null) {
    return `file not found: ${mountPoint.file}`;
  }

  const ref = mountPoint.ref;
  if (ref === "" || ref === "—" || ref === "-") {
    return null;
  }

  const lineRange = /^(\d+)(?:-(\d+))?$/.exec(ref);
  if (lineRange !== null) {
    const last = Number(lineRange[2] ?? lineRange[1]);
    const lineCount = content.split("\n").length;
    return last <= lineCount
      ? null
      : `${mountPoint.file} has ${lineCount} lines, mount point expects line ${last}`;
  }

  const anchor = /^`([\s\S]+)`$/.exec(ref);
  if (anchor !== null) {
    const anchorText = anchor[1] ?? "";
    return content.includes(anchorText)
      ? null
      : `anchor not found in ${mountPoint.file}: ${anchorText}`;
  }

  return `unrecognized reference format for ${mountPoint.file}: "${ref}" (use line numbers, a backtick-quoted anchor, or —)`;
}

const checkMountpoints = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = path.resolve(import.meta.dirname, "..", "..");
  const manifest = yield* fs.readFileString(path.join(repoRoot, "MOUNTPOINTS.md"));
  const mountPoints = parseMountpoints(manifest);

  const failures: string[] = [];
  for (const mountPoint of mountPoints) {
    const absolute = path.join(repoRoot, mountPoint.file);
    const content = (yield* fs.exists(absolute)) ? yield* fs.readFileString(absolute) : null;
    const reason = verifyMountpoint(mountPoint, content);
    if (reason !== null) {
      failures.push(reason);
    }
  }

  if (failures.length > 0) {
    yield* Console.error(
      `MOUNTPOINTS.md check failed (${failures.length} of ${mountPoints.length}):`,
    );
    for (const reason of failures) {
      yield* Console.error(`  ✗ ${reason}`);
    }
    return yield* Effect.fail(
      new MountpointCheckError({ failureCount: failures.length, total: mountPoints.length }),
    );
  }

  yield* Console.log(
    mountPoints.length === 0
      ? "MOUNTPOINTS.md check passed: no mount points registered."
      : `MOUNTPOINTS.md check passed: ${mountPoints.length} mount point(s) verified.`,
  );
});

if (import.meta.main) {
  checkMountpoints.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
}
