# AGENTS.md

## Task Completion Requirements

- `vp check` and `vp run typecheck` must pass before considering tasks completed.
  - If changing native mobile code, `vp run lint:mobile` must also pass.
- Use `vp test` for the built-in Vite+ test command and `vp run test` when you specifically need the `test` package script.

## Project Snapshot

T3 Code is a minimal web GUI for using coding agents like Codex and Claude.

This repository is a VERY EARLY WIP. Proposing sweeping changes that improve long-term maintainability is encouraged.

## Core Priorities

1. Performance first.
2. Reliability first.
3. Keep behavior predictable under load and during failures (session restarts, reconnects, partial streams).

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Maintainability

Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.

## Picking the right models for workflows and subagents

Rankings, higher = better. Cost reflects actual limits I pay for (OpenAI limits are
effectively free at current usage; Claude usage is the budget to protect), not list
price. Intelligence is how hard a problem you can hand the model unsupervised. Taste
covers UI/UX, code quality, API design, and copy.

| model       | cost | intelligence | taste |
| ----------- | ---- | ------------ | ----- |
| gpt-5.6-sol | 9    | 8            | 5     |
| sonnet-5    | 5    | 5            | 7     |
| opus-4.8    | 4    | 7            | 8     |
| fable-5     | 2    | 9            | 9     |

How to apply:

- These are defaults, not limits. Standing permission to override: if a cheaper
  model's output doesn't meet the bar, rerun or redo the work with a smarter model
  without asking. Judge the output, not the price tag. Escalating costs less than
  shipping mediocre work.
- Cost is a tie-breaker only; when axes conflict for anything that ships,
  intelligence > taste > cost.
- Bulk/mechanical work with a clear spec (implementation against a written spec,
  migrations, test scaffolding, data analysis): gpt-5.6-sol — it's effectively free.
- Anything user-facing (UI, copy, API and MCP tool design) needs taste ≥ 7.
- Reviews of plans/implementations: fable-5 or opus-4.8, optionally gpt-5.6-sol as an
  extra independent perspective.
- Never use Haiku — with gpt-5.6-sol effectively free it has no niche here.
- Fable effort: `high` by default; `xhigh` only for architecture planning and final
  judge/review passes; never `max`.

Division of labor (matters extra in this Effect-heavy monorepo):

- Claude (fable/opus) defines the APIs, interfaces, schemas, and Effect module
  skeletons. gpt-5.6-sol does not design public surfaces or contracts
  (`packages/contracts` especially) — it tends to write TypeScript like Python.
  Whatever the model, Effect code follows `.repos/effect-smol` idioms (see Vendored
  Repositories below).
- gpt-5.6-sol executes well-spec'd implementation inside those skeletons, and is
  preferred for UI/UX verification and computer-use checks of the web app.
- Token-hungry side work (computer use, codebase-wide analysis) runs in a subagent
  or Codex, reporting results back — never in the orchestrating session's context.
- Phase sessions (`multilinear-plan/PROMPTS.md`) are orchestration sessions: the
  session model plans, dispatches well-spec'd chunks, and judges what comes back.
  The Working Agreement's completion bar (`vp check`, tests green) applies to
  delegated work the same as inline work.

Mechanics:

- gpt-5.6-sol is only reachable through the Codex CLI: `codex` is on PATH via
  `/usr/local/bin/codex`, a symlink to
  `/Applications/ChatGPT.app/Contents/Resources/codex` (fall back to
  `npx -y @openai/codex` if that binary is missing). `~/.codex/config.toml` already
  defaults to gpt-5.6-sol with `service_tier = "priority"` (fast) but only medium
  effort — pin `-c model_reasoning_effort=high` on codex commands.
- Codex prompts must be fully self-contained — it shares none of your context.
  Point it at files (e.g. the relevant `multilinear-plan/` spec section) instead of
  paraphrasing, and state acceptance criteria explicitly.
- Investigation/data analysis: `codex exec -c model_reasoning_effort=high -s read-only "<self-contained prompt>"`.
  Implementation: `codex exec` with a self-contained prompt; always review its diff
  before committing.
- Claude models (sonnet-5, opus-4.8, fable-5) run via the Agent/Workflow `model`
  parameter.
- Using gpt-5.6-sol inside workflows and subagents (the `model` parameter only takes
  Claude models): spawn a thin Claude wrapper agent with `model: 'sonnet'`, low
  effort, whose prompt instructs it to write a self-contained codex prompt, run
  `codex exec` via Bash, and return the result verbatim.

## Package Roles

- `apps/server`: Node.js WebSocket server. Wraps Codex app-server (JSON-RPC over stdio), serves the React web app, and manages provider sessions.
- `apps/web`: React/Vite UI. Owns session UX, conversation/event rendering, and client-side state. Connects to the server via WebSocket.
- `packages/contracts`: Shared effect/Schema schemas and TypeScript contracts for provider events, WebSocket protocol, and model/session types. Keep this package schema-only — no runtime logic.
- `packages/shared`: Shared runtime utilities consumed by both server and client applications. Uses explicit subpath exports (e.g. `@t3tools/shared/git`) — no barrel index.
- `packages/client-runtime`: Shared runtime package for sharing client code across web and mobile.

## Reference Repos

- Open-source Codex repo: https://github.com/openai/codex
- Codex-Monitor (Tauri, feature-complete, strong reference implementation): https://github.com/Dimillian/CodexMonitor

Use these as implementation references when designing protocol handling, UX flows, and operational safeguards.

## Vendored Repositories

This project vendors external repositories under `.repos/` as read-only reference material for coding
agents.

- Prefer examples and patterns from the vendored source code over generated guesses or web search results.
- Do not edit files under `.repos/` unless explicitly asked.
- Do not import from `.repos/`; application code must continue importing from normal package dependencies.
- Manage vendored subtrees with `bun run sync:repos`; use `bun run sync:repos --repo <id>` to sync one
  configured repository.
- When updating a dependency with a configured vendored subtree, sync that subtree in the same change so
  `.repos/` matches the installed dependency version.
- When writing Effect code, read `.repos/effect-smol/LLMS.md` first and inspect `.repos/effect-smol/` for
  examples of idiomatic usage, tests, module structure, and API design.
- When writing relay infrastructure code with Alchemy, inspect `.repos/alchemy-effect/` for examples of
  idiomatic usage, tests, module structure, and API design.
