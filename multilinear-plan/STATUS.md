# STATUS — living memory

> Agents: read this at session start; update it before session end (Working
> Agreement §0). Humans: this is the project's single source of "where are we".

**Last updated:** 2026-07-04 (planning + audit + naming — no code exists yet)
**Current phase:** 0 (not started)

## Phase checklist

- [ ] Phase 0 — fork scaffolding
- [ ] Phase 1 — the board
- [ ] Phase 2 — agent hands (MCP)
- [ ] Phase 3 — policy brain (⛔ gated on upstream #2829 → main)
- [ ] Phase 4 — rules and the world

## Decisions

| # | Decision | Status |
|---|---|---|
| D1 | Project name: **multilinear**. Tongue-in-cheek Linear homage + the maths meaning (linear in each argument → "linear in every agent"). Collision check 2026-07-04: no npm package or notable repo owns the bare name. Standing plan: rename if it ever gains real traction (trademark-adjacency + SEO vs. the maths field). TODO today: grab the GitHub repo name; npm scope when packages publish. | **RESOLVED 2026-07-04** |
| D2 | License. Leaning MIT (matches upstream, maximizes adoption); AGPL considered to deter cloud clones. Decide before first outside contribution. | OPEN — human |
| D3 | Data directory: `~/.multilinear/`. Outside upstream's state dirs. | RESOLVED 2026-07-04 |
| D4 | Working branch: `multilinear-main`. | RESOLVED 2026-07-04 |
| D6 | MCP tool prefix `ml_` (e.g. `ml_list_ready`) for token economy — the server registers as `multilinear`, so namespacing disambiguates from machine-learning. CLI alias `ml`. Veto by find-replace if it reads badly in practice. | RESOLVED 2026-07-04 (default — human may veto) |
| D5+ | (agents append decisions here with date + rationale) | — |

## Open questions

_(empty — agents append; humans resolve)_

## Follow-ups (pre-tracker only)

_(agents list discovered work here until Phase 1's tracker can hold it)_

## Watchlist (verify before relying; update "last checked")

| Item | State at last check | Last checked |
|---|---|---|
| Upstream PR #2829 (orchestration V2, `delegate_task`/`create_threads` MCP) | Open draft, branch `t3code/codex-turn-mapping`, ~92 commits | 2026-07-04 |
| Upstream PR #3638 (scheduled tasks / "Automations") | Merged into `codex-turn-mapping` (NOT on main) | 2026-07-04 |
| Upstream main | No issue tracker anywhere (code, .plans, docs); "task" = thread; "project" = repo folder | 2026-07-04 |
| Tripwire | Upstream persistent work-item queue *with states* → halt, re-derive collision map (01 §6) | 2026-07-04 |
| Landscape | Agent HQ cadence; Vibe Kanban community fork; Beads/GasTown | 2026-07-04 |

## Session log

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
