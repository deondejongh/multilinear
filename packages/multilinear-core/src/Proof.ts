/**
 * Proof-of-work convention v0 (03-PHASE-2 §B, documented in
 * docs/proof-of-work.md). A structured payload agents attach before handing
 * work to review; rendered as a formatted comment and stored as an event.
 * Attaching proof is required for the `in_progress → needs_review` transition
 * by agent actors — enforced in Store command validation, not by prompts.
 * Browser-safe (effect only).
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString } from "./Model.ts";

const NonNegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

const emptyStringArray = Schema.Array(Schema.String).pipe(
  Schema.withDecodingDefault(Effect.succeed([] as ReadonlyArray<string>)),
);

/** `git diff --stat` style summary of the change. */
export const ProofDiffStat = Schema.Struct({
  filesChanged: NonNegativeInt,
  insertions: NonNegativeInt,
  deletions: NonNegativeInt,
});
export type ProofDiffStat = typeof ProofDiffStat.Type;

/** One test/check invocation and its outcome. */
export const ProofTestReport = Schema.Struct({
  /** What ran, e.g. `vp test run` or `pnpm typecheck`. */
  command: TrimmedNonEmptyString,
  result: Schema.Literals(["passed", "failed", "not_run"]),
  /** Counts, failure names, or why it was skipped. */
  detail: Schema.optional(Schema.String),
});
export type ProofTestReport = typeof ProofTestReport.Type;

export const ProofCost = Schema.Struct({
  tokens: Schema.optional(NonNegativeInt),
  currencyAmount: Schema.optional(Schema.Number.check(Schema.isGreaterThanOrEqualTo(0))),
  note: Schema.optional(Schema.String),
});
export type ProofCost = typeof ProofCost.Type;

/**
 * The proof-of-work payload. Every field beyond `summary` is optional or
 * defaulted so a truthful thin proof beats a fabricated thick one — but
 * `notDone` is the field reviewers read first: what is explicitly out of
 * scope or skipped.
 */
export const ProofOfWork = Schema.Struct({
  /** What changed and why. */
  summary: TrimmedNonEmptyString,
  /** Explicitly out of scope / skipped. */
  notDone: emptyStringArray,
  diffStat: Schema.optional(ProofDiffStat),
  /** What ran and how it went. */
  tests: Schema.Array(ProofTestReport).pipe(
    Schema.withDecodingDefault(Effect.succeed([] as ReadonlyArray<ProofTestReport>)),
  ),
  risks: emptyStringArray,
  /** Short-ids (e.g. `MLT-7`) of follow-up issues filed with `discovered_from`. */
  followupsFiled: emptyStringArray,
  cost: Schema.optional(ProofCost),
});
export type ProofOfWork = typeof ProofOfWork.Type;

/** Render a proof as the markdown comment shown in the issue thread. */
export const renderProofMarkdown = (proof: ProofOfWork): string => {
  const lines: string[] = ["### Proof of work", "", proof.summary];
  if (proof.diffStat !== undefined) {
    lines.push(
      "",
      `**Diff:** ${proof.diffStat.filesChanged} files changed, +${proof.diffStat.insertions} / -${proof.diffStat.deletions}`,
    );
  }
  if (proof.tests.length > 0) {
    lines.push("", "**Tests:**");
    for (const test of proof.tests) {
      const detail = test.detail !== undefined && test.detail !== "" ? ` — ${test.detail}` : "";
      lines.push(`- \`${test.command}\` · ${test.result}${detail}`);
    }
  }
  if (proof.notDone.length > 0) {
    lines.push("", "**Not done:**");
    for (const item of proof.notDone) lines.push(`- ${item}`);
  }
  if (proof.risks.length > 0) {
    lines.push("", "**Risks:**");
    for (const risk of proof.risks) lines.push(`- ${risk}`);
  }
  if (proof.followupsFiled.length > 0) {
    lines.push("", `**Follow-ups filed:** ${proof.followupsFiled.join(", ")}`);
  }
  if (proof.cost !== undefined) {
    const parts: string[] = [];
    if (proof.cost.tokens !== undefined) parts.push(`${proof.cost.tokens} tokens`);
    if (proof.cost.currencyAmount !== undefined) parts.push(`${proof.cost.currencyAmount}`);
    if (proof.cost.note !== undefined && proof.cost.note !== "") parts.push(proof.cost.note);
    if (parts.length > 0) lines.push("", `**Cost:** ${parts.join(" · ")}`);
  }
  return lines.join("\n");
};
