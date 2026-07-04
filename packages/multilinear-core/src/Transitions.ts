/**
 * The agent transition whitelist (03-PHASE-2 §C, 01-ARCHITECTURE §7
 * invariant 3). Agent-callable status transitions are whitelist-only,
 * enforced in Store command validation keyed on actor kind — never by prompt
 * politeness. Browser-safe (no imports) so profiles and the web UI validate
 * against the same matrix.
 */
import type { StatusCategory } from "./Model.ts";

/** A category-to-category transition rendered as `from->to`. */
export type TransitionKey = `${StatusCategory}->${StatusCategory}`;

export const transitionKey = (from: StatusCategory, to: StatusCategory): TransitionKey =>
  `${from}->${to}`;

/**
 * Transitions agent actors may perform. Everything else is rejected —
 * including anything → `done` (human-only, invariant 2), anything →
 * `cancelled`, and `needs_review → done`. Agent moves to `duplicate` are not
 * transitions at all: they become pending proposals a human confirms.
 *
 * Two entries carry extra server-side conditions:
 * - `backlog->ready` requires the Ready gate lint to pass (§E).
 * - `in_progress->needs_review` requires proof of work attached since the
 *   issue entered `in_progress` (§B).
 */
export const AGENT_TRANSITION_WHITELIST: ReadonlyArray<TransitionKey> = [
  "triage->backlog",
  "backlog->ready",
  "ready->in_progress",
  "in_progress->needs_review",
];

const whitelist: ReadonlySet<string> = new Set(AGENT_TRANSITION_WHITELIST);

export const isAgentTransitionAllowed = (from: StatusCategory, to: StatusCategory): boolean =>
  whitelist.has(transitionKey(from, to));

/** For rejection messages and profile validation errors. */
export const describeAgentWhitelist = (): string => AGENT_TRANSITION_WHITELIST.join(", ");
