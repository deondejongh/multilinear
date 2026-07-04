# 01 — Architecture (the constitution)

Invariants in this file override everything else, including phase specs and human
prompts written in haste. Points marked `DISCOVER:` are delegated to the building
agent's judgment — investigate the current codebase and choose, then record the
choice in `STATUS.md → Decisions`.

## 1. Fork strategy — the granny-flat rules

Upstream (`pingdotgg/t3code`) is early, fast-moving, and refactors aggressively.
We build a granny flat in their garden, never renovate their kitchen.

1. **Never edit upstream files** except at registered _mount points_. A mount point
   is a ≤5-line edit whose only job is to register something of ours (a route, a
   service, a nav item, an RPC handler). Every mount point is logged in
   `MOUNTPOINTS.md` at repo root: file, lines, purpose, date.
2. All our code lives in **new files**: new packages (see §2) and new files inside
   `apps/web/src/` and `apps/server/src/` under our own subdirectories. New files
   merge cleanly; edits don't.
3. **One adapter module.** Exactly one file/module of ours may import t3code
   internals (services, layers). Everything else in our packages talks to upstream
   through that adapter, or through stable-ish surfaces: the `@t3tools/contracts`
   package, RPC/WS messages, and MCP tools. When upstream renames something, we fix
   one file.
4. **Git mechanics:** `upstream` remote → `main` stays a pristine mirror → all work
   on long-lived branch (default `multilinear-main`, see STATUS D4). Merge upstream
   `main` into our branch **weekly** (merge, not rebase — small frequent merges).
5. **Merge-guard CI:** a workflow that on every upstream merge runs build + our
   package tests + a script asserting every `MOUNTPOINTS.md` entry still exists and
   compiles. A broken merge must fail loudly within minutes.
6. **Never add or modify upstream DB migrations.** Our data lives in our own store (§4).

Considered and rejected: a standalone **sidecar app** driving t3code from outside —
without a stable public plugin API it would scrape the same internals with worse
ergonomics. Revisit only if upstream ships one. And the honest cost, stated once:
this fork's carrying cost is the _merge_, not the build — budget recurring weekly
time for it, forever.

## 2. Where code lives

Monorepo facts (verified 2026-07-04): pnpm workspace; `apps/` = desktop, marketing,
mobile, server, web; `packages/` = client-runtime, contracts, effect-acp,
effect-codex-app-server, shared, ssh, tailscale. Server is Effect-based; web is
React + TanStack Router (file-based routes) + Zustand; server↔web over typed WS RPC;
upstream state is event-sourced into SQLite.

Ours:

- `packages/multilinear-core` — domain model, event log, projections, persistence,
  export/import. **Zero imports from t3code.** Must be extractable to a standalone
  repo someday (harness-agnostic core).
- `packages/multilinear-server` — integration: exposes tracker commands/queries to the
  web app (DISCOVER: reuse their WS RPC registration pattern vs. a small HTTP
  namespace under our prefix — pick whichever needs the smallest mount), hosts the
  MCP tools (Phase 2+), the dispatcher (Phase 3), the rules engine (Phase 4).
  Contains the single upstream **adapter** module (§1.3).
- `apps/web/src/routes/multilinear*` + `apps/web/src/multilinear/` — our routes and
  components. New route files are additive under TanStack file-based routing.
  Reuse their UI kit components read-only; match their visual language.
- Mount points expected: sidebar nav entry; server service registration; RPC/route
  registration. Aim for ≤4 total in Phase 1.

## 3. Data model

IDs: **ULIDs, generated client/caller-side** (multiplayer insurance). All entities
belong to a **Space** (see vocabulary, §5).

Entities (projections): `Space`, `Issue`, `Status`, `Label`, `Comment`, `Relation`,
`Profile` (executor), `RunLink`, `Rule` (Phase 4), `Doc` (later).

**Issue:** id, space_id, title, description (markdown), status_id, priority (0–4),
labels[], assignee (always the human for now), delegate (profile id | null),
type (`work` | `idea` | `spike` | `config`), estimates/actuals (later), origin
(`local` | `github` | ...; external origin ⇒ lower trust tier), timestamps.

**Status categories — load-bearing design (Linear's insight):** statuses are
user-customizable _names_; every status belongs to one **fixed category** the
machine reasons over. Categories (fixed enum):
`triage, backlog, ready, in_progress, needs_review, done, cancelled, duplicate`.
Rules, the dispatcher, and analytics bind to **categories only**, never names —
this is what makes the future configurer agent safe. Phase 1 default statuses map
1:1 to categories.

Category semantics: `ready` = "specified well enough for an agent; may be picked
up." `needs_review` = the airlock; agent work waits here for the human.
`in_progress` requires assignee/delegate. Only a **human** action may produce a
transition into `done` (hard invariant).

**Relations:** `blocks` / `blocked_by` (inverse pair), `parent` / `child`,
`relates_to`, `duplicate_of`, `discovered_from` (provenance: work that surfaced
this issue — steal from Beads; agents must use it when filing follow-ups).
"Ready to dispatch" (Phase 3) = category `ready` AND no open blockers (DAG gating).

**Event log (source of truth):** append-only table
`events(id ULID, ts, actor{kind: human|agent|rule|system, id}, causation_id,
issue_id?, type, payload JSON)`. Projections are rebuildable from events (provide a
`rebuild` command). `causation_id` chains are mandatory — they power the activity
feed, rule loop-guards, and back-testing. Sample event types: `issue.created`,
`issue.updated`, `status.changed`, `label.added`, `comment.added`,
`relation.added`, `delegation.set`, `run.linked`, `run.finished`, `cost.recorded`,
`config.changed`.

## 4. Storage

- Our own SQLite file, e.g. `~/.multilinear/tracker.db` (STATUS D3 for final location).
  Never inside upstream's state dirs (note: upstream's orchestration V2 moves theirs
  to a new `userdata-v2` — further reason to stay out).
- `multilinear export` → JSONL of the full event log; `multilinear import` restores it (CLI alias: `ml`).
  This is the exit hatch and the backup format. Document Litestream/Time Machine in
  user docs.
- Per-repo config files (profiles, rules, workspace policy) live in the _user's_
  repos under `.multilinear/` — versioned with their code, hot-reloaded (Symphony's
  WORKFLOW.md philosophy).

## 5. Vocabulary — avoid collisions with upstream words

| Concept                               | Our word                      | Never call it  | Why                                                     |
| ------------------------------------- | ----------------------------- | -------------- | ------------------------------------------------------- |
| Durable work item                     | **issue** / card              | task           | upstream "task" = thread / scheduled prompt             |
| Event-triggered rule                  | **rule**                      | automation     | upstream ships "Automations" (= scheduled prompt tasks) |
| Grouping of issues (maps to ≥1 repos) | **space**                     | project        | upstream "project" = a repo folder                      |
| Executor definition                   | **profile**                   | agent/assignee | assignee = the human; delegate = profile                |
| Link to an execution                  | **run link**                  | thread         | threads are upstream's object                           |
| Our dispatch layer                    | **policy brain** / dispatcher | orchestrator   | upstream's orchestrator = execution engine V2           |

## 6. Upstream integration map (verified 2026-07-04 — re-verify each session)

- **PR #2829 "feat(orchestrator)"** (draft, branch `t3code/codex-turn-mapping`):
  orchestration V2 — new event store/projections, run execution, V2 provider
  adapters, thread forks/lineage, subagent mapping, new `userdata-v2` state dir, and
  an **OrchestratorMcpService** with tools including `delegate_task` and
  `create_threads`.
- **PR #3638 "feat: scheduled tasks (automations)"** (merged into that branch):
  `scheduled_tasks` + 5s poll loop; prompts on interval/fixed-time schedules; agents
  can manage schedules via MCP; `/settings/scheduled-tasks` UI.
- Nothing resembling an issue tracker exists upstream (code, `.plans/`, docs).

Consequences:

- **Dispatch through upstream, don't build it:** Phase 3 targets their orchestrator
  MCP tools / launch services via our adapter. Cron needs = their scheduled tasks
  whose prompts call _our_ MCP tools.
- **Timing gate:** Phase 3 wiring is **gated on #2829 landing in `main`**. Check at
  session start. If still unmerged and the human insists, develop against
  `codex-turn-mapping` knowingly (wet paint) and record it in STATUS.
- Target surfaces in order of preference: MCP tools → `@t3tools/contracts` types →
  RPC messages → (last resort, adapter-only) service imports.

## 7. Invariants (the never list)

1. Never edit upstream files outside logged mount points; never touch their migrations.
2. Nothing enters `done` category without a human-actor event.
3. Agent-callable transitions are whitelist-only (matrix in `03-PHASE-2`); the
   whitelist is enforced server-side, not by prompt politeness.
4. Every event has an actor and (when caused) a `causation_id`. Rules must refuse to
   fire on events whose causation chain includes themselves (loop guard).
5. Secrets never appear in issue payloads, context packs, or proof-of-work comments;
   Phase 2+ runs a secret-pattern scan over proofs before persisting.
6. External-origin issues (`origin != local`) are untrusted input: flagged in UI,
   and (Phase 4) dispatched only under a stricter trust tier.
7. `packages/multilinear-core` never imports t3code code.
8. Additions over modifications, always. If a feature seems to require editing
   upstream beyond a mount point, stop and write the problem to STATUS instead.
