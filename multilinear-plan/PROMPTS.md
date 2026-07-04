# PROMPTS — kickoff prompts for long-running sessions

How to use: one phase = one fresh Claude Code session in the fork's root. Paste the
phase prompt verbatim (edit the bracketed bits if needed), confirm the plan it
proposes, then walk away. Every prompt binds the agent to the Working Agreement
below. Review the phase against its acceptance checklist before starting the next.

---

## §0 Working Agreement (all sessions)

You are building a long-lived project across many sessions. Follow this exactly.

**Start of session**

1. Read, in order: `multilinear-plan/README.md`, `multilinear-plan/STATUS.md`,
   `00-VISION.md`, `01-ARCHITECTURE.md`, and the phase spec named in your prompt.
2. Verify time-sensitive facts your phase depends on (upstream PR states, branch
   existence). Note verification results in your STATUS session entry.
3. Write a short implementation plan (ordered steps, files you'll create, mount
   points you expect to need) into a new session entry in `STATUS.md`. Self-review
   it against `01-ARCHITECTURE §7` invariants before writing code.

**During** 4. Work in small, coherent commits with conventional messages. Tests land with the
code they test, not at the end. 5. Never edit upstream files except mount points; log each in `MOUNTPOINTS.md`
the moment you make it. If a task seems to need more than a mount point, stop
that task, write it to STATUS → Open questions, continue with other tasks. 6. `DISCOVER:` markers in specs = your judgment. Decide, then record the decision
and rationale in STATUS → Decisions. 7. Spec ambiguity that isn't marked DISCOVER: choose the most reversible
reasonable default, note it in STATUS, keep moving. Do not stall on questions. 8. New dependencies: prefer what the monorepo already uses; record any addition
with rationale in STATUS. 9. Follow-up work you discover: file it as an issue in the tracker with a
`discovered_from` relation (once the tracker exists — Phase 1+); before that,
list it in STATUS → Follow-ups.

**End of session — "land the plane" (mandatory, even if unfinished)** 10. All tests green; build green; `git status` clean. 11. Update `STATUS.md`: what's done vs not (against the acceptance checklist),
decisions made, open questions, and a **handoff paragraph** — the exact prompt
you'd give the next session to continue. 12. Final commit. Stop conditions that trigger landing: acceptance criteria met;
blocked by an invariant; or context/steam running low — land early rather
than degrade.

---

## Prompt 0 — fork scaffolding

```
Read multilinear-plan/PROMPTS.md §0 and follow the Working Agreement for this whole
session. Your phase spec is multilinear-plan/01-ARCHITECTURE.md §1 (fork strategy).

Mission: set up fork hygiene and guardrails. Concretely:
1. Verify this is a clone of my fork of pingdotgg/t3code; add the original repo
   as the `upstream` remote; fetch it.
2. Create the long-lived working branch `multilinear-main` from main. All work
   happens there; local main stays a pristine upstream mirror.
3. Verify the multilinear-plan/ folder is present and committed.
4. Create MOUNTPOINTS.md at repo root with a header explaining its purpose and a
   table (file · lines · purpose · date). It starts empty.
5. Create the merge-guard CI workflow: on pushes to multilinear-main and on
   upstream-merge branches, run install + build + our package tests (scaffold a
   placeholder test target for now) + a script that fails if any MOUNTPOINTS.md
   entry references a file/anchor that no longer exists.
6. Prove the flow: merge upstream/main into multilinear-main (should be a no-op or
   trivial), confirm everything is green.
Definition of done: all six items complete, CI green, STATUS.md updated, plane
landed per §0.
```

## Prompt 1 — Phase 1: the board

```
Read multilinear-plan/PROMPTS.md §0 and follow the Working Agreement for this whole
session. Your phase spec is multilinear-plan/02-PHASE-1-BOARD.md; its acceptance
checklist is your definition of done.

Mission: build Phase 1 completely — multilinear-core (event-sourced domain +
SQLite + export/import + tests), the server integration with minimal mount
points, the web UI (board / list / triage / issue detail / quick capture,
native look, keyboard-first), the context-pack button, and the seed script.
Then run the seed script so the project's backlog lives in the tracker.

Constraints to hold especially tightly: 01-ARCHITECTURE §7 invariants;
multilinear-core imports nothing from t3code; ≤4 mount points, all logged;
vocabulary table in 01 §5 (issues/spaces/rules — never tasks/projects/
automations). Where the spec says DISCOVER, investigate the codebase first and
record your choice.

Work autonomously to completion. If you finish with headroom, do a self-review
pass: re-read the acceptance checklist skeptically, fix gaps, then land the
plane per §0.
```

## Prompt 2 — Phase 2: agent hands

```
Read multilinear-plan/PROMPTS.md §0 and follow the Working Agreement for this whole
session. Your phase spec is multilinear-plan/03-PHASE-2-AGENT-HANDS.md; its
acceptance checklist is your definition of done.

Mission: make agents citizens of the board — the multilinear MCP server (including
the standalone stdio entry point; treat it as first-class), the transition
whitelist enforced server-side with tests, proof-of-work v0 (docs/proof-of-
work.md included), workflow profiles v0 with three starters, the Ready gate
lint, Agent Blocked state, context pack v2, and the secret-pattern scan.

The critical property: safety lives in multilinear-core command validation keyed on
actor kind — never in prompt politeness. Prove the `done` ban and proof-required
rule with tests. Finish by writing and executing the scripted end-to-end
walkthrough from the spec, saving it under docs/. Then land the plane per §0.
```

## Prompt 3 — Phase 3: the policy brain

```
Read multilinear-plan/PROMPTS.md §0 and follow the Working Agreement for this whole
session. Your phase spec is multilinear-plan/04-PHASE-3-POLICY-BRAIN.md; its
acceptance checklist is your definition of done.

FIRST ACTION — the timing gate: verify whether upstream PR #2829 (orchestration
V2) has merged to main and the orchestrator MCP tools (delegate_task /
create_threads) exist in the current codebase. If NOT landed: stop, write your
findings and options to STATUS.md, and end the session — do not build against
the V1 engine. [If I have explicitly told you to build against the
codex-turn-mapping branch anyway, record that instruction in STATUS → Decisions
and proceed knowingly.]

If the gate passes — mission: the dispatcher (claim → context pack → dispatch
via upstream orchestrator MCP through the single adapter module → run link),
the completion loop (agent-signals-primary, watchdog, reconciliation, single
retry), caps and budgets with refuse-with-comment, continuation into the same
thread/worktree, DAG auto-flow, estimates-vs-actuals capture, and the weekly
upstream-recon janitor as an upstream scheduled task calling our MCP.

All upstream interaction goes through the adapter — add the lint/test that
enforces it. Finish with the documented end-to-end demo from the spec, then
land the plane per §0.
```

## Prompt 4 — Phase 4: rules and the world

```
Read multilinear-plan/PROMPTS.md §0 and follow the Working Agreement for this whole
session. Your phase spec is multilinear-plan/05-PHASE-4-RULES-AND-WORLD.md; its
acceptance checklist is your definition of done. The four workstreams (rules,
GitHub sync, idea-issues, configurer) are independently shippable — build in
that order and land each before starting the next.

Highlights to get right: rules bind to categories/labels, never status names;
causation loop-guard, cooldowns, budgets, kill switch, dry-run; back-testing
against the event log is the star feature — build it properly with tests.
GitHub sync is three narrow one-directional flows, polling only, tracker is the
boss, nothing ever posts publicly. Untrusted-origin enforcement is server-side
with tests, and external text is visibly quarantined in context packs. Ship the
starter rules disabled by default. End with the morning-briefing janitor's
first real run, then land the plane per §0.
```
