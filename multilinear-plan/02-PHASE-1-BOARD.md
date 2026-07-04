# 02 — Phase 1: the board

**Goal:** a usable local issue tracker inside the fork — event-sourced core, board
UI, and a "start agent from issue" button that pre-fills a t3code thread. Zero
orchestration. Genuinely useful on day one; the backlog moves into it (dogfooding).

**Prerequisite:** Phase 0 complete (fork scaffolding — see `PROMPTS.md` Prompt 0).

## In scope

### A. `packages/multilinear-core`

- Event log + projections per `01-ARCHITECTURE §3–4`: commands → validated events →
  SQLite append → projections. Include `rebuild` (replay events → projections) and
  `export`/`import` (JSONL event log) as CLI-callable functions.
- Entities: Space, Issue, Status (seeded 1:1 with categories), Label, Comment,
  Relation (all six relation kinds, `discovered_from` included), RunLink
  (external refs: t3code thread id, worktree path, PR URL — stored as opaque
  strings; no upstream imports).
- Unit tests: command validation, projection correctness, rebuild determinism,
  export→import round-trip.

### B. Server integration (`packages/multilinear-server` + mounts)

- Expose tracker commands/queries to the web app. DISCOVER: smallest-mount option
  between their WS RPC registration pattern and a namespaced HTTP surface.
- Mount points ≤4, all logged in `MOUNTPOINTS.md`.

### C. Web UI (`apps/web` — new files only)

- `/multilinear` — board view grouped by status (columns follow category order), plus a
  list view; filter by space and label; keyboard-first (`c` = create issue, `enter`
  = open, arrows to move — mirror upstream's keybinding conventions).
- `/multilinear/issue/$id` — detail: markdown description, comments, labels, priority,
  relations (add/remove), run links (manual add: paste thread id / worktree path /
  PR URL), and an **activity feed rendered straight from the event log**.
- Triage view — every issue in `triage` category across all spaces (the unified
  inbox; this is the multi-space payoff).
- Quick capture from anywhere in the tracker routes (modal, `c`).
- Visual language: reuse upstream UI kit read-only; must look native.

### D. Context-pack button ("Start agent from issue")

- Button on issue detail compiles a markdown **context pack**:

  ```
  # Issue {short-id}: {title}
  Space: {space} · Priority: {P} · Labels: {labels}
  ## Description
  {description}
  ## Relevant relations
  {blocks / blocked_by / parent / discovered_from — titles + short-ids}
  ## Recent discussion
  {last N comments, newest last}
  ## Instructions
  Work only on this issue. When done, summarize what you did and what you did
  not do. File any discovered follow-up work as a note at the end.
  ```

- DISCOVER: cheapest additive way to open a new t3code thread with the composer
  pre-filled (client-side navigation/state). Acceptable fallback for Phase 1:
  copy-pack-to-clipboard + open new-thread view. Record a run link on the issue
  either way (manual paste is fine this phase).

### E. Seeding (dogfood moment)

- A `seed` script that imports `06-FUTURE-IDEAS.md` entries and the phase specs'
  open items as issues (spaces: `multilinear` for the project itself), so the project's
  backlog lives in the project from day one.

## Out of scope (do not build yet)

MCP server; any dispatching; rules; schedules; GitHub sync; status/label
customization UI; idea-issue special behavior (the `type` field exists, the
behavior doesn't); mobile; multi-user anything.

## Acceptance criteria

- [ ] Create/edit/move issues across all seeded statuses; comments; labels;
      priorities; all relation kinds including `discovered_from`.
- [ ] Board, list, triage, and detail views work and feel native; keyboard-first
      create/open works.
- [ ] Activity feed shows the true event history including actor.
- [ ] Export → wipe DB → import → identical projections (test proves it).
- [ ] Context-pack button produces the pack and lands it in a new-thread composer
      (or clipboard fallback), and a run link can be attached to the issue.
- [ ] Seed script has populated the real backlog.
- [ ] `MOUNTPOINTS.md` lists every upstream edit (≤4) and nothing else changed —
      verify with `git diff upstream/main --stat`.
- [ ] Build + all tests green; then merge latest `upstream/main` into the branch
      and everything is still green (merge-guard proof).
- [ ] Usable with 200 seeded issues without jank.
