# multilinear-plan — hand-off pack

This folder is the complete hand-off from a long planning session (July 2026) to the
agents that will build the project. It is designed to be dropped into the root of a
fork of `pingdotgg/t3code` as a new top-level directory (fully additive — upstream
will never collide with it).

**The project in one sentence:** a local-first issue tracker where AI agents are
first-class assignees — you manage the board, they work the cards, and everything
that happened is a permanent, queryable log on your own machine.

## How to use this pack

1. Fork `pingdotgg/t3code`, clone it, copy this folder into the repo root.
2. Open `PROMPTS.md`. Run **Prompt 0** in a fresh Claude Code session. Walk away.
3. When a phase finishes, review the work, then run the next phase's prompt in a
   fresh session. One phase = one long-running session.
4. `STATUS.md` is the shared memory between sessions. Agents must read it at the
   start of every session and update it at the end ("land the plane").

## Reading order (for agents)

| File                            | What it is                                                                         | Who edits it                             |
| ------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------- |
| `README.md`                     | This map                                                                           | Human only                               |
| `00-VISION.md`                  | Why this exists, worldview, non-goals                                              | Human only                               |
| `01-ARCHITECTURE.md`            | **The constitution.** Fork rules, data model, vocabulary, upstream map, invariants | Human; agents propose changes via STATUS |
| `02-PHASE-1-BOARD.md`           | Spec: the tracker itself                                                           | Human                                    |
| `03-PHASE-2-AGENT-HANDS.md`     | Spec: agents as tracker citizens (MCP)                                             | Human                                    |
| `04-PHASE-3-POLICY-BRAIN.md`    | Spec: dispatch, caps, reconciliation                                               | Human                                    |
| `05-PHASE-4-RULES-AND-WORLD.md` | Spec: rules engine, GitHub sync, ideas, configurer                                 | Human                                    |
| `06-FUTURE-IDEAS.md`            | Parking lot — nothing here is lost                                                 | Anyone (append-only)                     |
| `PROMPTS.md`                    | Kickoff prompts + the Working Agreement                                            | Human                                    |
| `STATUS.md`                     | Living memory: decisions, open questions, watchlist, session log                   | **Agents, every session**                |

## Rules of this folder

- Specs (`0x-*.md`) are contracts. An agent that disagrees with a spec writes the
  objection to `STATUS.md → Open questions` and continues with the spec as written,
  unless the spec itself marks the point as `DISCOVER` (agent's judgment) or the
  conflict is with `01-ARCHITECTURE.md` invariants (invariants always win).
- From Phase 1 onward the backlog lives **in the tracker itself** (dogfooding).
  Until then, follow-ups go in `STATUS.md`.
- Anything time-sensitive in these files (upstream PR states, landscape claims) was
  true on **2026-07-04**. Verify before relying on it; `STATUS.md → Watchlist`
  tracks freshness.
