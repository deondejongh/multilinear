# 05 — Phase 4: rules and the world

**Goal:** the tracker reacts to events and talks to the outside world. Event-
triggered rules (the thing Linear automations can't do: one of the actions is
"wake an agent"), narrow GitHub sync, idea-issue behavior, and the first
configurer-agent slice.

**Prerequisite:** Phase 3 accepted. Build the four workstreams in this order —
each is independently shippable.

## A. Rules engine

- Rule files: `<repo>/.multilinear/rules/*.yaml` (repo-scoped) and
  `~/.multilinear/rules/*.yaml` (global). Shape: `on` (event type + filters),
  `if` (conditions on issue fields — **categories and labels only, never status
  names**), `do` (ordered actions). Schema-validated, hot-reloaded, each rule has
  `enabled: bool`. A thin UI editor may sit over these files; the files remain the
  source of truth. Every rule also gets a manual "run now" trigger in the UI.
- Triggers: any event type from our log (status.changed, label.added,
  comment.added, run.finished, github.\* once §B lands…). Time-based triggers are
  NOT implemented here — cron needs are met by upstream scheduled tasks calling our
  MCP (Phase 3 pattern).
- Actions: `transition`, `add_label`, `comment`, `create_issue`,
  `set_delegate` (→ Phase 3 dispatcher picks it up = "wake an agent"), `notify`.
  No shell-exec action (deliberately — revisit later).
- Safety (invariants 2–4 apply): rules act as `actor.kind = rule`; a rule must
  refuse to fire if its own id appears in the triggering event's causation chain;
  per-rule cooldown (default 1/min) and a global daily rule-action budget; global
  kill switch; per-rule **dry-run mode** that logs would-have-done actions as
  synthetic events.
- **Back-testing (the star):** `multilinear rules test <file> --since 90d` replays the
  rule against the historical event log and reports: fire count, actions by type,
  dispatches that would have occurred, estimated cost. Also runs automatically and
  shows in the UI when enabling a new rule. This feature is a differentiator —
  build it properly, with tests.
- Ship starter rules (disabled by default): close-on-PR-merge (needs §B),
  nag-stale-needs-review (>3 days → comment), close-parent-when-children-done,
  auto-delegate-bugfix (label `bug` + `ready` → delegate `bug-fixer`).

## B. GitHub sync — three narrow one-directional flows

Commandment: **the local tracker is the boss; GitHub is a peripheral.** No general
two-way sync, ever. Polling only (conditional requests; near-free at solo scale);
auth via `gh` CLI or a token in the macOS Keychain. Keep a sync ledger table
(local id ↔ remote id ↔ etag/timestamps).

1. **Outbound, PRs:** enrich what upstream already does — PR description drafted
   from issue + proof-of-work; PR body carries the issue short-id; the card shows
   live PR + CI status (polled). `github.pr_merged` event → starter rule closes
   the card.
2. **Inbound, issues:** new GitHub issues on configured repos mirror into `triage`
   as read-only cards, `origin=github` (untrusted). A triage-agent rule may
   annotate them **privately**; never auto-reply publicly. Edits upstream refresh
   the mirror; local comments never push out.
3. **Review-comments loop:** PR review comments pull in as issue comments and (if
   the card is in `needs_review`) transition it back to `in_progress` — the Phase 3
   continuation re-wakes the same thread with the feedback pack.

**Trust-tier enforcement (now real):** `origin != local` cards can only be
delegated to `read_only`/report-only profiles; overriding requires an explicit
human action recorded as an event. External text is rendered visibly quarantined
in context packs ("untrusted content below") — prompt-injection is the threat
model here.

## C. Idea-issues

- `type=idea` + delegate → opens a **discussion** session (profile `intent:
discuss`): no worktree, repo read-only or none, prompt = thinking partner. The
  comment thread is the conversation and the memory (context pack = full thread,
  compacted).
- **Promote** action: a planner profile drafts a spec into a `Doc` (markdown blob
  attached to the space — minimal Doc entity lands here), decomposes into
  sub-issues with acceptance criteria (parent/child + `discovered_from`), all into
  `backlog` for human review. Starter rule closes the parent when children finish.

## D. Configurer agent v0

- Publish the **config schema** (statuses-within-categories, labels, profiles,
  rules) as JSON Schema in `docs/config-schema/`.
- `type=config` issues delegate to a `configurer` profile whose proof-of-work is a
  config diff + a migration plan expressed as events (e.g. status rename → remap
  events for affected issues). Human reviews in the normal airlock; applying =
  hot reload. Renames are safe because everything binds to categories.
- Stretch (skip if time-boxed out): `multilinear init --interview` prompt-to-workspace
  onboarding.

## E. Morning briefing (janitor #2)

Upstream scheduled task, daily: agent reads the board via MCP and posts a digest
doc/notification — finished overnight, waiting in `needs_review`, blocked/stalled,
budget spent. Template in `docs/janitors/morning-briefing.md`.

## Out of scope

Team anything, sync engines, calendar, local models, tournament, mentions
(@profile in comments — parked in FUTURE-IDEAS), container sandboxing.

## Acceptance criteria

- [ ] Rules: hot reload, causation loop-guard test, cooldown test, dry-run
      produces synthetic events, kill switch works.
- [ ] Back-test command produces a correct report against seeded history (test
      with a crafted event log).
- [ ] GitHub: all three flows demoed against a real scratch repo; sync ledger
      survives restart; nothing ever posts publicly except PRs the human merges.
- [ ] Untrusted-origin delegation restriction enforced server-side with tests.
- [ ] Idea → discuss → promote → sub-issues → parent auto-close, end to end.
- [ ] Config card round-trip: propose status rename → review diff → apply →
      board reflects it, rules unaffected (category binding proven by test).
- [ ] Morning briefing has run for real at least once.
