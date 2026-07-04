# Proof of Work — a handoff convention for agent-executed issues

**Status:** v0 · shipped with [multilinear](../multilinear-plan/00-VISION.md) Phase 2 · meant to be
portable — nothing here is specific to multilinear or t3code, and you are welcome
to adopt it in your own tracker or harness.

## The problem

When an agent finishes a piece of work, the artifact it produces (a diff, a
branch, a report) tells you _what exists now_ — not _what happened_. Review
capacity is the real bottleneck in agent-heavy workflows: a human deciding
whether to accept work needs the story, not just the bytes. "Trust me, it's
done" does not scale past one agent.

**Proof of work** is a small structured payload an agent attaches to an issue
before handing it to review. It is the agent's closing argument: what changed,
what deliberately didn't, what ran, what's risky, and what it cost.

## The payload

```jsonc
{
  "summary": "Replaced the polling loop with fs events; startup no longer blocks on the first scan.",
  "not_done": ["Windows watcher path untested (no CI runner)", "docs update — filed as MLT-83"],
  "diff_stat": { "files_changed": 4, "insertions": 122, "deletions": 61 },
  "tests": [
    { "command": "vp test run", "result": "passed", "detail": "96 tests" },
    { "command": "pnpm typecheck", "result": "passed" },
  ],
  "risks": ["fs.watch coalesces events differently across platforms"],
  "followups_filed": ["MLT-83"],
  "cost": { "tokens": 48200, "note": "one retry after a failed first approach" },
}
```

| Field             | Required | Meaning                                                                                         |
| ----------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `summary`         | yes      | What changed **and why** — written for the reviewer, not the changelog.                         |
| `not_done`        | no       | Explicitly out of scope or skipped. The field reviewers read first: honest gaps beat surprises. |
| `diff_stat`       | no       | `files_changed` / `insertions` / `deletions` — the shape of the change at a glance.             |
| `tests`           | no       | What ran and how it went: `command`, `result` (`passed` / `failed` / `not_run`), `detail`.      |
| `risks`           | no       | What might break, what assumptions were made.                                                   |
| `followups_filed` | no       | Ids of issues filed for discovered work (with provenance links — see below).                    |
| `cost`            | no       | `tokens`, `currency_amount`, and/or a free-form `note`, if known.                               |

Design intent: **every field beyond `summary` is optional so that a truthful
thin proof always beats a fabricated thick one.** A proof that says "I did not
run the tests" is a good proof; a proof with invented test results is the
failure mode this convention exists to prevent.

## The rules that make it real

A convention agents can silently skip is decoration. In multilinear, proof of
work is load-bearing, and the load is carried **server-side, keyed on the actor
kind** — never by prompt wording:

1. **Proof-gated review.** An agent cannot move an issue from `in_progress` to
   `needs_review` unless a proof was attached _after the issue last entered
   `in_progress`_. Stale proofs from an earlier attempt don't count. (Humans
   are exempt — the gate disciplines agents, not people.)
2. **Nothing agent-done is ever "done".** Agents cannot move anything to
   `done` under any circumstances; a human reviews work out of the airlock.
3. **Secret scan before persistence.** Proofs (and comments) from agent actors
   are scanned for credential-shaped strings — AWS/GitHub/Slack/API keys,
   private-key blocks, JWTs, `password=`-style assignments — and rejected
   outright. Agents describe secrets; they never paste values.
4. **Provenance on follow-ups.** Work discovered mid-issue is filed as a new
   issue with a `discovered_from` relation back to the issue that surfaced it,
   and listed in `followups_filed`. Reviewers can trust agent-filed backlog
   because they can trace where each item came from.

## How it renders

A proof is stored as an event (`proof.attached`) in the issue's permanent log
and rendered as a formatted card in the issue thread:

> ### Proof of work
>
> Replaced the polling loop with fs events; startup no longer blocks on the first scan.
>
> **Diff:** 4 files changed, +122 / -61
>
> **Tests:**
>
> - `vp test run` · passed — 96 tests
> - `pnpm typecheck` · passed
>
> **Not done:**
>
> - Windows watcher path untested (no CI runner)
> - docs update — filed as MLT-83
>
> **Risks:**
>
> - fs.watch coalesces events differently across platforms
>
> **Follow-ups filed:** MLT-83
>
> **Cost:** 48200 tokens · one retry after a failed first approach

## Adopting it elsewhere

The convention is three commitments, not a schema dependency:

1. a structured handoff payload with `summary` + `not_done` at its heart,
2. a machine-enforced rule that agent work cannot reach review without one,
3. honest-thin over fabricated-thick, enforced culturally by reviewers who
   reward disclosed gaps.

The multilinear reference implementation lives in
`packages/multilinear-core/src/Proof.ts` (schema + renderer) and
`packages/multilinear-core/src/Store.ts` (the proof-required transition rule),
with the MCP tool surface (`ml_attach_proof`) in
`packages/multilinear-server/src/mcp/Toolkit.ts`.

_Lineage: the handoff-with-evidence idea traces to OpenAI's Symphony; the
provenance links to Steve Yegge's Beads._
