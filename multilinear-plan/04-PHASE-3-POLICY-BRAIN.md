# 04 — Phase 3: the policy brain

**Goal:** delegation becomes real. Move a card to `ready`, set a delegate profile,
walk away; come back to it in `needs_review` with proof of work. We build the
*decision* layer only — claiming, context, caps, budgets, reconciliation — and
dispatch downward through upstream's execution engine.

## ⛔ Timing gate (check FIRST, every session)
This phase is **gated on upstream PR #2829 (orchestration V2) being merged to
`main`** — it provides the dispatch surface (OrchestratorMcpService:
`delegate_task`, `create_threads`; V2 thread/launch services) and moves state to
`userdata-v2`. At session start: check the PR / release notes / codebase for the
orchestrator MCP tools. If not landed: either stop and report, or (only with
explicit human instruction recorded in STATUS) develop against branch
`t3code/codex-turn-mapping` knowing it's wet paint. Building this phase against the
V1 engine is forbidden — it would be demolished by the cutover.

**Prerequisite:** Phase 2 accepted.

## In scope

### A. Dispatcher (in `multilinear-server`, via the adapter only)
- Watches for issues that are: category `ready` + delegate set + no open blockers
  (event-driven off our own log; a slow poll fallback is acceptable).
- **Claim:** atomic claimed-set in our DB (issue id + dispatch attempt) so nothing
  double-dispatches (Symphony pattern).
- **Dispatch:** assemble context pack v2 → call upstream orchestrator MCP
  (`delegate_task` / `create_threads`) via the adapter, requesting a fresh worktree
  and the profile's provider/model hints → record run link + `run.linked` event →
  transition to `in_progress` (actor: `system`).
- **Multi-repo spaces:** the context pack must pin exactly one repo (from the issue
  or the profile). If ambiguous, never guess — comment the options on the issue and
  set Agent Blocked (Linear's repo-suggestion elicitation pattern).
- **Upstream subagents/forks** inside a run are a black box we never manage:
  surface their lineage in the activity feed and attribute their cost to the issue.
- **Completion loop — primary signal is the agent itself** (Symphony boundary: the
  orchestrator schedules and reads; the *agent* writes to the tracker): the
  dispatched session ends by calling `ml_attach_proof` + `ml_transition
  → needs_review`. The dispatcher's own duties are secondary signals:
  - **Watchdog:** no events from a run for N minutes (configurable, default 30) →
    mark stalled, comment, notify.
  - **Reconciliation:** on every tick, if a dispatched issue left active categories
    (human cancelled/parked it) → stop the run via the adapter (DISCOVER upstream's
    stop/interrupt surface; if none, mark orphaned + comment loudly).
  - **Retry:** run crashed before any proof → one automatic re-dispatch with
    backoff, `attempt` incremented and noted in the context pack; then park in
    `triage` with the error attached. Never retry more than once unattended.

### B. Caps and budgets (refuse-with-comment, never silently queue-jump)
- Global WIP cap (default 2 concurrent dispatches) and per-space cap (default 1).
- Daily dispatch budget (default 10/day) and, if upstream exposes usage, a token
  budget; else count dispatches. All configurable in a `~/.multilinear/config` file.
- When a cap blocks a dispatch: comment on the issue ("queued: WIP cap"), keep it
  claimed-pending, dispatch on next capacity. Surface caps state in the UI.

### C. Continuation
Human reviews in `needs_review`: feedback comment + transition back to
`in_progress` (human actor) → dispatcher sends a **continuation** into the *same*
thread/worktree via the adapter (upstream V2 supports continuation/forks) with a
feedback pack (the review comments since handoff). Same completion loop applies.

### D. DAG auto-flow
When an issue closes, any issue it `blocks` that is otherwise ready becomes
dispatchable automatically (event-driven). This makes planner-decomposed work
self-sequencing.

### E. Estimates vs actuals (data only)
Profiles instruct agents to state an effort/size estimate at claim time
(`ml_comment` structured line); dispatcher records duration + cost at handoff.
Stored as events; a tiny `/multilinear/insights` stub can list them. No fancy UI yet.

### F. First janitor (proves the schedules integration)
Implemented as an **upstream scheduled task** whose prompt calls our MCP: weekly
"upstream recon" — diff t3code's merged PRs/release notes against `MOUNTPOINTS.md`
and `01-ARCHITECTURE §6`, file a `discovered_from`-less issue in the `multilinear`
space when something drifts. (Spec the prompt in `docs/janitors/upstream-recon.md`.)

## Out of scope
Event-triggered rules engine (Phase 4), GitHub sync, tournament mode (multiple
delegates on one issue — backlog), idea-issue behavior, calendar.

## Acceptance criteria
- [ ] E2E demo, documented + repeatable: `ready` + delegate → auto-dispatch into a
      worktree → agent completes → card in `needs_review` with proof; total human
      touches: 1 (the delegation) + 1 (the review).
- [ ] Cancel a card mid-run → run stops (or orphan path fires loudly).
- [ ] WIP cap 1: second delegated card visibly queues, dispatches when first lands.
- [ ] Crash-retry works once, then parks in triage with the error.
- [ ] Continuation reuses the same thread/worktree, verified.
- [ ] DAG auto-flow: closing a blocker dispatches the dependent.
- [ ] The upstream-recon janitor exists as a scheduled task and has produced at
      least one real run.
- [ ] All upstream interaction goes through the adapter module — enforced by a lint
      or test (grep-based is fine).
