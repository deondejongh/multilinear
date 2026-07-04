// @effect-diagnostics nodeBuiltinImport:off globalDate:off globalDateInEffect:off globalTimers:off
/**
 * Scripted end-to-end walkthrough (03-PHASE-2 acceptance): an external agent
 * session works the board purely through the standalone MCP stdio server —
 * list ready issues, claim one via comment, transition to in_progress,
 * attach proof, transition to needs_review, file a discovered_from
 * follow-up — with the whitelist visibly rejecting what it must.
 *
 * Documented in docs/multilinear-agent-walkthrough.md. Run from the repo root:
 *
 *   node --experimental-transform-types \
 *     packages/multilinear-server/src/mcp/walkthrough.ts
 *
 * Uses a throwaway database; your real tracker is untouched. Exits 0 only if
 * every step behaves exactly as specified.
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeReadline from "node:readline";
import * as NodeURL from "node:url";

import * as Effect from "effect/Effect";

import type { IssueId, SpaceId, StatusId } from "@multilinear/core/model";
import { TrackerStore } from "@multilinear/core/store";
import { makeUlidGenerator } from "@multilinear/core/ulid";

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const stdioServerPath = NodePath.join(here, "stdio.ts");
const dbPath = NodePath.join(
  NodeOS.tmpdir(),
  `multilinear-walkthrough-${process.pid}-${Date.now()}.db`,
);
const actorId = "walkthrough:raw-claude-session";

const log = (line: string) => {
  process.stdout.write(`${line}\n`);
};

const fatal = (message: string): never => {
  process.stderr.write(`\nWALKTHROUGH FAILED: ${message}\n`);
  process.exit(1);
};

const expect = (condition: boolean, message: string) => {
  if (!condition) fatal(message);
};

// ── 1. Seed a scratch board: one space, one specified issue in Ready ────────

const ulid = makeUlidGenerator((bytes) => {
  globalThis.crypto.getRandomValues(bytes as Uint8Array<ArrayBuffer>);
});

const seeded = await Effect.runPromise(
  Effect.gen(function* () {
    const store = yield* TrackerStore;
    const spaceId = ulid.next(Date.now()) as SpaceId;
    yield* store.execute(
      { type: "space.create", spaceId, name: "Walkthrough", key: "WLK" },
      { kind: "human", id: "deon" },
    );
    const statuses = yield* store.listStatuses(spaceId);
    const readyStatus = statuses.find((status) => status.category === "ready");
    const issueId = ulid.next(Date.now()) as IssueId;
    yield* store.execute(
      {
        type: "issue.create",
        issueId,
        spaceId,
        title: "Rename the widget factory",
        description: [
          "## Acceptance criteria",
          "",
          "- `WidgetFactory` is renamed to `WidgetForge` everywhere",
          "- tests still pass",
          "",
          "## Out of scope",
          "",
          "- any behavior change",
        ].join("\n"),
        priority: 2,
        issueType: "work",
        labelIds: [],
        statusId: readyStatus?.id as StatusId,
      },
      { kind: "human", id: "deon" },
    );
    return { spaceId, issueId };
  }).pipe(Effect.provide(TrackerStore.layer({ dbPath })), Effect.scoped),
);
log(`Seeded scratch board at ${dbPath}`);

// ── 2. Start the standalone MCP stdio server, exactly as a raw session would ─

const server = NodeChildProcess.spawn(
  process.execPath,
  ["--experimental-transform-types", "--no-warnings", stdioServerPath],
  {
    env: { ...process.env, MULTILINEAR_DB_PATH: dbPath, MULTILINEAR_ACTOR: actorId },
    stdio: ["pipe", "pipe", "inherit"],
  },
);
const lines = NodeReadline.createInterface({ input: server.stdout });
const pending = new Map<number, (message: Record<string, unknown>) => void>();
lines.on("line", (line) => {
  const message = JSON.parse(line) as { id?: number };
  if (message.id !== undefined && pending.has(message.id)) {
    const resolve = pending.get(message.id);
    pending.delete(message.id);
    resolve?.(message as Record<string, unknown>);
  }
});

let nextId = 0;
const request = (method: string, params: unknown): Promise<Record<string, unknown>> => {
  nextId += 1;
  const id = nextId;
  const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
    pending.set(id, resolve);
    setTimeout(() => reject(new Error(`timed out waiting for ${method} (id ${id})`)), 30_000);
  });
  server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  return promise;
};
const notify = (method: string, params: unknown) => {
  server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
};

interface ToolOutcome {
  readonly isError: boolean;
  readonly value: Record<string, unknown>;
  readonly text: string;
}

const callTool = async (name: string, args: unknown): Promise<ToolOutcome> => {
  const response = (await request("tools/call", { name, arguments: args })) as {
    result?: {
      isError?: boolean;
      structuredContent?: Record<string, unknown>;
      content?: ReadonlyArray<{ type: string; text?: string }>;
    };
    error?: { message?: string };
  };
  if (response.error !== undefined) {
    return { isError: true, value: {}, text: response.error.message ?? "protocol error" };
  }
  const result = response.result ?? {};
  const text = (result.content ?? [])
    .map((part) => part.text ?? "")
    .filter((part) => part !== "")
    .join("\n");
  return { isError: result.isError === true, value: result.structuredContent ?? {}, text };
};

const step = (title: string) => log(`\n== ${title}`);

// ── 3. The walkthrough itself ───────────────────────────────────────────────

await request("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "walkthrough", version: "0" },
});
notify("notifications/initialized", {});
log(`Connected to the multilinear MCP server as agent "${actorId}"`);

step("ml_list_ready — what can I pick up?");
const ready = await callTool("ml_list_ready", { space: "WLK" });
expect(!ready.isError, `list_ready failed: ${ready.text}`);
const issues = ready.value.issues as ReadonlyArray<{ id: string; title: string }>;
expect(issues.length === 1, `expected exactly one ready issue, got ${issues.length}`);
const id = issues[0]?.id ?? "";
log(`   → ${id}: ${issues[0]?.title}`);

step("ml_get_issue — read the briefing");
const briefing = await callTool("ml_get_issue", { id });
expect(!briefing.isError, `get_issue failed: ${briefing.text}`);
expect(
  String((briefing.value as { description?: string }).description).includes("Acceptance criteria"),
  "briefing should carry the acceptance criteria",
);
log("   → description, relations, and discussion in hand");

step("ml_comment — claim it");
const claim = await callTool("ml_comment", { id, body: "Claiming this issue — starting now." });
expect(!claim.isError, `comment failed: ${claim.text}`);
log("   → claim comment posted");

step("ml_transition — ready → in_progress");
const start = await callTool("ml_transition", { id, to_status: "in_progress" });
expect(!start.isError, `transition failed: ${start.text}`);
log("   → in_progress");

step("ml_transition — try to skip straight to done (must be rejected)");
const doneAttempt = await callTool("ml_transition", { id, to_status: "done" });
expect(doneAttempt.isError, "the done ban did not fire!");
log(`   → rejected: ${doneAttempt.text}`);

step("ml_transition — needs_review without proof (must be rejected)");
const early = await callTool("ml_transition", { id, to_status: "needs_review" });
expect(early.isError, "the proof-required rule did not fire!");
log(`   → rejected: ${early.text}`);

step("ml_attach_proof — hand over the evidence");
const proof = await callTool("ml_attach_proof", {
  id,
  proof: {
    summary: "Renamed WidgetFactory to WidgetForge across 6 files; no behavior change.",
    not_done: ["README screenshots still show the old name — filed as a follow-up"],
    diff_stat: { files_changed: 6, insertions: 41, deletions: 41 },
    tests: [{ command: "vp test run", result: "passed", detail: "112 tests" }],
    risks: ["external blog posts still reference WidgetFactory"],
    followups_filed: [],
    cost: { tokens: 18_400 },
  },
});
expect(!proof.isError, `attach_proof failed: ${proof.text}`);
log("   → proof of work attached");

step("ml_transition — in_progress → needs_review (now allowed)");
const review = await callTool("ml_transition", { id, to_status: "needs_review" });
expect(!review.isError, `transition failed: ${review.text}`);
log("   → needs_review: waiting in the airlock for a human");

step("ml_create_issue — file the discovered follow-up with provenance");
const followup = await callTool("ml_create_issue", {
  title: "Update README screenshots after the WidgetForge rename",
  body: "Discovered while renaming: the README still shows WidgetFactory screenshots.",
  space: "WLK",
  type: "work",
  discovered_from: id,
});
expect(!followup.isError, `create_issue failed: ${followup.text}`);
const followupId = (followup.value as { id?: string }).id ?? "";
log(`   → ${followupId} filed, discovered_from ${id}`);

server.stdin.end();
server.kill();

// ── 4. Verify the permanent record straight from the event log ──────────────

step("verify the event log (opening the DB directly)");
await Effect.runPromise(
  Effect.gen(function* () {
    const store = yield* TrackerStore;
    const detail = yield* store.getIssue(seeded.issueId);
    expect(detail.status.category === "needs_review", "issue should sit in needs_review");
    expect(detail.proofs.length === 1, "exactly one proof should be attached");
    expect(detail.proofs[0]?.actor.kind === "agent", "the proof actor must be an agent");
    expect(detail.proofs[0]?.actor.id === actorId, "the proof must carry the session identity");
    expect(
      detail.comments[0]?.actor.id === actorId,
      "the claim comment must carry the session identity",
    );
    const followupIssueId = yield* store.resolveIssueId(followupId);
    expect(followupIssueId !== undefined, "the follow-up must exist");
    const followupDetail = yield* store.getIssue(followupIssueId as IssueId);
    expect(
      followupDetail.relations.some(
        (relation) => relation.kind === "discovered_from" && relation.otherShortId === id,
      ),
      "the follow-up must be linked discovered_from the original issue",
    );
    const events = yield* store.listIssueEvents(seeded.issueId);
    const types = new Set(events.map((entry) => entry.event.type));
    for (const expected of ["issue.created", "comment.added", "status.changed", "proof.attached"]) {
      expect(types.has(expected as never), `event log must contain ${expected}`);
    }
    log("   → event log tells the whole story, with true agent actors");
  }).pipe(Effect.provide(TrackerStore.layer({ dbPath })), Effect.scoped),
);

log("\nWALKTHROUGH PASSED — agents are citizens of the board.");
process.exit(0);
