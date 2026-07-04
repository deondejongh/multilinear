# MOUNTPOINTS.md — registered edits to upstream files

This fork (multilinear) never edits upstream (`pingdotgg/t3code`) files except at
**mount points**: small (≤5-line) edits whose only job is to register something of
ours — a route, a service, a nav item, an RPC handler. See
`multilinear-plan/01-ARCHITECTURE.md` §1 (the granny-flat rules). Every such edit
is logged here the moment it is made, and the merge-guard CI
(`.github/workflows/multilinear-merge-guard.yml`) fails if any entry references a
file or anchor that no longer exists — so a broken upstream merge fails loudly
within minutes instead of rotting silently.

Reference format for the **Lines** column, checked by
`scripts/multilinear/check-mountpoints.ts`:

- `12` or `12-16` — line number(s); the file must have at least that many lines.
- `` `some text` `` — an anchor; the file must contain this exact substring.
- `—` — existence only; the file merely has to exist.

| File        | Lines                                                     | Purpose                                                                                                                                 | Date       |
| ----------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `AGENTS.md` | `## Picking the right models for workflows and subagents` | Human-added model-selection guidance for agent sessions (pre-dates Phase 0; instructions, not code — exceeds the 5-line rule knowingly) | 2026-07-04 |
| `CLAUDE.md` | —                                                         | Symlink to AGENTS.md so all agent harnesses share one instruction file                                                                  | 2026-07-04 |
