# 00 — Vision

## Identity

A **local-first issue tracker where AI agents are first-class assignees**, built as
an additive layer on a fork of t3code. For solo builders (a "team of one to five",
where agents outnumber humans). You manage the board; agents work the cards; every
event is a permanent, queryable log on your own machine.

Name: **multilinear** — tongue-in-cheek homage ("Linear, for many"), with a real
mathematical meaning that happens to fit: a multilinear map is linear in each of
several arguments separately — *linear in every agent*. Chosen knowingly for a
personal OSS repo; rename-if-it-gains-traction is the standing plan (STATUS D1).

## The three-box model

1. **Tracker (we build this):** the durable work graph. Issues, states, relations,
   comments, review gates, rules. The memory and the whiteboard.
2. **Policy brain (we build this):** decides *what* gets dispatched, *when*, within
   *which* caps and budgets, and routes outcomes back into issue state.
3. **Execution engine (t3code owns this — never rebuild it):** threads, runs,
   worktrees, providers, forks, subagents, scheduling. Upstream is investing heavily
   here (orchestration V2 + scheduled tasks); we delegate downward and ride it.

## Worldview (the beliefs behind the design)

- **Local-first.** Your data is a file you can leave with. Own SQLite, JSONL export,
  no cloud dependency, no telemetry by default. (Lineage: Ink & Switch local-first.)
- **Event-sourced diary, not a whiteboard.** Never overwrite state; append events and
  project. This buys the activity feed, audit trail, rule triggers, back-testing, and
  (someday) multiplayer merging — all from one decision.
- **Agents act, humans are accountable.** Issues are *assigned* to the human and
  *delegated* to agent profiles (Linear's delegation taxonomy: "an agent cannot be
  held accountable"). Nothing enters Done without a human.
- **Review capacity is the real bottleneck.** With agents, execution is cheap; the
  human's review throughput is the constraint. WIP limits protect it.
- **Config is files; conversation is the editor.** Statuses, labels, profiles, and
  rules live as schema-validated files in repos — so a "configurer agent" can reshape
  the workspace safely, and configurations are shareable (Home Assistant blueprints
  are the role model).
- **Spec-quality in, quality out.** The "Ready" state is a contract: specified well
  enough for an agent to pick up. The Ready gate is the highest-leverage quality
  lever in the system.
- **Proof of work.** Agent handoffs carry evidence: summary, diff stats, test
  results, cost. (Lineage: OpenAI Symphony.)

## Differentiators (why this is worth open-sourcing with pride)

1. The tracker's **MCP server as a universal adapter** — any agent in any harness is
   a first-class citizen of the board, not a webhook afterthought.
2. **Workflow profiles and rules as shareable, diffable files** (blueprints model).
3. A small, documented **proof-of-work convention** others can adopt.
4. **Back-testing rules against your own event history** ("this rule would have fired
   14 times last month") — no tracker does this.
5. Eventually: **publish our own SPEC.md** so other people's agents can port the idea
   to other frontends. Harness-agnostic core; t3code is the first host, not the identity.
6. **Good-citizen fork etiquette:** gracious attribution, clearly distinct branding,
   a visible "what's upstream vs. ours" note in the README — and if our mount-point
   hooks prove clean and generic, offer them upstream so our diff shrinks toward zero.

## Non-goals (current)

- Not a team SaaS. No seats, no orgs, no RBAC, no cloud sync. (Team-of-few insurance
  is baked into the schema — see `06-FUTURE-IDEAS.md` — but not built.)
- Not an execution engine. No provider adapters, no run retries at the process level,
  no scheduler of our own — upstream owns all of that.
- Not a GitHub replacement. GitHub is a peripheral; the local tracker is the boss.
- Not enterprise anything.

## Strategic posture (as of 2026-07-04)

- **GitHub Agent HQ** normalizes "assign an issue to an agent" for millions — cloud,
  GitHub-centric, subscription-metered. We are the local-first, BYO-harness,
  your-machine complement. Watch their primitives; don't chase their features.
- **Vibe Kanban** (closest sibling) sunset as a company and continues as community
  OSS — the concept is validated, the *startup* isn't. This is a passion OSS project.
- **Beads** (Yegge) is our data-model kin (agent-native, dependency-aware, git-backed).
  We steal: `discovered-from` provenance links, compaction ("memory decay"), and the
  focus on *current* work.
- **t3code upstream** is racing down the execution stack and shows zero movement on
  the planning/memory stack. Perfect complement. Tripwire: if upstream ever grows a
  persistent queue of assignable work items with states, re-evaluate (see Watchlist).
