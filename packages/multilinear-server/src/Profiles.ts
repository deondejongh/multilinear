/**
 * Workflow-profile loader v0 (03-PHASE-2 §D). Profiles are markdown files —
 * YAML frontmatter + prompt body — in `<repo>/.multilinear/profiles/`,
 * versioned with the user's code. The loader validates against the schemas
 * in `@multilinear/core/profile`, hot-reloads on file changes, and fails
 * loudly: a bad profile never loads silently, it becomes an error entry and
 * an error log.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as SynchronizedRef from "effect/SynchronizedRef";
import * as YAML from "yaml";

import {
  ProfileFrontmatter,
  profileFromFrontmatter,
  type WorkflowProfile,
} from "@multilinear/core/profile";

export interface ProfilesSnapshot {
  readonly profiles: ReadonlyArray<WorkflowProfile>;
  /** Load failures as `path: reason` — surfaced, never swallowed. */
  readonly errors: ReadonlyArray<string>;
}

const EMPTY_SNAPSHOT: ProfilesSnapshot = { profiles: [], errors: [] };

const decodeFrontmatter = Schema.decodeUnknownEffect(ProfileFrontmatter);

/** Split a profile file into frontmatter YAML and prompt body. */
const splitFrontmatter = (
  content: string,
): { readonly yaml: string; readonly body: string } | undefined => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(content);
  if (match === null) return undefined;
  return { yaml: match[1] ?? "", body: (match[2] ?? "").trim() };
};

/** Parse and validate one profile file. Returns the profile or a reason. */
export const parseProfileFile = Effect.fnUntraced(function* (
  filePath: string,
  fileName: string,
  content: string,
) {
  const parts = splitFrontmatter(content);
  if (parts === undefined) {
    return yield* Effect.fail("missing YAML frontmatter (expected a leading --- block)");
  }
  const raw = yield* Effect.try({
    try: () => YAML.parse(parts.yaml) as unknown,
    catch: (error) => `invalid YAML frontmatter: ${String(error)}`,
  });
  const frontmatter = yield* decodeFrontmatter(raw).pipe(
    Effect.mapError((error) => `invalid frontmatter: ${String(error)}`),
  );
  const expectedName = fileName.replace(/\.md$/, "");
  if (frontmatter.name !== expectedName) {
    return yield* Effect.fail(
      `frontmatter name "${frontmatter.name}" does not match file name "${expectedName}"`,
    );
  }
  if (parts.body === "") {
    return yield* Effect.fail("profile body (the prompt template) is empty");
  }
  return profileFromFrontmatter(frontmatter, parts.body, filePath);
});

export class ProfileLoader extends Context.Service<
  ProfileLoader,
  {
    /** The directory this loader reads from. */
    readonly directory: string;
    readonly current: () => Effect.Effect<ProfilesSnapshot>;
    readonly get: (name: string) => Effect.Effect<WorkflowProfile | undefined>;
    /** Re-scan the directory now (the watcher calls this on changes). */
    readonly reload: () => Effect.Effect<ProfilesSnapshot>;
  }
>()("@multilinear/server/Profiles/ProfileLoader") {
  /** Fixed snapshot — tests only. */
  static readonly layerStatic = (
    profiles: ReadonlyArray<WorkflowProfile>,
  ): Layer.Layer<ProfileLoader> =>
    Layer.succeed(ProfileLoader, {
      directory: "<static>",
      current: () => Effect.succeed({ profiles, errors: [] }),
      get: (name) => Effect.succeed(profiles.find((profile) => profile.name === name)),
      reload: () => Effect.succeed({ profiles, errors: [] }),
    });

  /**
   * Load from a directory and hot-reload on changes. The directory may be
   * absent (no profiles yet) — it is re-checked on every reload.
   */
  static readonly layer = (options: {
    readonly directory: string;
    readonly watch?: boolean;
  }): Layer.Layer<ProfileLoader, never, FileSystem.FileSystem | Path.Path> =>
    Layer.effect(ProfileLoader, makeProfileLoader(options));
}

const makeProfileLoader = Effect.fnUntraced(function* (options: {
  readonly directory: string;
  readonly watch?: boolean;
}) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const state = yield* SynchronizedRef.make<ProfilesSnapshot>(EMPTY_SNAPSHOT);

  const scan = Effect.fnUntraced(function* () {
    const exists = yield* fileSystem
      .exists(options.directory)
      .pipe(Effect.orElseSucceed(() => false));
    if (!exists) return EMPTY_SNAPSHOT;
    const entries = yield* fileSystem
      .readDirectory(options.directory)
      .pipe(Effect.orElseSucceed(() => [] as ReadonlyArray<string>));
    const profiles: WorkflowProfile[] = [];
    const errors: string[] = [];
    for (const entry of entries.filter((name) => name.endsWith(".md")).toSorted()) {
      const filePath = path.join(options.directory, entry);
      const outcome = yield* fileSystem.readFileString(filePath).pipe(
        Effect.mapError((error) => `unreadable: ${String(error)}`),
        Effect.flatMap((content) => parseProfileFile(filePath, entry, content)),
        Effect.result,
      );
      if (Result.isSuccess(outcome)) {
        profiles.push(outcome.success);
      } else {
        errors.push(`${filePath}: ${outcome.failure}`);
      }
    }
    return { profiles, errors } satisfies ProfilesSnapshot;
  });

  const reload = Effect.fnUntraced(function* () {
    const snapshot = yield* scan();
    yield* SynchronizedRef.set(state, snapshot);
    // Fail loudly (03 §D): every bad profile is an error log, not a skip.
    yield* Effect.forEach(snapshot.errors, (error) =>
      Effect.logError(`multilinear profile failed to load: ${error}`),
    );
    return snapshot;
  });

  yield* reload();

  if (options.watch !== false) {
    const exists = yield* fileSystem
      .exists(options.directory)
      .pipe(Effect.orElseSucceed(() => false));
    if (exists) {
      yield* fileSystem.watch(options.directory).pipe(
        Stream.debounce("100 millis"),
        Stream.runForEach(() => reload()),
        Effect.catch((error) =>
          Effect.logWarning(`multilinear profile watcher stopped: ${String(error)}`),
        ),
        Effect.forkScoped,
      );
    }
  }

  return ProfileLoader.of({
    directory: options.directory,
    current: () => SynchronizedRef.get(state),
    get: (name) =>
      SynchronizedRef.get(state).pipe(
        Effect.map((snapshot) => snapshot.profiles.find((profile) => profile.name === name)),
      ),
    reload,
  });
});
