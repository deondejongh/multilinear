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

const sameStrings = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const sameProfile = (a: WorkflowProfile, b: WorkflowProfile): boolean =>
  a.name === b.name &&
  a.intent === b.intent &&
  a.provider === b.provider &&
  a.model === b.model &&
  a.trustTier === b.trustTier &&
  a.body === b.body &&
  a.sourcePath === b.sourcePath &&
  sameStrings(a.allowedTransitions, b.allowedTransitions);

const sameSnapshot = (a: ProfilesSnapshot, b: ProfilesSnapshot): boolean =>
  sameStrings(a.errors, b.errors) &&
  a.profiles.length === b.profiles.length &&
  a.profiles.every((profile, index) => sameProfile(profile, b.profiles[index] as WorkflowProfile));

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
    readonly current: () => Effect.Effect<ProfilesSnapshot>;
    readonly get: (name: string) => Effect.Effect<WorkflowProfile | undefined>;
    /** Re-scan the directories now (the watcher calls this on changes). */
    readonly reload: () => Effect.Effect<ProfilesSnapshot>;
  }
>()("@multilinear/server/Profiles/ProfileLoader") {
  /** Fixed snapshot — tests only. */
  static readonly layerStatic = (
    profiles: ReadonlyArray<WorkflowProfile>,
  ): Layer.Layer<ProfileLoader> =>
    Layer.succeed(ProfileLoader, {
      current: () => Effect.succeed({ profiles, errors: [] }),
      get: (name) => Effect.succeed(profiles.find((profile) => profile.name === name)),
      reload: () => Effect.succeed({ profiles, errors: [] }),
    });

  /**
   * Load from a set of directories and hot-reload on changes. The set is an
   * effect, re-resolved on every reload, so it can follow the space→repo
   * mapping as it changes (MLT-51). Directories may be absent (no profiles
   * yet); on duplicate profile names the earliest directory wins and the
   * collision is an error entry.
   */
  static readonly layer = (options: {
    readonly directories: Effect.Effect<ReadonlyArray<string>>;
    readonly watch?: boolean;
  }): Layer.Layer<ProfileLoader, never, FileSystem.FileSystem | Path.Path> =>
    Layer.effect(ProfileLoader, makeProfileLoader(options));
}

const makeProfileLoader = Effect.fnUntraced(function* (options: {
  readonly directories: Effect.Effect<ReadonlyArray<string>>;
  readonly watch?: boolean;
}) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const state = yield* SynchronizedRef.make<ProfilesSnapshot>(EMPTY_SNAPSHOT);

  const scanDirectory = Effect.fnUntraced(function* (
    directory: string,
    profiles: WorkflowProfile[],
    errors: string[],
  ) {
    const exists = yield* fileSystem.exists(directory).pipe(Effect.orElseSucceed(() => false));
    if (!exists) return;
    const entries = yield* fileSystem
      .readDirectory(directory)
      .pipe(Effect.orElseSucceed(() => [] as ReadonlyArray<string>));
    for (const entry of entries.filter((name) => name.endsWith(".md")).toSorted()) {
      const filePath = path.join(directory, entry);
      const outcome = yield* fileSystem.readFileString(filePath).pipe(
        Effect.mapError((error) => `unreadable: ${String(error)}`),
        Effect.flatMap((content) => parseProfileFile(filePath, entry, content)),
        Effect.result,
      );
      if (Result.isFailure(outcome)) {
        errors.push(`${filePath}: ${outcome.failure}`);
      } else if (profiles.some((profile) => profile.name === outcome.success.name)) {
        const first = profiles.find((profile) => profile.name === outcome.success.name);
        errors.push(
          `${filePath}: duplicate profile name "${outcome.success.name}" (already loaded from ${first?.sourcePath})`,
        );
      } else {
        profiles.push(outcome.success);
      }
    }
  });

  const scan = Effect.fnUntraced(function* () {
    const directories = [...new Set(yield* options.directories)];
    const profiles: WorkflowProfile[] = [];
    const errors: string[] = [];
    for (const directory of directories) {
      yield* scanDirectory(directory, profiles, errors);
    }
    return { profiles, errors } satisfies ProfilesSnapshot;
  });

  const reload = Effect.fnUntraced(function* () {
    const snapshot = yield* scan();
    const previous = yield* SynchronizedRef.get(state);
    // The periodic rescan makes reload hot-path; only swap (and log) when
    // something actually changed.
    if (sameSnapshot(snapshot, previous)) {
      return previous;
    }
    yield* SynchronizedRef.set(state, snapshot);
    // Fail loudly (03 §D): every bad profile is an error log, not a skip.
    yield* Effect.forEach(snapshot.errors, (error) =>
      Effect.logError(`multilinear profile failed to load: ${error}`),
    );
    return snapshot;
  });

  yield* reload();

  if (options.watch !== false) {
    // node:fs.watch semantics vary by platform (and directories may not
    // exist yet), so watch events are merged with a slow periodic rescan —
    // hot reload stays instant where the watchers work and merely prompt
    // where they do not. Only directories present at boot get watchers;
    // later-mapped ones are covered by the rescan (which also re-resolves
    // the directory set as the space→repo mapping changes).
    const bootDirectories = [...new Set(yield* options.directories)];
    const watchStreams: Array<Stream.Stream<unknown>> = [];
    for (const directory of bootDirectories) {
      const exists = yield* fileSystem.exists(directory).pipe(Effect.orElseSucceed(() => false));
      if (exists) {
        watchStreams.push(
          fileSystem
            .watch(directory)
            .pipe(
              Stream.catchCause(() =>
                Stream.fromEffect(
                  Effect.logWarning(
                    `multilinear profile watcher stopped for ${directory}; polling only`,
                  ),
                ),
              ),
            ),
        );
      }
    }
    yield* Stream.mergeAll([...watchStreams, Stream.tick("3 seconds")], {
      concurrency: "unbounded",
    }).pipe(
      Stream.debounce("100 millis"),
      Stream.runForEach(() => reload()),
      Effect.forkScoped,
    );
  }

  return ProfileLoader.of({
    current: () => SynchronizedRef.get(state),
    get: (name) =>
      SynchronizedRef.get(state).pipe(
        Effect.map((snapshot) => snapshot.profiles.find((profile) => profile.name === name)),
      ),
    reload,
  });
});
