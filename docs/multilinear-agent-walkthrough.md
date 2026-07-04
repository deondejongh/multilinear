# Multilinear agent walkthrough — a raw agent session works the board

**Status:** Phase 2 acceptance artifact · repeatable · last executed 2026-07-04 (passing).

This walkthrough proves multilinear's core promise: **any agent in any harness
is a first-class citizen of the board** — not just sessions inside t3code. A
raw Claude Code (or Codex) session in a scratch repo connects to the tracker
over the standalone MCP stdio server and completes a full work cycle:

1. `ml_list_ready` — see what's ready to pick up (no open blockers),
2. `ml_comment` — claim an issue,
3. `ml_transition` — move it `ready → in_progress`,
4. `ml_attach_proof` — hand over structured [proof of work](./proof-of-work.md),
5. `ml_transition` — move it `in_progress → needs_review`,
6. `ml_create_issue` — file discovered work with a `discovered_from` link.

Along the way the server-side rules visibly refuse what they must: the agent
tries to jump to `done` (rejected — human-only, always) and tries to reach
`needs_review` before attaching proof (rejected — proof-gated). Safety lives
in `multilinear-core` command validation keyed on actor kind, not in prompt
politeness — the walkthrough demonstrates both rejections over the real MCP
boundary.

## The scripted version (repeatable, no LLM required)

The checked-in script plays the agent's exact tool-call sequence through a
real MCP stdio client against a throwaway database, asserting every step —
including the two required rejections — and then verifies the permanent event
log directly:

```sh
node --experimental-transform-types \
  packages/multilinear-server/src/mcp/walkthrough.ts
```

Expected final line: `WALKTHROUGH PASSED — agents are citizens of the board.`
Exit code 0 only if every assertion held. Your real tracker
(`~/.multilinear/tracker.db`) is never touched.

Script source: [`packages/multilinear-server/src/mcp/walkthrough.ts`](../packages/multilinear-server/src/mcp/walkthrough.ts).

## The live version (a real agent in a scratch repo)

Do this to watch an actual model walk the same path.

**1. Make a scratch repo** (anywhere — the point is that it is _not_ this repo):

```sh
mkdir /tmp/scratch-walkthrough && cd /tmp/scratch-walkthrough && git init -q
```

**2. Register the multilinear MCP server** with the agent CLI. For Claude Code:

```sh
claude mcp add multilinear \
  --env MULTILINEAR_ACTOR="claude-code:$(whoami)" \
  -- node --experimental-transform-types \
  <path-to-multilinear-repo>/packages/multilinear-server/src/mcp/stdio.ts
```

Environment knobs:

- `MULTILINEAR_ACTOR` — the identity recorded on every mutating call
  (`actor.kind` is always `agent`; this sets `actor.id`). Name the harness and
  profile, e.g. `claude-code:spike`.
- `MULTILINEAR_DB_PATH` — point at a scratch database for a dry run; omit it
  to work the real board at `~/.multilinear/tracker.db`.

**3. Start a session and hand it an issue-shaped prompt**, e.g.:

> Use the multilinear tools. List the ready issues in space MLT and pick one.
> Claim it with a comment, move it to in_progress, do the work, attach proof
> of work, move it to needs_review, and file any discovered follow-ups with a
> discovered_from link. You will find you cannot mark anything done — that's
> the human's job.

**4. Watch the board.** In the t3code web UI (`/multilinear`) the issue moves
across the board, the claim comment and proof render in the thread, the
activity feed shows true `agent:*` actors, and the issue waits in
`needs_review` — the airlock — until a human lets it out.

## What this proves (Phase 2 acceptance)

- The standalone stdio entry point is first-class: the full cycle runs with
  no t3code server involved.
- The transition whitelist, `done` ban, and proof-required rule hold at the
  server, with the rejection reasons readable by the calling agent.
- Follow-ups carry `discovered_from` provenance.
- Every event lands in the permanent log with the true agent identity.

Note on hosted sessions: agent sessions _inside_ t3code get the same `ml_*`
tools automatically via upstream's `/mcp` server (per-session bearer
credentials); their recorded identity is `t3code:thread/<threadId>`.
