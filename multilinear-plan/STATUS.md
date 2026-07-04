# STATUS — living memory

> Agents: read this at session start; update it before session end (Working
> Agreement §0). Humans: this is the project's single source of "where are we".

**Last updated:** 2026-07-04 (Phase 2 complete — agents are citizens of the board)
**Current phase:** 2 done; next up Phase 3 (policy brain — ⛔ still gated on upstream #2829)

## Phase checklist

- [x] Phase 0 — fork scaffolding (2026-07-04, CI green)
- [x] Phase 1 — the board (2026-07-04, 40 issues seeded into space MLT)
- [x] Phase 2 — agent hands (2026-07-04, MCP + whitelist + proof-of-work; walkthrough executed live)
- [ ] Phase 3 — policy brain (⛔ gated on upstream #2829 → main)
- [ ] Phase 4 — rules and the world

## Decisions

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Status                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| D1  | Project name: **multilinear**. Tongue-in-cheek Linear homage + the maths meaning (linear in each argument → "linear in every agent"). Collision check 2026-07-04: no npm package or notable repo owns the bare name. Standing plan: rename if it ever gains real traction (trademark-adjacency + SEO vs. the maths field). TODO today: grab the GitHub repo name; npm scope when packages publish.                                                                                                                                                   | **RESOLVED 2026-07-04**                        |
| D2  | License. Leaning MIT (matches upstream, maximizes adoption); AGPL considered to deter cloud clones. Decide before first outside contribution.                                                                                                                                                                                                                                                                                                                                                                                                        | OPEN — human                                   |
| D3  | Data directory: `~/.multilinear/`. Outside upstream's state dirs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | RESOLVED 2026-07-04                            |
| D4  | Working branch: `multilinear-main`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | RESOLVED 2026-07-04                            |
| D6  | MCP tool prefix `ml_` (e.g. `ml_list_ready`) for token economy — the server registers as `multilinear`, so namespacing disambiguates from machine-learning. CLI alias `ml`. Veto by find-replace if it reads badly in practice.                                                                                                                                                                                                                                                                                                                      | RESOLVED 2026-07-04 (default — human may veto) |
| D7  | 2026-07-04. `MOUNTPOINTS.md` seeded with the two pre-existing human edits to upstream files (AGENTS.md model-selection section, CLAUDE.md→AGENTS.md symlink) instead of starting empty as Prompt 0 said: the guard's job is merge safety and those edits are real conflict surface; it also exercises the checker with real rows from day one.                                                                                                                                                                                                       | RESOLVED (agent)                               |
| D8  | 2026-07-04. Merge-guard CI runs on `ubuntu-latest` (upstream's Blacksmith runners don't exist on a personal fork). "Build" = `vp check` + repo-wide `vpr typecheck` — upstream's own Check gate minus the desktop/Electron steps, which need Electron downloads and Blacksmith-scale runners. Revisit if a real bundle build becomes the better break-detector.                                                                                                                                                                                      | RESOLVED (agent)                               |
| D9  | 2026-07-04. Mount-point references: the Lines column takes `12`/`12-16` (line bound), a backtick-quoted anchor substring, or `—` (existence only). Anchors preferred — they survive upstream line drift.                                                                                                                                                                                                                                                                                                                                             | RESOLVED (agent)                               |
| D10 | 2026-07-04. Phase-0 tooling lives in `scripts/multilinear/` inside `@t3tools/scripts` so it's typechecked/linted/tested by the existing harness; the checker's unit tests are the placeholder test target until `packages/multilinear-core` (Phase 1).                                                                                                                                                                                                                                                                                               | RESOLVED (agent)                               |
| D11 | 2026-07-04. Server surface (02 §B DISCOVER): namespaced HTTP under `/api/multilinear/*`, not WS RPC. The WS surface is one monolithic `RpcGroup` in `packages/contracts/src/rpc.ts` plus a single 900-line handler object in `apps/server/src/ws.ts` — both high-churn upstream files; extending them means two mount points in the worst conflict surface in the repo. HTTP needs one route-layer registration in `server.ts`, the web dev proxy already forwards `/api`, and auth reuses `EnvironmentAuth` exactly like upstream's own raw routes. | RESOLVED (agent)                               |
| D12 | 2026-07-04. Storage: `node:sqlite` `DatabaseSync` wrapped in an Effect service inside `multilinear-core`. Upstream's `SqlClient` port lives in `apps/server` (off-limits per invariant 7); `@effect/sql-sqlite-node` would drag in `better-sqlite3` native builds. `node:sqlite` works on Node ≥22.16 (repo pins 24) and Bun ≥1.2 (upstream runs both runtimes). Sync API suits SQLite; Effect wraps it for errors/services.                                                                                                                         | RESOLVED (agent)                               |
| D13 | 2026-07-04. Package names `@multilinear/core` / `@multilinear/server` (dirs `packages/multilinear-core`, `packages/multilinear-server`): distinct from upstream's `@t3tools` scope so extraction to a standalone repo stays trivial. Same source-export pattern as `@t3tools/shared` (subpath exports pointing at `src/*.ts`, no build step). Browser-safe subpaths (`schema`, `api`) kept free of `node:sqlite` imports so `apps/web` can import them.                                                                                              | RESOLVED (agent)                               |
| D14 | 2026-07-04. The single upstream-importing adapter module (01 §1.3) is `apps/server/src/multilinear/adapter.ts` — a _new file_ inside upstream's src tree (explicitly allowed by 01 §2), because `apps/server` is an app, not an importable package; a separate package could not reach `EnvironmentAuth`/`ServerConfig`. `packages/multilinear-server` imports only `effect` + `@multilinear/core`.                                                                                                                                                  | RESOLVED (agent)                               |
| D15 | 2026-07-04. Relations stored canonically (`blocks`, `parent`, `relates_to`, `duplicate_of`, `discovered_from`); `blocked_by`/`child` are derived inverse views at query/UI level. All six kinds exist at the API surface. Prevents double-entry drift in the event log.                                                                                                                                                                                                                                                                              | RESOLVED (agent)                               |
| D16 | 2026-07-04. Issue short-ids `SPACEKEY-n` (e.g. `MLT-42`): `n` is per-space, assigned deterministically at replay as (count of prior `issue.created` in that space) + 1 — a projection fact, not event payload, so rebuild determinism is free. Space key defaults to first 3 consonant-ish chars of the name, editable at space creation.                                                                                                                                                                                                            | RESOLVED (agent)                               |
| D17 | 2026-07-04. Keyboard-first UI uses view-local key handlers inside our routes (mirroring upstream's per-component `onKeyDown` conventions), not new `KeybindingCommand`s — those live in `@t3tools/contracts` and would cost a mount point in a churny file. Revisit if/when the tracker earns global shortcuts.                                                                                                                                                                                                                                      | RESOLVED (agent)                               |
| D18 | 2026-07-04. MCP via effect's `McpServer` (already upstream's own MCP stack): one `Toolkit` definition serves both transports — `layerStdio` for the standalone entry point (`packages/multilinear-server/src/mcp/stdio.ts`) and registration onto upstream's `/mcp` HTTP server (mount point in `McpHttpServer.ts`). Hosted actor identity = `t3code:thread/<threadId>` from `McpInvocationContext`; stdio identity from `MULTILINEAR_ACTOR` env (default `stdio:<os user>`).                                                                        | RESOLVED (agent)                               |
| D19 | 2026-07-04. Proof-required rule: a proof event must exist with event-id (ULID, chronological) greater than the id of the transition that last put the issue into `in_progress` (`issues.in_progress_since_event`) — review bounces need fresh proof. Agent moves to `duplicate` become `duplicate.proposed` (pending flag) inside the same `status.change` command; `duplicate.resolve` is human-only. `input.request` is agent-only; the Agent Blocked flag clears on any human comment or any status change (implicit, projection-deterministic).  | RESOLVED (agent)                               |
| D20 | 2026-07-04. Secret scan scope: automated actors only (`agent`/`rule`/`system` via `actor.kind !== "human"`); humans are exempt so the accountable operator can't be locked out by a false positive. Reject-before-persist, never redact. Scan covers comment bodies, request-input questions, cost notes, and the whole proof payload via its JSON serialization.                                                                                                                                                                                    | RESOLVED (agent)                               |
| D21 | 2026-07-04. Projection-schema migration via `PRAGMA user_version`: on open with an older version, drop projection tables and replay the event log (projections are disposable; the `events` table never changes shape). Phase 2 = version 2.                                                                                                                                                                                                                                                                                                         | RESOLVED (agent)                               |
| D22 | 2026-07-04. Public agent-facing surfaces (MCP tool params/results, profile frontmatter, proof-of-work doc) use snake_case (`to_status`, `not_done`, `trust_tier` — matches the spec's vocabulary); core schemas stay camelCase per codebase convention; the MCP handlers map. Profiles dir resolution: `MULTILINEAR_PROFILES_DIR` override, else walk up from server cwd to the nearest `.multilinear/profiles` (per-space repo mapping = MLT-51).                                                                                                   | RESOLVED (agent)                               |
| D23 | 2026-07-04. `cost.recorded` is feed-only in Phase 2 (no projection table); an aggregate projection lands with Phase 3 estimates-vs-actuals (MLT-53). Routes and hosted-MCP registration each hold their own SQLite connection (WAL-safe; consolidation = MLT-52).                                                                                                                                                                                                                                                                                    | RESOLVED (agent)                               |
| D5+ | (agents append decisions here with date + rationale)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | —                                              |

## Open questions

_(empty — agents append; humans resolve)_

## Follow-ups (pre-tracker only)

_(agents list discovered work here until Phase 1's tracker can hold it)_

## Watchlist (verify before relying; update "last checked")

| Item                                                                       | State at last check                                                                       | Last checked |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------ |
| Upstream PR #2829 (orchestration V2, `delegate_task`/`create_threads` MCP) | Open draft, branch `t3code/codex-turn-mapping`, ~92 commits                               | 2026-07-04   |
| Upstream PR #3638 (scheduled tasks / "Automations")                        | Merged into `codex-turn-mapping` (NOT on main)                                            | 2026-07-04   |
| Upstream main                                                              | No issue tracker anywhere (code, .plans, docs); "task" = thread; "project" = repo folder  | 2026-07-04   |
| Tripwire                                                                   | Upstream persistent work-item queue _with states_ → halt, re-derive collision map (01 §6) | 2026-07-04   |
| Landscape                                                                  | Agent HQ cadence; Vibe Kanban community fork; Beads/GasTown                               | 2026-07-04   |

## Session log

### 2026-07-05 — Quick-win batch between Phase 2 and Phase 3 (COMPLETE)

**Done — all 8 slated issues, each claimed → in_progress → proof →
needs_review through the tracker as agent `claude-code:quick-wins`, one
commit per issue (or one for the intertwined pair):**

- **MLT-55** short-id URLs: `issue.get`/`issue.activity` accept ULID or
  short-id (resolved server-side, 404 on miss); in-app links now build
  readable `/multilinear/issue/MLT-7` URLs; commands keep the canonical id.
- **MLT-59** `ml_list_issues`: general MCP read tool (space /
  status_category / label-by-name / search / agent_blocked) over the
  existing `listIssues` query, cap 100 + `truncated`, described as THE way
  to browse so agents stop reading the SQLite file.
- **MLT-52 + MLT-41** (one adapter rework): the tracker DB opens once per
  process via a module-level `Effect.cached` open shared by the routes tree
  and the hosted-MCP tree (verified: one `tracker.db` fd, was two); open
  failure no longer kills boot — `TrackerStore.unavailable` + the
  `unavailable` sentinel → routes 503, MCP tools return the reason
  (verified live with `MULTILINEAR_DB_PATH=/dev/null/nope`).
- **MLT-53** cost projection: projection schema **v3** (`costs` table,
  drop-and-replay per D21 — the real DB migrated during the session);
  `IssueDetail.costs` totals + a "Recorded cost" sidebar line.
- **MLT-56** developer instructions: steering block generated from the
  toolkit tool names in `@multilinear/server`, interpolated into both Codex
  mode templates — new mount point in `CodexDeveloperInstructions.ts`
  (8 rows total, checker green). Other providers deferred: upstream gives
  them no developer-instructions surface (Claude uses a preset).
- **MLT-49** board drag-and-drop: @dnd-kit pointer drag (6px activation,
  upstream's own convention), drop = the same guarded `moveIssueTo` as
  Shift+arrows — ready-gate dialog confirmed firing on a live drop into
  Ready; browser-verified end-to-end on the real board.
- **MLT-46** actionable run links: thread refs resolve their environment
  from loaded thread shells, render the thread title, navigate to the
  thread view; stale refs toast; worktree paths copy on click —
  browser-verified.

**Gate:** merged `upstream/main` mid-landing (it had moved — mobile/thread
work, no tracker collision, clean merge); after merge: `vp check` 0 errors,
repo typecheck clean, 79 core + 22 server + mount-point tests green.

**For the human reviewer:** 8 issues sit in needs_review with proofs
(MLT-41/46/49/52/53/55/56/59). Also in triage awaiting you: MLT-40
(license, D2), MLT-57 (commit↔issue linking — needs a spec; its dupe
MLT-58 is resolved), MLT-60 (triage agent — wants Phase 3 dispatch),
MLT-63/64 (your own UI filings). Benign artifacts of live verification:
extra human `status.changed` round-trips on MLT-57's activity and a test
worktree link on cancelled MLT-42.

**Handoff:** Phase 3 stays gated on upstream #2829 (still an open draft —
re-verify at next session start). Next session: either run Prompt 3's gate
again, or pick further unblocked quick wins (MLT-48 display options and
MLT-63 real-time updates are the largest of the remaining independent
items). Working the board as an agent works well through the core command
surface; the MCP stdio server is the sanctioned path for out-of-repo
sessions.

### 2026-07-04 — Quick-win batch between Phase 2 and Phase 3 (planning entry, superseded by COMPLETE above)

**Verification at start (§0.2):** Prompt 3's timing gate is CLOSED — upstream
PR #2829 (orchestration V2) is still an open draft (`state: OPEN, isDraft:
true`, base `main`, head `t3code/codex-turn-mapping`; checked via `gh` this
session). Per the human's explicit instruction, this session does NOT build
Phase 3; instead it works a batch of unblocked quick wins from the tracker.

**Slate (chosen from triage + backlog; all independent, none blocked):**

1. MLT-55 — issue detail route accepts short-ids (core `resolveIssueId` exists)
2. MLT-59 — `ml_list_issues` MCP read/filter tool over `TrackerStore.listIssues`
3. MLT-52 — share one TrackerStore between HTTP routes and hosted MCP
4. MLT-41 — tracker DB open failure degrades to 503, never kills server boot
5. MLT-53 — `cost.recorded` projection (projection schema v3, drop-and-replay)
6. MLT-56 — developer-instructions mount point steering sessions to `ml_*`
7. MLT-49 — board drag-and-drop via @dnd-kit (drop = same `status.change`)
8. MLT-46 — clickable run links (stretch; may not land)

Skipped deliberately: MLT-40 (license — human decision), MLT-57 (needs a spec),
MLT-50 (human said live with it first), MLT-48/MLT-60 (too large for this pass;
MLT-60 wants Phase 3 dispatch machinery).

**Method:** every fix goes through the tracker as an agent actor (claim →
in_progress → proof → needs_review) via the core command surface — same
enforcement path as MCP. One coherent commit per issue; `vp check` +
typecheck + tests before each lands. Issues missing acceptance-criteria
sections get them added (agent description edits are allowed; the ready gate
checks content, not authorship). End: land the plane per §0.

### 2026-07-04 — Phase 2: agent hands (COMPLETE)

**Done — acceptance checklist (03-PHASE-2):** all items pass.

- Scripted E2E walkthrough: `packages/multilinear-server/src/mcp/walkthrough.ts`
  (real MCP stdio client, throwaway DB, asserts the two required rejections,
  verifies the event log) — executed, passing. **Live version also executed:**
  a headless raw Claude Code session in a scratch repo completed the full
  cycle (list ready → claim → in_progress → done attempt REJECTED →
  needs_review-without-proof REJECTED → proof → needs_review →
  discovered_from follow-up), quoting both rejections verbatim. Documented in
  `docs/multilinear-agent-walkthrough.md`.
- Whitelist enforced in `multilinear-core` `decide()` keyed on `actor.kind`,
  proven by tests: the four allowed transitions, the `done` ban for
  agent/rule/system (incl. `needs_review→done`), cancelled ban, backwards
  moves, Ready gate (agents hard-blocked, humans soft-warned), proof-required
  with staleness (re-entering in_progress invalidates old proofs), duplicate
  moves as proposals only + human-only `duplicate.resolve`. 77 core tests,
  19 server tests.
- Agent Blocked: `input.request` (agent-only) posts the question as a comment
  and flags the issue; cleared by a human comment or any status change.
  Badge + header filter browser-verified live on the real board.
- Profiles: loader with yaml frontmatter + schema validation + fs-watch hot
  reload; bad frontmatter is an error entry + error log (never a silent
  skip); name/filename mismatch and empty body rejected; three starters
  (implementer / bug-fixer / spike) in `.multilinear/profiles/`, all loading
  clean. Trust tiers + allowed_transitions recorded and surfaced (profiles
  can only narrow the whitelist, never widen — core is the hard boundary).
- Proof-of-work renders as a distinct card interleaved in the issue thread
  and as activity-feed entries — browser-verified; convention documented in
  `docs/proof-of-work.md` (publishable).
- Secret scan (invariant 5) over agent comments/questions/proofs/cost notes,
  reject-before-persist, unit + integration tests incl. nested proof fields
  and the human-exempt rule.
- MCP server: 8 `ml_*` tools from one effect Toolkit; standalone stdio entry
  first-class (used for all dogfooding this session); hosted registration on
  upstream's `/mcp` (new mount point in `McpHttpServer.ts`, logged — 7 rows
  total, checker green). Context pack v2 (profile template wrap + compacted
  discussion) with a profile picker in the UI.
- Projection schema v2 with `user_version`-gated drop-and-replay migration
  (tested); real DB migrated and rebuilt (53→56 issues by session end).
- Gate: `vp check` 0 errors; repo-wide typecheck green; 77 + 19 + 124 tests
  green; mount audit vs `upstream/main` shows only logged mount points;
  merge `upstream/main` no-op (0 behind at start and end).

**Dogfooding:** MLT-33 claimed (agent comment + ready→in_progress) at session
start and moved to needs_review via our own MCP server with a real proof at
the end. Follow-ups filed through the MCP with `discovered_from` MLT-33:
MLT-51 (per-space repo mapping for profiles), MLT-52 (share one TrackerStore
between routes and MCP), MLT-53 (cost projection for Phase 3), MLT-55
(detail route should accept short-ids — found during live UI verification).
MLT-54 is the cancelled UI-verification scratch issue.

**Decisions this session:** D18–D23 (table above).

**Division of labor:** core/MCP/profiles + all safety-critical validation and
tests inline; web UI delegated to an opus-4.8 subagent against a written spec
(reviewed — clean, one benign lint refactor outside its scope kept); browser
verification delegated to a sonnet subagent driving Chrome (all 12 checks
pass, no console errors).

**Notes:** the dev server must be restarted after pulling this phase (server
code changed; the DB migrates itself on first open). The old
`resolveMultilinearDbPath` moved from the adapter to
`@multilinear/server/db-path` — the adapter re-exports it.

**Handoff:** Phase 2 is done and CI-green. Next session runs Prompt 3
(`PROMPTS.md`) against `multilinear-plan/04-PHASE-3-POLICY-BRAIN.md` — but its
FIRST ACTION is the timing gate: verify upstream PR #2829 (orchestration V2)
has merged to main; as of 2026-07-04 it is still an open draft, so expect to
stop and land unless the human has said otherwise. Practical notes: dispatch
should reuse the MCP/store surfaces built here (`ml_list_ready` semantics =
`listReadyIssues`); the context-pack compiler accepts a profile
(`buildContextPack(detail, { profile })`); trust-tier enforcement beyond
recording is Phase 4. MLT-34 (Phase 3) is chained `blocked_by` MLT-33, which
now sits in needs_review — the human should review and close MLT-33 first.

### 2026-07-04 — Phase 2: agent hands (planning entry)

**Verification at start (§0.2):** `upstream/main` unchanged since Phase 1
(0 behind; tip is still #3670 — mobile/thread work, no work-item queue; tripwire
clear). PR #2829 still an open draft against main (watchlist unchanged; Phase 3
gate still closed — irrelevant to this phase). MLT-33 confirmed in Ready.
Codebase recon: upstream hosts an MCP server at `/mcp` via effect's
`McpServer.layerHttp` with per-provider-session bearer credentials
(`McpSessionRegistry`) injected into every t3code agent session; effect also
ships `McpServer.layerStdio` — so both spec'd transports come from the same
toolkit definition. `yaml@^2.9.0` already in the pnpm catalog (used by
`@t3tools/shared`).

**Plan (ordered; core safety work inline per AGENTS.md division of labor,
web UI delegated to an opus-4.8 subagent against a written spec, as Phase 1):**

1. Claim MLT-33: comment + `ready→in_progress` as an agent actor (dogfood).
2. `@multilinear/core` — the safety layer (tests land with each piece):
   - New schemas: `ProofOfWork` (summary, not_done, diff_stat, tests, risks,
     followups_filed, cost), `WorkflowProfile` (frontmatter shape + trust
     tiers + allowed_transitions), ready-gate lint (`ReadyGate.ts`, browser-
     safe so the web UI reuses it), `SecretScan.ts` (pattern list + scanner).
   - New events: `proof.attached`, `input.requested` (Agent Blocked),
     `duplicate.proposed`, `duplicate.resolved`, `cost.recorded`.
   - New commands: `proof.attach`, `input.request`, `duplicate.resolve`
     (human-only), `cost.log`.
   - Transition whitelist in `decide()` keyed on `actor.kind === "agent"`:
     allowed `triage→backlog`, `backlog→ready` (ready-gate enforced),
     `ready→in_progress`, `in_progress→needs_review` (proof required since
     entering in_progress); agent `→duplicate` becomes a `duplicate.proposed`
     flag, never a status change; everything else rejected server-side —
     including the standing `done` ban for all non-human actors.
   - Secret-pattern scan over agent comments/questions/proofs in `decide()`
     (reject before persisting — invariant 5).
   - Projections: `proofs` table; `issues` gains `agent_blocked`,
     `pending_duplicate_status_id`, `in_progress_since_event`. Projection
     schema versioning via `PRAGMA user_version`: on mismatch, drop projection
     tables and replay the event log (projections are disposable; the events
     table never changes shape).
   - Store queries: `listReadyIssues` (ready + no open blockers),
     short-id → issue resolution for MCP ergonomics.
3. Context pack v2 (`ContextPack.ts`): profile prompt body + issue +
   relations + compacted discussion (last N verbatim, one-liners for older).
4. `Api.ts`: new queries (`issues.ready`, `profiles.list`), `IssueSummary`/
   `IssueFilter`/`IssueDetail` extensions (agentBlocked, pendingDuplicate,
   proofs).
5. Workflow profiles v0 (`@multilinear/server`): loader for
   `<repo>/.multilinear/profiles/*.md` (yaml frontmatter, schema validation,
   fs-watch hot reload, loud failures) + three starters (implementer,
   bug-fixer, spike) written into this repo's `.multilinear/profiles/`.
6. MCP server (`@multilinear/server/src/mcp/`): toolkit with the eight `ml_*`
   tools; actor identity behind a small `MultilinearMcpActor` service;
   standalone stdio entry point (first-class: env/flag actor identity,
   same `~/.multilinear/tracker.db`, WAL busy-timeout for cross-process use);
   hosted registration exported for the adapter.
7. Adapter + mount point: register the toolkit into upstream's `/mcp` server
   (edit in `apps/server/src/mcp/McpHttpServer.ts`, logged in MOUNTPOINTS.md);
   actor = `t3code:thread/<threadId>` from `McpInvocationContext`; share one
   `TrackerStore` layer between routes and MCP.
8. Web UI (delegated, then reviewed): Agent Blocked badge + filter, pending-
   duplicate badge + human confirm/reject, proof rendering in thread +
   activity feed, ready-gate warning dialog on human moves, context-pack v2
   with profile picker, issue template affordance.
9. Docs: `docs/proof-of-work.md` (publishable convention) + the scripted
   end-to-end walkthrough under `docs/`, executed for real (scratch repo, raw
   Claude Code session against the stdio server).
10. Acceptance pass: checklist re-read, `vp check` + typecheck + tests, mount
    audit vs `upstream/main`, merge upstream (expected no-op), CI green; land
    the plane — attach proof to MLT-33 and move it to `needs_review` via our
    own MCP server.

Self-review against 01 §7: all new code in our packages/dirs; one new mount
point planned (McpHttpServer.ts, logged); no upstream migrations; whitelist +
done-ban + secret scan enforced in core command validation keyed on actor kind
(invariants 2, 3, 5); core still imports zero t3code (invariant 7). ✓

**Done — acceptance checklist (02-PHASE-1):** all items pass.

- Create/edit/move issues across all seeded statuses; comments; labels;
  priorities; all six relation kinds incl. `discovered_from` — core-enforced
  (33 core tests) and exercised live in the UI.
- Board / list / triage / detail views feel native (upstream UI kit,
  settings-page visual language); keyboard-first: `c` capture, Enter open,
  arrows move selection, Shift+arrows move an issue between categories.
- Activity feed renders straight from the event log with true actors — seeded
  events show `system:phase1-seed`, live edits show `human:deondejongh`,
  agent-actor test coverage in core.
- Export → fresh store → import → identical projections + byte-identical
  re-export, proven by test; rebuild determinism proven by test; the human-only
  `done` invariant proven by test (agent actor rejected server-side).
- Context-pack button produces the spec §D pack (verified against clipboard
  contents); draft-composer prefill implemented via `useHandleNewThread` +
  `composerDraftStore.setPrompt`, clipboard fallback verified live (no upstream
  project existed in the test env). Run link attach verified (event + feed).
- Seed script ran against the real DB: **40 issues in space MLT** (31 parking-lot
  ideas, 3 phase issues chained `blocked_by`, 4 Phase-4 children via `parent`,
  license decision in triage). 100 events at seed time.
- `git diff upstream/main`: only the 4 logged Phase-1 mount points touch
  upstream files (7 lines total); checker passes with 6 rows (2 pre-existing).
- `vp check` 0 errors; repo-wide typecheck green; 45 multilinear tests +
  124 scripts tests green; merge `upstream/main` = "Already up to date".
- 200-issue jank check: synthetic SBX space in a throwaway DB
  (`MULTILINEAR_DB_PATH` override), board renders/scrolls/navigates instantly.

**Decisions this session:** D11–D17 (recorded at session start, below) plus:
adapter maps the authenticated session to actor `{kind: "human", id: <os
username>}` for Phase 1 (single user; revisit when sessions carry identity);
read scope for queries, operate scope for commands, mirroring upstream's raw
routes.

**Follow-ups:** filed in the tracker (dogfooding starts now): MLT-41 "Tracker
HTTP routes should degrade gracefully if the DB fails to open" — currently the
adapter layer fails server boot if `~/.multilinear/tracker.db` can't open.

**Notes for the merge cadence:** `apps/web/src/routeTree.gen.ts` is generated —
on upstream conflicts, take theirs and re-run the web dev server once to
regenerate (our routes reappear automatically). Same for `pnpm-lock.yaml`
(reinstall). The UI build-out was delegated to an opus-4.8 subagent against a
written spec (per AGENTS.md division of labor); reviewed, one bug class fixed
(detail sections didn't refetch after label/relation/run-link mutations).

**Handoff:** Phase 1 is done and CI-green. Next session runs Prompt 2
(`PROMPTS.md`) against `multilinear-plan/03-PHASE-2-AGENT-HANDS.md` in a fresh
session. Practical notes: the tracker's write path is
`TrackerStore.execute(command, actor)` in `packages/multilinear-core/src/Store.ts`
— Phase 2's transition whitelist belongs in `decide()` next to the existing
human-only `done` guard, keyed on `actor.kind` (the pattern is already proven
by tests). The MCP server should live in `packages/multilinear-server` beside
the router and reuse the same store service; the adapter
(`apps/server/src/multilinear/adapter.ts`) is the only file allowed to touch
upstream internals, and MOUNTPOINTS.md has budget headroom (Phase 1 used its
4). The seed left Phase 2's issue (MLT-33) in Ready — claim it when you start.

### 2026-07-04 — Phase 1: the board (planning entry, superseded by COMPLETE above)

**Verification at start (§0.2):** `upstream/main` unchanged since Phase 0's merge
(`multilinear-main` 7 ahead / 0 behind) — end-of-phase merge-guard proof should be
trivial. Tripwire check: newest upstream commits are mobile/thread work (#3670
"pending tasks" = threads, not a work-item queue) — no tracker collision. Codebase
recon done (WS RPC shape, HTTP router, auth, web routing/UI kit/composer-draft
store, SQLite stack) — findings baked into the decisions below.

**Plan (ordered):**

1. `packages/multilinear-core` — event-sourced domain, zero t3code imports:
   ULID module; Schema entities (Space, Issue, Status, Label, Comment, Relation,
   RunLink, Profile stub); commands → validated events → SQLite append →
   projections; `rebuild`; JSONL `export`/`import`; queries (board/list/triage/
   detail/activity). Tests: command validation (incl. the human-only `done`
   invariant), projection correctness, rebuild determinism, export→import
   round-trip. Storage: `node:sqlite` `DatabaseSync` behind an Effect service.
2. `packages/multilinear-server` — HTTP surface (imports only effect + core):
   `POST /api/multilinear/command`, `POST /api/multilinear/query`, export/import
   endpoints; Schema-validated tagged unions.
3. `apps/server/src/multilinear/adapter.ts` (new file, the single
   upstream-importing module per 01 §1.3): wires EnvironmentAuth + data dir into
   our router layer. Mount: register layer in `server.ts` `makeRoutesLayer`.
4. `apps/web/src/multilinear/` + routes `multilinear.tsx` /
   `multilinear.index.tsx` (board+list) / `multilinear.triage.tsx` /
   `multilinear.issue.$issueId.tsx`: API client over the authed primary HTTP
   layer, Zustand store, board/list/triage/detail/quick-capture, view-local
   keyboard handling (`c`, `enter`, arrows), upstream UI kit read-only,
   `ChatMarkdown` for descriptions. Activity feed rendered from the event log.
5. Context-pack button: compile pack per 02 §D → `useNewThreadHandler()` +
   `composerDraftStore.setPrompt(draftId, pack)` (client-side prefill), with
   copy-to-clipboard fallback; manual run-link attach on the issue.
6. Seed script (`scripts/multilinear/seed.ts`): parse `06-FUTURE-IDEAS.md` +
   phase specs' open items → issues in the `multilinear` space; run it.
7. Acceptance pass: checklist re-read, `vp check` + typecheck + all tests,
   `git diff upstream/main --stat` mount audit, merge `upstream/main`, CI green,
   200-issue jank check, land the plane.

Self-review against 01 §7: all code in new files/packages; 4 mount points (see
below), no upstream migrations, core imports nothing from t3code; `done`
transitions gated on human actor in core command validation (not UI). ✓

**Mount points planned (≤4, logged in MOUNTPOINTS.md as they land):**

1. `apps/server/src/server.ts` — import + register multilinear route layer.
2. `apps/server/package.json` — workspace deps on our two packages.
3. `apps/web/package.json` — workspace dep on `@multilinear/core`.
4. `apps/web/src/components/Sidebar.tsx` — nav entry for `/multilinear`.

Generated files that will also change (not mount points, noted for merge
hygiene): `apps/web/src/routeTree.gen.ts` (TanStack route generator picks up our
new route files), `pnpm-lock.yaml` (real dependency additions only).

**Decisions this session (appended to Decisions table as D11–D17).**

### 2026-07-04 — Phase 0: fork scaffolding (COMPLETE)

**Verification at start (§0.2):** `upstream` remote already points at
`pingdotgg/t3code` and is fetched; local `main` == `upstream/main` exactly
(pristine mirror ✓); `multilinear-main` exists, is pushed to origin, and is 3
commits ahead / 0 behind upstream (`be2d5e6` plan pack, `ef811a72` CLAUDE.md
symlink, `c2bf1f3d` AGENTS.md model guidance). So mission items 1–3 were done
before this session; the merge in item 6 will be an "already up to date" no-op.
Upstream CI runs on Blacksmith runners, which don't exist on a personal fork —
our merge-guard workflow must use GitHub-hosted runners.

**Plan (ordered):**

1. `MOUNTPOINTS.md` at repo root: header, reference-format legend, table
   (file · lines · purpose · date). Seed it with the two pre-existing human
   edits to upstream files (AGENTS.md section, CLAUDE.md symlink) rather than
   starting empty — see decision D7 below.
2. `scripts/multilinear/check-mountpoints.ts` — parses the MOUNTPOINTS table,
   fails if a file is missing, a line reference exceeds the file, or an anchor
   substring is gone. Dependency-free (node:fs) so it runs via plain `node`.
   Unit tests alongside in `check-mountpoints.test.ts` (vitest, same harness as
   the rest of `@t3tools/scripts`) — this doubles as the placeholder test
   target until `packages/multilinear-core` exists (Phase 1).
3. `.github/workflows/multilinear-merge-guard.yml` — runs on pushes to
   `multilinear-main` and `upstream-merge/**` (plus manual dispatch): setup-vp
   install, `vp check`, `vpr typecheck`, scripts-package tests, mount-point
   check. `ubuntu-latest`.
4. Local gate: `vp check` + `vp run typecheck` + scripts tests green.
5. Commit, merge `upstream/main` (expected no-op), push, confirm the workflow
   is green on origin.
6. Land the plane: finalize this entry, final commit.

Self-review against 01 §7: everything is new files — zero new mount points;
no upstream migrations touched; additive only. ✓

**Done (all six mission items):** 1–3 verified pre-existing (see above).
4: `MOUNTPOINTS.md` created, seeded with the two pre-existing edits (D7).
5: `scripts/multilinear/check-mountpoints.ts` + unit tests (pure parse/verify,
Effect-idiomatic I/O — the repo's tsgo rules ban `node:fs`/`node:path`/plain
`console`/untagged `Error`, so the checker uses `FileSystem`/`Path`/`Console`
services and a `Schema.TaggedErrorClass`); failure path proven locally (stale
entry → exit 1). `.github/workflows/multilinear-merge-guard.yml` runs install,
`vp check`, `vpr typecheck`, scripts-package tests, and the mount-point check
(D8). 6: `git merge upstream/main` → "Already up to date"; pushed; **CI green**
(run 28707783742, all steps ✓). Local gate green: `vp check` 0 errors,
`vp run typecheck` clean, 124/124 scripts tests pass.

**Notes:** the plan pack markdown predated `vp check`'s formatting gate and was
reformatted by `vp fmt` (formatting only, no content changes). A local
`pnpm install` produced 540 lines of peer-resolution churn in `pnpm-lock.yaml`
with no version changes — reverted, do not commit lockfile noise (upstream owns
that file). The 27 `vp check` warnings are pre-existing upstream lint warnings.

**Handoff:** Phase 0 is done; next session runs Prompt 1 (`PROMPTS.md`) against
`multilinear-plan/02-PHASE-1-BOARD.md`. Practical notes for it: prefer
backtick-quoted anchors over line numbers in MOUNTPOINTS.md (they survive
upstream line drift); the merge-guard workflow already covers
`upstream-merge/**` branches for the weekly merge cadence; when
`packages/multilinear-core` exists, point the workflow's "Multilinear tests"
step at it (currently `@t3tools/scripts`, which hosts the checker).

### 2026-07-04 — naming (chat, no code)

D1 resolved: **multilinear** (D3, D4, D6 resolved alongside). Name propagated
through the entire pack: folder → `multilinear-plan/`, packages →
`multilinear-core`/`multilinear-server`, dirs → `~/.multilinear/` and
`<repo>/.multilinear/`, branch → `multilinear-main`, routes → `/multilinear`,
MCP tools → `ml_*`, CLI → `multilinear` (alias `ml`). Generic prose uses of
"tracker" (the product category) intentionally retained.

### 2026-07-04 — audit pass (chat, no code)

Full-thread coverage audit against the pack. 14 gaps found and patched: sidecar
rationale + fork carrying cost (01); fork etiquette (00); multi-repo elicitation +
subagent black-box note (04); manual rule trigger + UI-editor-over-files (05);
janitor pack, Method doc, observability snapshot, code-level malleability,
protocol watch, area-label serialization, expanded inspiration atlas (06).
Pack now considered a complete capture of the planning thread.

### 2026-07-04 — planning (chat, no code)

Full design session distilled into this pack. Collision recon done against
upstream (#2829/#3638/#3670 + main tarball). Next action: run Prompt 0.

_(new entries above this line, newest first: date · phase · done / not-done ·
decisions · questions · handoff paragraph)_
