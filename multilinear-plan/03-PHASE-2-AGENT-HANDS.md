# 03 — Phase 2: agent hands (MCP citizenship)

**Goal:** agents become first-class citizens of the board. Any agent — inside
t3code _or_ a raw Claude Code terminal — can read issues, comment, transition
within a whitelist, file discovered work, and hand off with proof of work. No
auto-dispatch yet; humans still start every run.

**Prerequisite:** Phase 1 accepted.

## In scope

### A. multilinear MCP server

Hosted from `multilinear-server`. DISCOVER: expose via upstream's MCP hosting if it
gives sessions the tools cheaply, **and** ship a standalone stdio entry point so
raw `claude` / `codex` sessions in any repo can use the tracker too (this is the
"universal adapter" differentiator — treat the standalone mode as first-class).

Tools (keep the surface small; JSON in/out; every mutating tool records
`actor.kind = agent` + the calling profile/session identity):

- `ml_list_ready(space?)` → issues in `ready` with no open blockers.
- `ml_get_issue(id)` → full issue + relations + recent comments.
- `ml_comment(id, body)`.
- `ml_transition(id, to_status)` — **whitelist-enforced server-side** (§C).
- `ml_create_issue(title, body, space, type?, discovered_from?)` — follow-ups
  MUST set `discovered_from`.
- `ml_attach_proof(id, proof)` — see §B.
- `ml_request_input(id, question)` — marks the issue **Agent Blocked**
  (badge + filterable), posts the question as a comment.
- `ml_log_cost(id, tokens?, currency_amount?, note?)`.

### B. Proof-of-work convention v0

A structured payload rendered as a formatted comment and stored as an event:
`summary` (what changed & why), `not_done` (explicitly out of scope / skipped),
`diff_stat` (files, +/-), `tests` (what ran, results), `risks`, `followups_filed`
(issue ids), `cost` (if known). Attaching proof is required for the
`in_progress → needs_review` transition by agent actors. Document the convention
in a standalone `docs/proof-of-work.md` (it's meant to be publishable).

### C. Transition whitelist (agent actors)

Allowed: `triage→backlog`, `backlog→ready`_, `ready→in_progress`,
`in_progress→needs_review` (proof required), `in_progress→blocked-flag` (via
request_input; not a status change), any → `duplicate` **as a proposal only**
(sets a pending flag the human confirms).
Never: anything → `done`; anything → `cancelled`; `needs_review→done`.
(_`backlog→ready` only when the issue passes the Ready gate, §E.)
Enforced in `multilinear-core` command validation keyed on actor kind — not by prompts.

### D. Workflow profiles v0 (files in user repos)

`<repo>/.multilinear/profiles/<name>.md` — YAML frontmatter + prompt body:
`name`, `intent` (implement | investigate | discuss), `provider/model` hints,
`trust_tier` (read*only | workspace_write | network), `allowed_transitions`
(subset of §C), body = the prompt template (receives the context pack). Loader with
schema validation + hot reload. Ship three starter profiles: `implementer`,
`bug-fixer`, `spike` (read-only, hard-capped, report-only). Trust tiers are
\_recorded and surfaced* now; enforcement beyond t3code's own controls is Phase 4+.

### E. Ready gate v0

An issue template checklist (acceptance criteria, affected area, out-of-scope) and
a soft lint: moving to `ready` with an empty acceptance-criteria section warns
(human can override; agents cannot).

### F. Context pack v2

Now assembled from: profile prompt template + issue + relations + **compacted**
discussion (naive compaction: last N comments verbatim + one-line summaries of
older ones — a stub for the Beads-style memory-decay idea).

## Out of scope

Auto-dispatch, schedules, rules, GitHub sync, trust-tier _enforcement_, tournament.

## Acceptance criteria

- [ ] Scripted end-to-end walkthrough (documented + repeatable): a raw Claude Code
      session in a scratch repo lists ready issues, claims one via comment,
      transitions to `in_progress`, attaches proof, transitions to `needs_review`,
      files a `discovered_from` follow-up.
- [ ] Whitelist violations are rejected server-side with tests proving it
      (including the `done` ban and proof-required rule).
- [ ] Agent Blocked state visible and filterable on the board.
- [ ] Profiles load, validate, hot-reload; bad frontmatter fails loudly.
- [ ] Proof-of-work renders cleanly in the issue thread and in the activity feed.
- [ ] Secret-pattern scan runs over proofs and comments from agent actors
      (invariant 5) with a test.
