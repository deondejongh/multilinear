/**
 * Workflow profile schemas v0 (03-PHASE-2 §D). Profiles are files in user
 * repos — `<repo>/.multilinear/profiles/<name>.md`, YAML frontmatter + prompt
 * body — so a configurer agent can reshape them safely and they are shareable
 * and diffable (00-VISION, blueprints model). This module owns the shape and
 * validation; parsing/loading/watching lives in `@multilinear/server`.
 * Browser-safe (effect only).
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString } from "./Model.ts";
import { AGENT_TRANSITION_WHITELIST, type TransitionKey } from "./Transitions.ts";

export const ProfileIntent = Schema.Literals(["implement", "investigate", "discuss"]);
export type ProfileIntent = typeof ProfileIntent.Type;

/**
 * Trust tiers are recorded and surfaced in Phase 2; enforcement beyond
 * t3code's own controls is Phase 4+.
 */
export const TrustTier = Schema.Literals(["read_only", "workspace_write", "network"]);
export type TrustTier = typeof TrustTier.Type;

const transitionKeys = new Set<string>(AGENT_TRANSITION_WHITELIST);

/** A transition a profile is allowed to make — must be in the agent whitelist. */
export const ProfileTransition = Schema.String.check(
  Schema.makeFilter(
    (value: string) =>
      transitionKeys.has(value) ||
      `Expected one of the agent-whitelisted transitions (${AGENT_TRANSITION_WHITELIST.join(", ")})`,
  ),
).pipe(Schema.brand("ProfileTransition"));

/**
 * The YAML frontmatter of a profile file. Keys are snake_case — this is a
 * file format users edit by hand. `allowed_transitions` defaults to the full
 * agent whitelist; it can only narrow it, never widen it (the whitelist in
 * Store validation is the hard boundary either way).
 */
export const ProfileFrontmatter = Schema.Struct({
  name: Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/)),
  intent: ProfileIntent,
  provider: Schema.optional(TrimmedNonEmptyString),
  model: Schema.optional(TrimmedNonEmptyString),
  trust_tier: TrustTier,
  allowed_transitions: Schema.Array(ProfileTransition).pipe(
    Schema.withDecodingDefault(
      Effect.succeed(AGENT_TRANSITION_WHITELIST as ReadonlyArray<typeof ProfileTransition.Type>),
    ),
  ),
});
export type ProfileFrontmatter = typeof ProfileFrontmatter.Type;

/** A loaded, validated profile: frontmatter + the prompt-template body. */
export const WorkflowProfile = Schema.Struct({
  name: Schema.String,
  intent: ProfileIntent,
  provider: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  trustTier: TrustTier,
  allowedTransitions: Schema.Array(Schema.String),
  /** The prompt template; receives the context pack (ContextPack v2). */
  body: Schema.String,
  /** Absolute path the profile was loaded from. */
  sourcePath: Schema.String,
});
export type WorkflowProfile = typeof WorkflowProfile.Type;

export const profileFromFrontmatter = (
  frontmatter: ProfileFrontmatter,
  body: string,
  sourcePath: string,
): WorkflowProfile => ({
  name: frontmatter.name,
  intent: frontmatter.intent,
  ...(frontmatter.provider !== undefined ? { provider: frontmatter.provider } : {}),
  ...(frontmatter.model !== undefined ? { model: frontmatter.model } : {}),
  trustTier: frontmatter.trust_tier,
  allowedTransitions: frontmatter.allowed_transitions as ReadonlyArray<TransitionKey>,
  body,
  sourcePath,
});
