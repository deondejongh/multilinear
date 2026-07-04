# STATUS — living memory

> Agents: read this at session start; update it before session end (Working
> Agreement §0). Humans: this is the project's single source of "where are we".

**Last updated:** 2026-07-04 (Phase 0 complete — fork scaffolding + merge guard)
**Current phase:** 0 done; next up Phase 1 (the board)

## Phase checklist

- [x] Phase 0 — fork scaffolding (2026-07-04, CI green)
- [ ] Phase 1 — the board
- [ ] Phase 2 — agent hands (MCP)
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

### 2026-07-04 — Phase 1: the board (IN PROGRESS)

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
