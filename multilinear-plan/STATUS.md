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

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                           | Status                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| D1  | Project name: **multilinear**. Tongue-in-cheek Linear homage + the maths meaning (linear in each argument → "linear in every agent"). Collision check 2026-07-04: no npm package or notable repo owns the bare name. Standing plan: rename if it ever gains real traction (trademark-adjacency + SEO vs. the maths field). TODO today: grab the GitHub repo name; npm scope when packages publish. | **RESOLVED 2026-07-04**                        |
| D2  | License. Leaning MIT (matches upstream, maximizes adoption); AGPL considered to deter cloud clones. Decide before first outside contribution.                                                                                                                                                                                                                                                      | OPEN — human                                   |
| D3  | Data directory: `~/.multilinear/`. Outside upstream's state dirs.                                                                                                                                                                                                                                                                                                                                  | RESOLVED 2026-07-04                            |
| D4  | Working branch: `multilinear-main`.                                                                                                                                                                                                                                                                                                                                                                | RESOLVED 2026-07-04                            |
| D6  | MCP tool prefix `ml_` (e.g. `ml_list_ready`) for token economy — the server registers as `multilinear`, so namespacing disambiguates from machine-learning. CLI alias `ml`. Veto by find-replace if it reads badly in practice.                                                                                                                                                                    | RESOLVED 2026-07-04 (default — human may veto) |
| D7  | 2026-07-04. `MOUNTPOINTS.md` seeded with the two pre-existing human edits to upstream files (AGENTS.md model-selection section, CLAUDE.md→AGENTS.md symlink) instead of starting empty as Prompt 0 said: the guard's job is merge safety and those edits are real conflict surface; it also exercises the checker with real rows from day one.                                                     | RESOLVED (agent)                               |
| D8  | 2026-07-04. Merge-guard CI runs on `ubuntu-latest` (upstream's Blacksmith runners don't exist on a personal fork). "Build" = `vp check` + repo-wide `vpr typecheck` — upstream's own Check gate minus the desktop/Electron steps, which need Electron downloads and Blacksmith-scale runners. Revisit if a real bundle build becomes the better break-detector.                                    | RESOLVED (agent)                               |
| D9  | 2026-07-04. Mount-point references: the Lines column takes `12`/`12-16` (line bound), a backtick-quoted anchor substring, or `—` (existence only). Anchors preferred — they survive upstream line drift.                                                                                                                                                                                           | RESOLVED (agent)                               |
| D10 | 2026-07-04. Phase-0 tooling lives in `scripts/multilinear/` inside `@t3tools/scripts` so it's typechecked/linted/tested by the existing harness; the checker's unit tests are the placeholder test target until `packages/multilinear-core` (Phase 1).                                                                                                                                             | RESOLVED (agent)                               |
| D5+ | (agents append decisions here with date + rationale)                                                                                                                                                                                                                                                                                                                                               | —                                              |

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
