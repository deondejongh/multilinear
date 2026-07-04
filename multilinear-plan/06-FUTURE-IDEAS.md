# 06 — Future ideas (parking lot)

Nothing in this file is scheduled; nothing in this file may be forgotten. Phase 1's
seed script imports these as `backlog` issues in the `multilinear` space. Append-only;
anyone (human or agent) may add, with a one-line rationale.

## Near (post-Phase-4 candidates, roughly by joy-per-effort)

- **Review-from-phone queue.** t3code remote mode already lets a Mac mini run
  everything; add a swipe-through review surface for `needs_review` (approve /
  request changes / reject). Clears the airlock from the couch.
- **Workflow evals ("prompt CI").** Archived real issues become a regression suite:
  tweak a profile's prompt → re-run against 3 known solved issues in throwaway
  worktrees → diff outcomes. Top-3 pick from planning; architecture makes it cheap.
- **Duplicate radar.** Embeddings over the issue corpus; new cards get a "possibly
  same as {id}" hint; one click proposes `duplicate_of`. Solo builders re-file
  their own ideas constantly.
- **Voice inbox.** Dictate a half-formed idea on the phone → triage agent turns the
  transcript into a structured draft issue. Capture friction is the #1 killer.
- **Decision log.** After idea discussions conclude, an agent extracts decisions
  ("chose X over Y because Z") into a repo-versioned log injected into future
  context packs. Institutional memory for an institution of one; stops agents
  relitigating settled arguments.
- **Auto-archive with epitaphs.** Stale issues archive on schedule with a one-line
  agent-written epitaph ("superseded by {id}; motivation gone"). Searchable
  graveyard. (Linear auto-close/auto-archive, humanized.)
- **Personal weekly cycle.** Auto-rollover of unfinished work; velocity metric =
  cards cleared from `needs_review`/week (review throughput, the honest number);
  agent-written cycle retro.
- **Project updates.** Agent-written weekly per-space status posts from the event
  log; feeds the morning briefing.
- **Demand weighting.** `+N requests` field; an intake email address/form per
  product feeding `triage` (Linear Asks, solo-sized). Sort backlog by demand.
- **Ready-gate grader.** An agent grades specs before `ready` and blocks vague ones
  ("no acceptance criteria; which endpoint?"). Highest-leverage quality lever.
- **Janitor pack.** Nightly TODO/FIXME sweep into draft issues; weekly
  dependency-bump; dead-code sweeper; docs-freshness checker — each just an
  upstream scheduled task + a profile calling our MCP (the Phase 3 pattern).
- **Local merge queue.** Serialize agent PR landings: rebase → test → merge → next.
  (GitHub merge queue / Graphite as reference.) Pairs with: **area-label
  serialization** (issues sharing an `area:*` label run sequentially, the dumb
  option first), a **rebase-fixer profile** (whole job: resolving conflicts), and
  **file-footprint estimates** at dispatch to serialize overlapping issues.
- **Model routing tiers.** Cheap models for triage/dupe/labels; big models for
  implementation; profiles declare tier. Biggest cost lever once rules dispatch.
- **Context compaction, properly.** Beads-style semantic memory decay over long
  comment threads (Phase 2 ships a naive stub).
- **Estimates-vs-actuals insights.** Calibration dashboards: "auth bugs cost ~R30
  and succeed first-try 70% of the time." Personal-scale data nobody else has.
- **Tournament mode.** Same issue, 2–3 delegates in separate worktrees; human or
  judge-agent picks the best diff. Expensive; great for gnarly problems; doubles as
  a personal model benchmark. (Agent HQ normalized compare-PRs — table stakes soon.)
- **@profile mentions** in any comment for one-shot contextual answers.
- **Spike issues, fully enforced.** Hard time/token caps at dispatch.
- **Quick-capture polish.** Things-3-grade speed; global hotkey via desktop app.
- **Blueprints gallery.** Shareable profiles + rules (Home Assistant blueprints
  model); an `awesome-` repo; import-from-URL.
- **Publish the conventions.** `docs/proof-of-work.md` and eventually a full
  SPEC.md so other people's agents can port the concept to other frontends.
- **The Method doc.** An opinionated manifesto — how to run a one-person software
  company with agents (Linear Method as the model). Projects with a worldview
  attract communities; projects with feature lists attract issues.
- **Status snapshot & observability.** A machine-readable board/dispatch state
  endpoint + structured logs (Symphony-style), so dashboards and community UIs can
  be built on top without touching internals.

## Later

- **Chief-of-staff agent.** Reads board + calendar, proposes the day's plan; the
  briefing grows a steering wheel. Approve the plan like any card.
- **Calendar-aware scheduling.** Issues meet real availability (Morgen/Motion/
  Reclaim patterns).
- **Local models** for the cheap tier — privacy story + cost floor.
- **Beyond-code spaces.** Repo-less spaces + non-coding profiles = personal
  operations centre (content, admin, business). Big audience, real focus risk —
  a deliberate decision, not a drift.
- **Container sandboxing** for untrusted dispatches (Apple containerization /
  Claude Code sandbox as candidates).
- **Insights.** Delegate share of work, cost per label, first-try success rates,
  SLA/staleness alarms, snooze.
- **Code-level malleability.** The advanced dogfood loop: the fork edits its own
  source through its own tracker. Config-level malleability (schema-bound,
  reviewable) stays the safe default; this ships as a clearly-marked advanced mode.
- **Protocol watch.** MCP for tools today; keep the dispatcher↔agent boundary thin
  enough to adopt whatever agent-lifecycle interop standard wins (A2A-class);
  Linear's AIG remains the UX north star.

## Team edition (far future — insurance already paid)

Already in the schema by design: `actor` on every event, client-side ULIDs, the
assigned(human)/delegated(profile) split. Do not build until real people beg.

1. **Stage 1 — shared house:** one machine runs the backend (t3code remote mode /
   Tailscale); 2–4 trusted people connect as clients. Team mode ≈ free.
2. **Stage 2 — sync engine:** event-log replication (diary pages merge; whiteboards
   don't). Candidates: Automerge/Loro, Electric/Zero; git-as-transport for tiny
   teams. Appends rarely conflict; timestamps break ties.
3. **Stage 3 — the human stuff:** identity, review routing by area
   ("auth cards need Sam"), per-person budgets, a notifications inbox.
- Posture, permanent: no seats, no RBAC, no SaaS. Small teams where agents
  outnumber humans. If it ever needs a sales team, we took a wrong turn.

## Watchlist and tripwires (verify dates in STATUS.md)

- Upstream: #2829 merge; `codex-turn-mapping` branch; OrchestratorMcpService tool
  growth; scheduled-tasks evolution (thread-bound steering mode, base-branch
  limitation). **Tripwire:** upstream grows a persistent queue of assignable work
  items *with states* → stop and re-derive the collision map before building more.
- Landscape: GitHub Agent HQ feature cadence; Vibe Kanban community fork; Beads /
  GasTown direction; Linear agent features.

## Inspiration atlas (condensed: name → steal this)

| Source | Steal |
|---|---|
| Linear | status *categories*; Triage-as-inbox + triage rules; delegation ≠ assignment (human accountable); agent session states incl. awaiting-input; AIG (identity, instant feedback, transparency); agent guidance files |
| Symphony (OpenAI) | claim/dispatch/reconcile loop; repo-owned WORKFLOW files; handoff states; continuation turns; proof-of-work framing; ship-as-spec |
| Beads (Yegge) | `discovered_from` provenance; compaction/memory decay; "ready work" = unblocked; protocol-and-CLI with community UIs |
| Home Assistant | blueprints (shareable automations); event bus; local-first community economics |
| Temporal / Inngest / Trigger.dev | durable-execution vocabulary: retries, idempotency, wait-for-human steps |
| Obsidian | files you own; plugin community; trust as the product; business model |
| Things 3 / Raycast | capture speed; ⌘K-everything |
| Graphite / CodeRabbit | review queue + mobile review; reviewer-agent gate |
| git-bug / Fossil / Ink & Switch | issues-living-with-code prior art; local-first + malleable software philosophy |
| Warp Oz / Agent HQ | live-session link on the card; "assign issue → PR" as the normalized grammar |
| Vibe Kanban / Jean / Emdash / Conductor / Crystal | closest-sibling UX: board+workspaces, AI-assisted git commands, issue context loaded into every session — study before designing ours |
| Omnara / Sculptor (+ upstream issue #525 "Spotlight mode") | sessions that just exist across phone/web/desktop; syncing agent worktree changes back into the live local checkout for testing |
| n8n / Kiro hooks / GitHub Spec Kit | self-hosted visual workflow editing; event-driven agent hooks; spec-driven development discipline for the Ready gate |
| Morgen / Motion / Reclaim | calendar-aware scheduling patterns for the chief-of-staff era |
| Devin / Codex cloud | playbooks ≈ our profiles; cloud norms for agent automations and Slack/Linear surfaces |
