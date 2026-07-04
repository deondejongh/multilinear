/**
 * TrackerStore — event log + projections over SQLite (01-ARCHITECTURE §3–4).
 *
 * Commands are validated against current projections, appended to the
 * append-only `events` table, and applied to projection tables in the same
 * transaction. Projections are always rebuildable from the event log
 * (`rebuild`), and the log round-trips through JSONL (`exportJsonl` /
 * `importJsonl`) — the exit hatch and backup format.
 *
 * Storage is `node:sqlite` (STATUS D12): works on Node ≥22.16 and Bun ≥1.2,
 * synchronous like better-sqlite3, zero native build. This package imports
 * nothing from t3code (01 §7 invariant 7).
 */
import * as NodeSqlite from "node:sqlite";

import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { CommandRejectedError, type TrackerCommand } from "./Commands.ts";
import { ImportRejectedError, IssueNotFoundError, TrackerStorageError } from "./Errors.ts";
import { StoredTrackerEvent, TrackerEvent } from "./Events.ts";
import {
  type Actor,
  canonicalRelation,
  type Comment,
  DEFAULT_STATUS_NAMES,
  type Issue,
  type IssueId,
  type Label,
  type RelationKind,
  relationKindFor,
  type RunLink,
  shortIdOf,
  type Space,
  type SpaceId,
  STATUS_CATEGORIES,
  type Status,
  type StatusId,
  type TrackerEventId,
} from "./Model.ts";
import { makeUlidGenerator, type RandomFill } from "./Ulid.ts";
import type { IssueDetail, IssueFilter, IssueSummary, RelationView } from "./Views.ts";

export { ImportRejectedError, IssueNotFoundError, TrackerStorageError } from "./Errors.ts";

export interface TrackerStoreConfig {
  /** Path to the SQLite file, or `:memory:` for tests. */
  readonly dbPath: string;
  /** Randomness source for event-id ULIDs; injectable for deterministic tests. */
  readonly randomFill?: RandomFill;
}

/** Full dump of every projection table, used by tests and diagnostics. */
export interface ProjectionsDump {
  readonly [table: string]: ReadonlyArray<Record<string, unknown>>;
}

const PROJECTION_TABLES = [
  "spaces",
  "statuses",
  "labels",
  "issues",
  "issue_labels",
  "comments",
  "relations",
  "run_links",
] as const;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  ts TEXT NOT NULL,
  type TEXT NOT NULL,
  issue_id TEXT,
  actor_kind TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  causation_id TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_issue ON events(issue_id);
CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS statuses (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_statuses_space ON statuses(space_id);
CREATE TABLE IF NOT EXISTS labels (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_labels_space ON labels(space_id);
CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status_id TEXT NOT NULL,
  priority INTEGER NOT NULL,
  issue_type TEXT NOT NULL,
  assignee TEXT NOT NULL,
  delegate TEXT,
  origin TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_issues_space ON issues(space_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status_id);
CREATE TABLE IF NOT EXISTS issue_labels (
  issue_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  PRIMARY KEY (issue_id, label_id)
);
CREATE INDEX IF NOT EXISTS idx_issue_labels_label ON issue_labels(label_id);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL,
  body TEXT NOT NULL,
  actor_kind TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_issue ON comments(issue_id);
CREATE TABLE IF NOT EXISTS relations (
  id TEXT PRIMARY KEY,
  src_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  dst_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_relations_src ON relations(src_id);
CREATE INDEX IF NOT EXISTS idx_relations_dst ON relations(dst_id);
CREATE TABLE IF NOT EXISTS run_links (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  ref TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_run_links_issue ON run_links(issue_id);
`;

const encodeEventJson = Schema.encodeEffect(Schema.fromJsonString(TrackerEvent));
const decodeEventJson = Schema.decodeEffect(Schema.fromJsonString(TrackerEvent));

/**
 * An event fully specified except for id/ts/actor/causation, which append
 * assigns. Discriminated so type/payload pairs are checked at compile time.
 */
type EventDraft = {
  [K in TrackerEvent["type"]]: {
    readonly type: K;
    readonly payload: Extract<TrackerEvent, { type: K }>["payload"];
    readonly issueId: IssueId | null;
    /** Chain to the batch's first event instead of the command's root cause. */
    readonly causeIsBatchRoot?: boolean;
  };
}[TrackerEvent["type"]];

type SqlValue = string | number | null;

interface Row {
  readonly [column: string]: SqlValue;
}

export class TrackerStore extends Context.Service<
  TrackerStore,
  {
    /**
     * Validate a command against current projections, append the resulting
     * events, and apply them — atomically. Returns the appended events.
     */
    readonly execute: (
      command: TrackerCommand,
      actor: Actor,
      causationId?: TrackerEventId,
    ) => Effect.Effect<ReadonlyArray<TrackerEvent>, CommandRejectedError | TrackerStorageError>;
    readonly listSpaces: () => Effect.Effect<ReadonlyArray<Space>, TrackerStorageError>;
    readonly listStatuses: (
      spaceId: SpaceId,
    ) => Effect.Effect<ReadonlyArray<Status>, TrackerStorageError>;
    readonly listLabels: (
      spaceId?: SpaceId,
    ) => Effect.Effect<ReadonlyArray<Label>, TrackerStorageError>;
    readonly listIssues: (
      filter: IssueFilter,
    ) => Effect.Effect<ReadonlyArray<IssueSummary>, TrackerStorageError>;
    readonly getIssue: (
      issueId: IssueId,
    ) => Effect.Effect<IssueDetail, IssueNotFoundError | TrackerStorageError>;
    /** Activity feed: events for this issue, oldest first, with seq. */
    readonly listIssueEvents: (
      issueId: IssueId,
    ) => Effect.Effect<ReadonlyArray<StoredTrackerEvent>, TrackerStorageError>;
    /** Every event in append order — the full log. */
    readonly listAllEvents: () => Effect.Effect<
      ReadonlyArray<StoredTrackerEvent>,
      TrackerStorageError
    >;
    /** Replay the event log into freshly wiped projection tables. */
    readonly rebuild: () => Effect.Effect<void, TrackerStorageError>;
    /** JSONL of the full event log, one encoded event per line, append order. */
    readonly exportJsonl: () => Effect.Effect<string, TrackerStorageError>;
    /**
     * Restore a JSONL export into an empty store (refuses to run over
     * existing events), then rebuild projections.
     */
    readonly importJsonl: (
      jsonl: string,
    ) => Effect.Effect<{ imported: number }, ImportRejectedError | TrackerStorageError>;
    /** All projection tables as plain rows — tests and diagnostics. */
    readonly dumpProjections: () => Effect.Effect<ProjectionsDump, TrackerStorageError>;
  }
>()("@multilinear/core/Store/TrackerStore") {
  static readonly layer = (
    config: TrackerStoreConfig,
  ): Layer.Layer<TrackerStore, TrackerStorageError> =>
    Layer.effect(TrackerStore, makeTrackerStore(config));

  /** In-memory store for tests. */
  static readonly layerMemory: Layer.Layer<TrackerStore, TrackerStorageError> = Layer.suspend(() =>
    TrackerStore.layer({ dbPath: ":memory:" }),
  );
}

const defaultRandomFill: RandomFill = (bytes) => {
  globalThis.crypto.getRandomValues(bytes as Uint8Array<ArrayBuffer>);
};

const makeTrackerStore = Effect.fnUntraced(function* (config: TrackerStoreConfig) {
  const db = yield* Effect.acquireRelease(
    Effect.try({
      try: () => {
        const database = new NodeSqlite.DatabaseSync(config.dbPath);
        database.exec("PRAGMA foreign_keys = ON;");
        if (config.dbPath !== ":memory:") {
          database.exec("PRAGMA journal_mode = WAL;");
        }
        database.exec(SCHEMA_SQL);
        return database;
      },
      catch: (cause) => new TrackerStorageError({ operation: "open", cause }),
    }),
    (database) => Effect.sync(() => database.close()),
  );

  const ulid = makeUlidGenerator(config.randomFill ?? defaultRandomFill);

  const run = <A>(operation: string, body: () => A): Effect.Effect<A, TrackerStorageError> =>
    Effect.try({
      try: body,
      catch: (cause) => new TrackerStorageError({ operation, cause }),
    });

  /** Run `body` inside an immediate transaction, rolling back on any error. */
  const transactionally = <A, E>(
    operation: string,
    body: () => Effect.Effect<A, E>,
  ): Effect.Effect<A, E | TrackerStorageError> =>
    Effect.gen(function* () {
      yield* run(operation, () => db.exec("BEGIN IMMEDIATE"));
      const result = yield* body().pipe(
        Effect.onError(() =>
          Effect.sync(() => {
            try {
              db.exec("ROLLBACK");
            } catch {
              // Connection-level failure: nothing left to roll back.
            }
          }),
        ),
      );
      yield* run(operation, () => db.exec("COMMIT"));
      return result;
    });

  const all = (sql: string, ...params: ReadonlyArray<SqlValue>): ReadonlyArray<Row> =>
    db.prepare(sql).all(...params) as ReadonlyArray<Row>;

  const get = (sql: string, ...params: ReadonlyArray<SqlValue>): Row | undefined =>
    db.prepare(sql).get(...params) as Row | undefined;

  const runSql = (sql: string, ...params: ReadonlyArray<SqlValue>): void => {
    db.prepare(sql).run(...params);
  };

  // ── Row → entity mapping ─────────────────────────────────────────────────

  const rowToSpace = (row: Row): Space =>
    ({
      id: row.id,
      name: row.name,
      key: row.key,
      createdAt: row.created_at,
    }) as Space;

  const rowToStatus = (row: Row): Status =>
    ({
      id: row.id,
      spaceId: row.space_id,
      name: row.name,
      category: row.category,
      position: row.position,
    }) as Status;

  const rowToLabel = (row: Row): Label =>
    ({
      id: row.id,
      spaceId: row.space_id,
      name: row.name,
      color: row.color,
    }) as Label;

  const rowToIssue = (row: Row): Issue =>
    ({
      id: row.id,
      spaceId: row.space_id,
      number: row.number,
      title: row.title,
      description: row.description,
      statusId: row.status_id,
      priority: row.priority,
      type: row.issue_type,
      assignee: row.assignee,
      delegate: row.delegate,
      origin: row.origin,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }) as Issue;

  const rowToComment = (row: Row): Comment =>
    ({
      id: row.id,
      issueId: row.issue_id,
      body: row.body,
      actor: { kind: row.actor_kind, id: row.actor_id },
      createdAt: row.created_at,
    }) as Comment;

  const rowToRunLink = (row: Row): RunLink =>
    ({
      id: row.id,
      issueId: row.issue_id,
      kind: row.kind,
      ref: row.ref,
      createdAt: row.created_at,
    }) as RunLink;

  // ── Projection application (pure function of events; used by execute and
  //    rebuild — determinism depends on nothing else feeding these) ─────────

  const bumpIssueUpdatedAt = (issueId: string, ts: string): void => {
    runSql("UPDATE issues SET updated_at = ? WHERE id = ?", ts, issueId);
  };

  const applyEvent = (event: TrackerEvent): void => {
    switch (event.type) {
      case "space.created": {
        runSql(
          "INSERT INTO spaces (id, name, key, created_at) VALUES (?, ?, ?, ?)",
          event.payload.spaceId,
          event.payload.name,
          event.payload.key,
          event.ts,
        );
        return;
      }
      case "status.created": {
        runSql(
          "INSERT INTO statuses (id, space_id, name, category, position) VALUES (?, ?, ?, ?, ?)",
          event.payload.statusId,
          event.payload.spaceId,
          event.payload.name,
          event.payload.category,
          event.payload.position,
        );
        return;
      }
      case "issue.created": {
        const nextNumber =
          ((get(
            "SELECT MAX(number) AS max_number FROM issues WHERE space_id = ?",
            event.payload.spaceId,
          )?.max_number as number | null) ?? 0) + 1;
        runSql(
          `INSERT INTO issues (
            id, space_id, number, title, description, status_id, priority,
            issue_type, assignee, delegate, origin, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
          event.payload.issueId,
          event.payload.spaceId,
          nextNumber,
          event.payload.title,
          event.payload.description,
          event.payload.statusId,
          event.payload.priority,
          event.payload.issueType,
          event.actor.kind === "human" ? event.actor.id : "human",
          event.payload.origin,
          event.ts,
          event.ts,
        );
        return;
      }
      case "issue.updated": {
        const sets: string[] = [];
        const params: SqlValue[] = [];
        if (event.payload.title !== undefined) {
          sets.push("title = ?");
          params.push(event.payload.title);
        }
        if (event.payload.description !== undefined) {
          sets.push("description = ?");
          params.push(event.payload.description);
        }
        if (event.payload.priority !== undefined) {
          sets.push("priority = ?");
          params.push(event.payload.priority);
        }
        if (event.payload.issueType !== undefined) {
          sets.push("issue_type = ?");
          params.push(event.payload.issueType);
        }
        if (sets.length === 0) return;
        sets.push("updated_at = ?");
        params.push(event.ts, event.payload.issueId);
        runSql(`UPDATE issues SET ${sets.join(", ")} WHERE id = ?`, ...params);
        return;
      }
      case "status.changed": {
        runSql(
          "UPDATE issues SET status_id = ?, updated_at = ? WHERE id = ?",
          event.payload.toStatusId,
          event.ts,
          event.payload.issueId,
        );
        return;
      }
      case "label.created": {
        runSql(
          "INSERT INTO labels (id, space_id, name, color) VALUES (?, ?, ?, ?)",
          event.payload.labelId,
          event.payload.spaceId,
          event.payload.name,
          event.payload.color,
        );
        return;
      }
      case "label.added": {
        runSql(
          "INSERT INTO issue_labels (issue_id, label_id) VALUES (?, ?)",
          event.payload.issueId,
          event.payload.labelId,
        );
        bumpIssueUpdatedAt(event.payload.issueId, event.ts);
        return;
      }
      case "label.removed": {
        runSql(
          "DELETE FROM issue_labels WHERE issue_id = ? AND label_id = ?",
          event.payload.issueId,
          event.payload.labelId,
        );
        bumpIssueUpdatedAt(event.payload.issueId, event.ts);
        return;
      }
      case "comment.added": {
        runSql(
          `INSERT INTO comments (id, issue_id, body, actor_kind, actor_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          event.payload.commentId,
          event.payload.issueId,
          event.payload.body,
          event.actor.kind,
          event.actor.id,
          event.ts,
        );
        bumpIssueUpdatedAt(event.payload.issueId, event.ts);
        return;
      }
      case "relation.added": {
        runSql(
          "INSERT INTO relations (id, src_id, kind, dst_id, created_at) VALUES (?, ?, ?, ?, ?)",
          event.payload.relationId,
          event.payload.srcId,
          event.payload.kind,
          event.payload.dstId,
          event.ts,
        );
        bumpIssueUpdatedAt(event.payload.srcId, event.ts);
        bumpIssueUpdatedAt(event.payload.dstId, event.ts);
        return;
      }
      case "relation.removed": {
        runSql("DELETE FROM relations WHERE id = ?", event.payload.relationId);
        bumpIssueUpdatedAt(event.payload.srcId, event.ts);
        bumpIssueUpdatedAt(event.payload.dstId, event.ts);
        return;
      }
      case "run.linked": {
        runSql(
          "INSERT INTO run_links (id, issue_id, kind, ref, created_at) VALUES (?, ?, ?, ?, ?)",
          event.payload.runLinkId,
          event.payload.issueId,
          event.payload.kind,
          event.payload.ref,
          event.ts,
        );
        bumpIssueUpdatedAt(event.payload.issueId, event.ts);
        return;
      }
    }
  };

  // ── Command validation (reads projections, returns event drafts) ─────────

  const reject = (command: TrackerCommand, reason: string) =>
    Effect.fail(new CommandRejectedError({ command: command.type, reason }));

  const requireIssue = Effect.fnUntraced(function* (command: TrackerCommand, issueId: string) {
    const issue = get("SELECT * FROM issues WHERE id = ?", issueId);
    if (issue === undefined) {
      return yield* reject(command, `issue ${issueId} does not exist`);
    }
    return issue;
  });

  const decide = Effect.fnUntraced(function* (
    command: TrackerCommand,
    actor: Actor,
    nowMs: number,
  ) {
    const drafts: EventDraft[] = [];

    switch (command.type) {
      case "space.create": {
        if (get("SELECT id FROM spaces WHERE id = ?", command.spaceId) !== undefined) {
          return yield* reject(command, `space ${command.spaceId} already exists`);
        }
        if (get("SELECT id FROM spaces WHERE key = ?", command.key) !== undefined) {
          return yield* reject(command, `space key ${command.key} is already taken`);
        }
        drafts.push({
          type: "space.created",
          issueId: null,
          payload: { spaceId: command.spaceId, name: command.name, key: command.key },
        });
        STATUS_CATEGORIES.forEach((category, position) => {
          drafts.push({
            type: "status.created",
            issueId: null,
            causeIsBatchRoot: true,
            payload: {
              statusId: ulid.next(nowMs) as StatusId,
              spaceId: command.spaceId,
              name: DEFAULT_STATUS_NAMES[category],
              category,
              position,
            },
          });
        });
        return drafts;
      }

      case "issue.create": {
        if (get("SELECT id FROM issues WHERE id = ?", command.issueId) !== undefined) {
          return yield* reject(command, `issue ${command.issueId} already exists`);
        }
        if (get("SELECT id FROM spaces WHERE id = ?", command.spaceId) === undefined) {
          return yield* reject(command, `space ${command.spaceId} does not exist`);
        }
        let statusId = command.statusId;
        if (statusId === undefined) {
          const triage = get(
            "SELECT id FROM statuses WHERE space_id = ? AND category = 'triage' ORDER BY position LIMIT 1",
            command.spaceId,
          );
          if (triage === undefined) {
            return yield* reject(command, `space ${command.spaceId} has no triage status`);
          }
          statusId = triage.id as StatusId;
        } else {
          const status = get("SELECT space_id FROM statuses WHERE id = ?", statusId);
          if (status === undefined || status.space_id !== command.spaceId) {
            return yield* reject(
              command,
              `status ${statusId} does not belong to the issue's space`,
            );
          }
        }
        for (const labelId of command.labelIds) {
          const label = get("SELECT space_id FROM labels WHERE id = ?", labelId);
          if (label === undefined || label.space_id !== command.spaceId) {
            return yield* reject(command, `label ${labelId} does not belong to the issue's space`);
          }
        }
        drafts.push({
          type: "issue.created",
          issueId: command.issueId,
          payload: {
            issueId: command.issueId,
            spaceId: command.spaceId,
            title: command.title,
            description: command.description,
            statusId,
            priority: command.priority,
            issueType: command.issueType,
            origin: "local",
          },
        });
        for (const labelId of command.labelIds) {
          drafts.push({
            type: "label.added",
            issueId: command.issueId,
            causeIsBatchRoot: true,
            payload: { issueId: command.issueId, labelId },
          });
        }
        return drafts;
      }

      case "issue.update": {
        yield* requireIssue(command, command.issueId);
        if (
          command.title === undefined &&
          command.description === undefined &&
          command.priority === undefined &&
          command.issueType === undefined
        ) {
          return yield* reject(command, "nothing to update");
        }
        drafts.push({
          type: "issue.updated",
          issueId: command.issueId,
          payload: {
            issueId: command.issueId,
            ...(command.title !== undefined ? { title: command.title } : {}),
            ...(command.description !== undefined ? { description: command.description } : {}),
            ...(command.priority !== undefined ? { priority: command.priority } : {}),
            ...(command.issueType !== undefined ? { issueType: command.issueType } : {}),
          },
        });
        return drafts;
      }

      case "status.change": {
        const issue = yield* requireIssue(command, command.issueId);
        const status = get("SELECT * FROM statuses WHERE id = ?", command.statusId);
        if (status === undefined || status.space_id !== issue.space_id) {
          return yield* reject(
            command,
            `status ${command.statusId} does not belong to the issue's space`,
          );
        }
        if (issue.status_id === command.statusId) {
          return yield* reject(command, "issue is already in that status");
        }
        // Invariant 2 (01 §7): only a human action may move an issue into
        // the `done` category. Enforced here, not in UI or prompts.
        if (status.category === "done" && actor.kind !== "human") {
          return yield* reject(command, "only a human may move an issue into the done category");
        }
        drafts.push({
          type: "status.changed",
          issueId: command.issueId,
          payload: {
            issueId: command.issueId,
            fromStatusId: issue.status_id as StatusId,
            toStatusId: command.statusId,
          },
        });
        return drafts;
      }

      case "label.create": {
        if (get("SELECT id FROM labels WHERE id = ?", command.labelId) !== undefined) {
          return yield* reject(command, `label ${command.labelId} already exists`);
        }
        if (get("SELECT id FROM spaces WHERE id = ?", command.spaceId) === undefined) {
          return yield* reject(command, `space ${command.spaceId} does not exist`);
        }
        if (
          get(
            "SELECT id FROM labels WHERE space_id = ? AND lower(name) = lower(?)",
            command.spaceId,
            command.name,
          ) !== undefined
        ) {
          return yield* reject(command, `label "${command.name}" already exists in this space`);
        }
        drafts.push({
          type: "label.created",
          issueId: null,
          payload: {
            labelId: command.labelId,
            spaceId: command.spaceId,
            name: command.name,
            color: command.color,
          },
        });
        return drafts;
      }

      case "label.add": {
        const issue = yield* requireIssue(command, command.issueId);
        const label = get("SELECT space_id FROM labels WHERE id = ?", command.labelId);
        if (label === undefined || label.space_id !== issue.space_id) {
          return yield* reject(
            command,
            `label ${command.labelId} does not belong to the issue's space`,
          );
        }
        if (
          get(
            "SELECT issue_id FROM issue_labels WHERE issue_id = ? AND label_id = ?",
            command.issueId,
            command.labelId,
          ) !== undefined
        ) {
          return yield* reject(command, "label is already on the issue");
        }
        drafts.push({
          type: "label.added",
          issueId: command.issueId,
          payload: { issueId: command.issueId, labelId: command.labelId },
        });
        return drafts;
      }

      case "label.remove": {
        yield* requireIssue(command, command.issueId);
        if (
          get(
            "SELECT issue_id FROM issue_labels WHERE issue_id = ? AND label_id = ?",
            command.issueId,
            command.labelId,
          ) === undefined
        ) {
          return yield* reject(command, "label is not on the issue");
        }
        drafts.push({
          type: "label.removed",
          issueId: command.issueId,
          payload: { issueId: command.issueId, labelId: command.labelId },
        });
        return drafts;
      }

      case "comment.add": {
        yield* requireIssue(command, command.issueId);
        if (get("SELECT id FROM comments WHERE id = ?", command.commentId) !== undefined) {
          return yield* reject(command, `comment ${command.commentId} already exists`);
        }
        drafts.push({
          type: "comment.added",
          issueId: command.issueId,
          payload: {
            commentId: command.commentId,
            issueId: command.issueId,
            body: command.body,
          },
        });
        return drafts;
      }

      case "relation.add": {
        if (get("SELECT id FROM relations WHERE id = ?", command.relationId) !== undefined) {
          return yield* reject(command, `relation ${command.relationId} already exists`);
        }
        if (command.issueId === command.targetId) {
          return yield* reject(command, "an issue cannot relate to itself");
        }
        yield* requireIssue(command, command.issueId);
        yield* requireIssue(command, command.targetId);
        const canonical = canonicalRelation(command.issueId, command.kind, command.targetId);
        if (
          get(
            "SELECT id FROM relations WHERE src_id = ? AND kind = ? AND dst_id = ?",
            canonical.srcId,
            canonical.kind,
            canonical.dstId,
          ) !== undefined
        ) {
          return yield* reject(command, "that relation already exists");
        }
        drafts.push({
          type: "relation.added",
          issueId: command.issueId,
          payload: { relationId: command.relationId, ...canonical },
        });
        return drafts;
      }

      case "relation.remove": {
        const relation = get("SELECT * FROM relations WHERE id = ?", command.relationId);
        if (relation === undefined) {
          return yield* reject(command, `relation ${command.relationId} does not exist`);
        }
        drafts.push({
          type: "relation.removed",
          issueId: relation.src_id as IssueId,
          payload: {
            relationId: command.relationId,
            srcId: relation.src_id as IssueId,
            kind: relation.kind as RelationKind,
            dstId: relation.dst_id as IssueId,
          },
        });
        return drafts;
      }

      case "run-link.add": {
        yield* requireIssue(command, command.issueId);
        if (get("SELECT id FROM run_links WHERE id = ?", command.runLinkId) !== undefined) {
          return yield* reject(command, `run link ${command.runLinkId} already exists`);
        }
        drafts.push({
          type: "run.linked",
          issueId: command.issueId,
          payload: {
            runLinkId: command.runLinkId,
            issueId: command.issueId,
            kind: command.kind,
            ref: command.ref,
          },
        });
        return drafts;
      }
    }
  });

  const insertEvent = Effect.fnUntraced(function* (event: TrackerEvent) {
    const data = yield* encodeEventJson(event).pipe(
      Effect.mapError((cause) => new TrackerStorageError({ operation: "encode-event", cause })),
    );
    yield* run("append-event", () =>
      runSql(
        `INSERT INTO events (id, ts, type, issue_id, actor_kind, actor_id, causation_id, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        event.id,
        event.ts,
        event.type,
        event.issueId,
        event.actor.kind,
        event.actor.id,
        event.causationId,
        data,
      ),
    );
  });

  const execute = Effect.fn("TrackerStore.execute")(function* (
    command: TrackerCommand,
    actor: Actor,
    causationId?: TrackerEventId,
  ) {
    const nowMs = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
    const ts = DateTime.formatIso(DateTime.makeUnsafe(nowMs));

    return yield* transactionally("execute", () =>
      Effect.gen(function* () {
        const drafts = yield* decide(command, actor, nowMs);
        const events: TrackerEvent[] = [];
        let batchRootId: TrackerEventId | null = null;
        for (const draft of drafts) {
          const id = ulid.next(nowMs) as TrackerEventId;
          const event = {
            id,
            ts,
            actor,
            causationId: draft.causeIsBatchRoot === true ? batchRootId : (causationId ?? null),
            issueId: draft.issueId,
            type: draft.type,
            payload: draft.payload,
          } as TrackerEvent;
          if (batchRootId === null) batchRootId = id;
          yield* insertEvent(event);
          yield* run("apply-event", () => applyEvent(event));
          events.push(event);
        }
        return events;
      }),
    );
  });

  // ── Queries ───────────────────────────────────────────────────────────────

  const listSpaces = Effect.fn("TrackerStore.listSpaces")(function* () {
    return yield* run("list-spaces", () =>
      all("SELECT * FROM spaces ORDER BY name").map(rowToSpace),
    );
  });

  const listStatuses = Effect.fn("TrackerStore.listStatuses")(function* (spaceId: SpaceId) {
    return yield* run("list-statuses", () =>
      all("SELECT * FROM statuses WHERE space_id = ? ORDER BY position", spaceId).map(rowToStatus),
    );
  });

  const listLabels = Effect.fn("TrackerStore.listLabels")(function* (spaceId?: SpaceId) {
    return yield* run("list-labels", () =>
      (spaceId === undefined
        ? all("SELECT * FROM labels ORDER BY name")
        : all("SELECT * FROM labels WHERE space_id = ? ORDER BY name", spaceId)
      ).map(rowToLabel),
    );
  });

  const labelsByIssue = (issueIds: ReadonlyArray<string>): Map<string, Label[]> => {
    const map = new Map<string, Label[]>();
    if (issueIds.length === 0) return map;
    const placeholders = issueIds.map(() => "?").join(", ");
    const rows = all(
      `SELECT il.issue_id AS issue_id, l.id AS id, l.space_id AS space_id, l.name AS name, l.color AS color
       FROM issue_labels il JOIN labels l ON l.id = il.label_id
       WHERE il.issue_id IN (${placeholders})
       ORDER BY l.name`,
      ...issueIds,
    );
    for (const row of rows) {
      const issueId = row.issue_id as string;
      const existing = map.get(issueId) ?? [];
      existing.push(rowToLabel(row));
      map.set(issueId, existing);
    }
    return map;
  };

  const listIssues = Effect.fn("TrackerStore.listIssues")(function* (filter: IssueFilter) {
    return yield* run("list-issues", () => {
      const conditions: string[] = [];
      const params: SqlValue[] = [];
      if (filter.spaceId !== undefined) {
        conditions.push("i.space_id = ?");
        params.push(filter.spaceId);
      }
      if (filter.category !== undefined) {
        conditions.push("st.category = ?");
        params.push(filter.category);
      }
      if (filter.labelId !== undefined) {
        conditions.push(
          "EXISTS (SELECT 1 FROM issue_labels il WHERE il.issue_id = i.id AND il.label_id = ?)",
        );
        params.push(filter.labelId);
      }
      if (filter.search !== undefined && filter.search.trim() !== "") {
        conditions.push(
          "(instr(lower(i.title), lower(?)) > 0 OR instr(lower(sp.key || '-' || i.number), lower(?)) > 0)",
        );
        params.push(filter.search.trim(), filter.search.trim());
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const rows = all(
        `SELECT i.*, st.category AS category, sp.key AS space_key
         FROM issues i
         JOIN statuses st ON st.id = i.status_id
         JOIN spaces sp ON sp.id = i.space_id
         ${where}
         ORDER BY i.updated_at DESC, i.id DESC`,
        ...params,
      );
      const labels = labelsByIssue(rows.map((row) => row.id as string));
      return rows.map(
        (row): IssueSummary =>
          ({
            id: row.id,
            spaceId: row.space_id,
            spaceKey: row.space_key,
            number: row.number,
            shortId: shortIdOf(row.space_key as string, row.number as number),
            title: row.title,
            statusId: row.status_id,
            category: row.category,
            priority: row.priority,
            issueType: row.issue_type,
            labels: labels.get(row.id as string) ?? [],
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }) as unknown as IssueSummary,
      );
    });
  });

  const getIssue = Effect.fn("TrackerStore.getIssue")(function* (issueId: IssueId) {
    const issueRow = yield* run("get-issue", () =>
      get("SELECT * FROM issues WHERE id = ?", issueId),
    );
    if (issueRow === undefined) {
      return yield* new IssueNotFoundError({ issueId });
    }
    return yield* run("get-issue-detail", () => {
      const issue = rowToIssue(issueRow);
      const spaceRow = get("SELECT * FROM spaces WHERE id = ?", issue.spaceId);
      const statusRow = get("SELECT * FROM statuses WHERE id = ?", issue.statusId);
      if (spaceRow === undefined || statusRow === undefined) {
        throw new Error(`projection integrity: issue ${issueId} references missing space/status`);
      }
      const space = rowToSpace(spaceRow);
      const status = rowToStatus(statusRow);
      const labels = labelsByIssue([issue.id]).get(issue.id) ?? [];
      const comments = all(
        "SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at, id",
        issue.id,
      ).map(rowToComment);
      const relationRows = all(
        `SELECT r.*, o.title AS other_title, o.number AS other_number,
                osp.key AS other_space_key, ost.category AS other_category,
                (r.src_id = ?) AS outgoing
         FROM relations r
         JOIN issues o ON o.id = CASE WHEN r.src_id = ? THEN r.dst_id ELSE r.src_id END
         JOIN spaces osp ON osp.id = o.space_id
         JOIN statuses ost ON ost.id = o.status_id
         WHERE r.src_id = ? OR r.dst_id = ?
         ORDER BY r.created_at, r.id`,
        issue.id,
        issue.id,
        issue.id,
        issue.id,
      );
      const relations = relationRows.map((row): RelationView => {
        const outgoing = row.outgoing === 1;
        return {
          id: row.id,
          kind: relationKindFor(
            { srcId: row.src_id, kind: row.kind, dstId: row.dst_id } as never,
            issue.id,
          ),
          outgoing,
          otherIssueId: outgoing ? row.dst_id : row.src_id,
          otherShortId: shortIdOf(row.other_space_key as string, row.other_number as number),
          otherTitle: row.other_title,
          otherCategory: row.other_category,
        } as RelationView;
      });
      const runLinks = all(
        "SELECT * FROM run_links WHERE issue_id = ? ORDER BY created_at, id",
        issue.id,
      ).map(rowToRunLink);
      return {
        issue,
        shortId: shortIdOf(space.key, issue.number),
        space,
        status,
        labels,
        comments,
        relations,
        runLinks,
      } satisfies IssueDetail;
    });
  });

  const decodeStoredRows = (rows: ReadonlyArray<Row>) =>
    Effect.forEach(rows, (row) =>
      decodeEventJson(row.data as string).pipe(
        Effect.map((event): StoredTrackerEvent => ({ seq: row.seq as number, event })),
        Effect.mapError(
          (cause) => new TrackerStorageError({ operation: `decode-event-seq-${row.seq}`, cause }),
        ),
      ),
    );

  const listIssueEvents = Effect.fn("TrackerStore.listIssueEvents")(function* (issueId: IssueId) {
    const rows = yield* run("list-issue-events", () =>
      all(
        `SELECT seq, data FROM events
         WHERE issue_id = ?
            OR (type IN ('relation.added', 'relation.removed')
                AND json_extract(data, '$.payload.dstId') = ?)
         ORDER BY seq`,
        issueId,
        issueId,
      ),
    );
    return yield* decodeStoredRows(rows);
  });

  const listAllEvents = Effect.fn("TrackerStore.listAllEvents")(function* () {
    const rows = yield* run("list-all-events", () =>
      all("SELECT seq, data FROM events ORDER BY seq"),
    );
    return yield* decodeStoredRows(rows);
  });

  const wipeProjections = () => {
    for (const table of PROJECTION_TABLES) {
      db.exec(`DELETE FROM ${table}`);
    }
  };

  const rebuild = Effect.fn("TrackerStore.rebuild")(function* () {
    const events = yield* listAllEvents();
    yield* transactionally("rebuild", () =>
      run("rebuild-apply", () => {
        wipeProjections();
        for (const stored of events) {
          applyEvent(stored.event);
        }
      }),
    );
  });

  const exportJsonl = Effect.fn("TrackerStore.exportJsonl")(function* () {
    const rows = yield* run("export", () => all("SELECT data FROM events ORDER BY seq"));
    return rows.map((row) => row.data as string).join("\n") + (rows.length > 0 ? "\n" : "");
  });

  const importJsonl = Effect.fn("TrackerStore.importJsonl")(function* (jsonl: string) {
    const existing = yield* run("import-check", () => get("SELECT COUNT(*) AS count FROM events"));
    if (((existing?.count as number) ?? 0) > 0) {
      return yield* new ImportRejectedError({
        line: 0,
        reason: "store already contains events; import requires an empty store",
      });
    }
    const lines = jsonl
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");
    const events: TrackerEvent[] = [];
    for (const [index, line] of lines.entries()) {
      const event = yield* decodeEventJson(line).pipe(
        Effect.mapError(
          (cause) => new ImportRejectedError({ line: index + 1, reason: String(cause) }),
        ),
      );
      events.push(event);
    }
    yield* transactionally("import", () =>
      Effect.gen(function* () {
        for (const event of events) {
          yield* insertEvent(event);
        }
        yield* run("import-apply", () => {
          wipeProjections();
          for (const event of events) {
            applyEvent(event);
          }
        });
      }),
    );
    return { imported: events.length };
  });

  const dumpProjections = Effect.fn("TrackerStore.dumpProjections")(function* () {
    return yield* run("dump-projections", () => {
      const dump: Record<string, ReadonlyArray<Record<string, unknown>>> = {};
      for (const table of PROJECTION_TABLES) {
        dump[table] = all(`SELECT * FROM ${table} ORDER BY 1`) as ReadonlyArray<
          Record<string, unknown>
        >;
      }
      return dump as ProjectionsDump;
    });
  });

  return TrackerStore.of({
    execute,
    listSpaces,
    listStatuses,
    listLabels,
    listIssues,
    getIssue,
    listIssueEvents,
    listAllEvents,
    rebuild,
    exportJsonl,
    importJsonl,
    dumpProjections,
  });
});
