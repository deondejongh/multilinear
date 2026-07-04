// @effect-diagnostics nodeBuiltinImport:off globalDate:off globalRandomInEffect:off
/**
 * Profile loader v0 (03-PHASE-2 §D): load, validate, hot-reload; bad
 * frontmatter fails loudly.
 */
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { NodeFileSystem, NodePath as NodePathService } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { ProfileLoader } from "./Profiles.ts";
import { scaffoldStarterProfiles, STARTER_PROFILES } from "./StarterProfiles.ts";

const platform = Layer.mergeAll(NodeFileSystem.layer, NodePathService.layer);

let tempCounter = 0;
const makeTempDir = (): string => {
  tempCounter += 1;
  const dir = NodePath.join(
    NodeOS.tmpdir(),
    `multilinear-profiles-test-${process.pid}-${tempCounter}`,
  );
  NodeFS.rmSync(dir, { recursive: true, force: true });
  NodeFS.mkdirSync(dir, { recursive: true });
  return dir;
};

const loaderFor = (directory: string, watch: boolean) =>
  ProfileLoader.layer({ directories: Effect.succeed([directory]), watch }).pipe(
    Layer.provide(platform),
  );

const loaderForMany = (directories: ReadonlyArray<string>, watch: boolean) =>
  ProfileLoader.layer({ directories: Effect.succeed(directories), watch }).pipe(
    Layer.provide(platform),
  );

const VALID_PROFILE = `---
name: implementer
intent: implement
trust_tier: workspace_write
allowed_transitions:
  - ready->in_progress
  - in_progress->needs_review
---
You are the implementer. {{CONTEXT_PACK}}
`;

describe("ProfileLoader", () => {
  it.effect("loads and validates a profile from a directory", () => {
    const dir = makeTempDir();
    NodeFS.writeFileSync(NodePath.join(dir, "implementer.md"), VALID_PROFILE);
    return Effect.gen(function* () {
      const loader = yield* ProfileLoader;
      const snapshot = yield* loader.current();
      assert.deepStrictEqual(snapshot.errors, []);
      const profile = snapshot.profiles[0];
      assert.strictEqual(profile?.name, "implementer");
      assert.strictEqual(profile?.intent, "implement");
      assert.strictEqual(profile?.trustTier, "workspace_write");
      assert.deepStrictEqual(profile?.allowedTransitions, [
        "ready->in_progress",
        "in_progress->needs_review",
      ]);
      assert.include(profile?.body ?? "", "You are the implementer.");
      const byName = yield* loader.get("implementer");
      assert.strictEqual(byName?.name, "implementer");
      assert.isUndefined(yield* loader.get("nope"));
    }).pipe(Effect.provide(loaderFor(dir, false)));
  });

  it.effect("a missing directory is an empty snapshot, not a crash", () => {
    const dir = NodePath.join(makeTempDir(), "does-not-exist");
    return Effect.gen(function* () {
      const loader = yield* ProfileLoader;
      const snapshot = yield* loader.current();
      assert.deepStrictEqual(snapshot, { profiles: [], errors: [] });
    }).pipe(Effect.provide(loaderFor(dir, false)));
  });

  it.effect("loads across directories; earliest wins a name collision, loudly (MLT-51)", () => {
    const first = makeTempDir();
    const second = makeTempDir();
    NodeFS.writeFileSync(NodePath.join(first, "implementer.md"), VALID_PROFILE);
    NodeFS.writeFileSync(NodePath.join(second, "implementer.md"), VALID_PROFILE);
    NodeFS.writeFileSync(
      NodePath.join(second, "reviewer.md"),
      VALID_PROFILE.replace(/implementer/g, "reviewer"),
    );
    return Effect.gen(function* () {
      const loader = yield* ProfileLoader;
      const snapshot = yield* loader.current();
      assert.deepStrictEqual(
        snapshot.profiles.map((profile) => profile.name),
        ["implementer", "reviewer"],
      );
      assert.strictEqual(snapshot.profiles[0]?.sourcePath, NodePath.join(first, "implementer.md"));
      assert.strictEqual(snapshot.errors.length, 1);
      assert.include(snapshot.errors[0] ?? "", 'duplicate profile name "implementer"');
    }).pipe(Effect.provide(loaderForMany([first, second], false)));
  });

  it.effect("bad frontmatter fails loudly and never half-loads", () => {
    const dir = makeTempDir();
    // Invalid: trust_tier not in the enum, and a transition outside the whitelist.
    NodeFS.writeFileSync(
      NodePath.join(dir, "rogue.md"),
      `---
name: rogue
intent: implement
trust_tier: root
allowed_transitions:
  - in_progress->done
---
Do whatever you want.
`,
    );
    NodeFS.writeFileSync(NodePath.join(dir, "implementer.md"), VALID_PROFILE);
    return Effect.gen(function* () {
      const loader = yield* ProfileLoader;
      const snapshot = yield* loader.current();
      // The good profile loads; the bad one is an error entry, not a skip.
      assert.deepStrictEqual(
        snapshot.profiles.map((profile) => profile.name),
        ["implementer"],
      );
      assert.strictEqual(snapshot.errors.length, 1);
      assert.include(snapshot.errors[0] ?? "", "rogue.md");
      assert.include(snapshot.errors[0] ?? "", "invalid frontmatter");
    }).pipe(Effect.provide(loaderFor(dir, false)));
  });

  it.effect("a name/filename mismatch and a missing body are rejected", () => {
    const dir = makeTempDir();
    NodeFS.writeFileSync(
      NodePath.join(dir, "misnamed.md"),
      "---\nname: other\nintent: discuss\ntrust_tier: read_only\n---\nBody.\n",
    );
    NodeFS.writeFileSync(
      NodePath.join(dir, "empty.md"),
      "---\nname: empty\nintent: discuss\ntrust_tier: read_only\n---\n",
    );
    NodeFS.writeFileSync(NodePath.join(dir, "no-frontmatter.md"), "Just a prompt.\n");
    return Effect.gen(function* () {
      const loader = yield* ProfileLoader;
      const snapshot = yield* loader.current();
      assert.deepStrictEqual(snapshot.profiles, []);
      assert.strictEqual(snapshot.errors.length, 3);
      const joined = snapshot.errors.join("\n");
      assert.include(joined, "does not match file name");
      assert.include(joined, "is empty");
      assert.include(joined, "missing YAML frontmatter");
    }).pipe(Effect.provide(loaderFor(dir, false)));
  });

  it.live("hot-reloads when a profile file changes", () => {
    const dir = makeTempDir();
    NodeFS.writeFileSync(NodePath.join(dir, "implementer.md"), VALID_PROFILE);
    return Effect.gen(function* () {
      const loader = yield* ProfileLoader;
      assert.strictEqual((yield* loader.current()).profiles.length, 1);

      NodeFS.writeFileSync(
        NodePath.join(dir, "spike.md"),
        "---\nname: spike\nintent: investigate\ntrust_tier: read_only\n---\nReport only.\n",
      );
      // Wait for the watcher (100ms debounce) to pick the new file up.
      const names = yield* Effect.gen(function* () {
        while (true) {
          const snapshot = yield* loader.current();
          if (snapshot.profiles.length === 2) {
            return snapshot.profiles.map((profile) => profile.name).toSorted();
          }
          yield* Effect.sleep("50 millis");
        }
      }).pipe(Effect.timeout("10 seconds"));
      assert.deepStrictEqual(names, ["implementer", "spike"]);
    }).pipe(Effect.provide(loaderFor(dir, true)), Effect.scoped);
  });
});

describe("starter profiles", () => {
  it.effect("scaffold writes all three; they load cleanly; reruns change nothing", () => {
    const dir = makeTempDir();
    return Effect.gen(function* () {
      const written = yield* scaffoldStarterProfiles(dir);
      assert.deepStrictEqual(
        written.toSorted(),
        STARTER_PROFILES.map((starter) => starter.fileName).toSorted(),
      );

      const loader = yield* ProfileLoader;
      // The layer loaded before the scaffold ran; re-scan explicitly.
      const snapshot = yield* loader.reload();
      assert.deepStrictEqual(snapshot.errors, []);
      assert.deepStrictEqual(snapshot.profiles.map((profile) => profile.name).toSorted(), [
        "bug-fixer",
        "implementer",
        "spike",
      ]);
      const spike = snapshot.profiles.find((profile) => profile.name === "spike");
      assert.strictEqual(spike?.trustTier, "read_only");
      assert.strictEqual(spike?.intent, "investigate");

      // Scaffolding again never overwrites the user's files.
      const rewritten = yield* scaffoldStarterProfiles(dir);
      assert.deepStrictEqual(rewritten, []);
    }).pipe(Effect.provide(Layer.mergeAll(loaderFor(dir, false), platform)));
  });
});
